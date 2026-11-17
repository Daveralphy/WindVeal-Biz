import { describe, expect, it } from "vitest";
import { addMember, getApp, giveAccess, signUpWithOrg } from "./helpers";
import { annualTax, computeSlip, monthlyFrom } from "../src/modules/payroll/calc";

describe("payroll: the sums", () => {
  it("taxes yearly income in the Nigeria Tax Act 2025 bands", () => {
    expect(annualTax(800_000)).toBe(0);
    expect(annualTax(3_000_000)).toBe(330_000);
    expect(annualTax(5_430_000)).toBeCloseTo(767_400, 2);
    expect(annualTax(60_000_000)).toBeCloseTo(330_000 + 1_620_000 + 2_730_000 + 5_750_000 + 2_500_000, 2);
  });

  it("works out a ₦500,000 month by hand: pension 8%, NHF 2.5% of basic, then PAYE", () => {
    // Basic 300,000, housing 125,000, transport 75,000. Pension 40,000; NHF 7,500.
    // Yearly taxable (500,000 - 47,500) x 12 = 5,430,000 -> tax 767,400 -> 63,950 a month.
    expect(computeSlip(500_000, "NGN")).toEqual({
      basic: "300000.00", housing: "125000.00", transport: "75000.00", otherAllowances: "0.00", bonus: "0.00", gross: "500000.00",
      pension: "40000.00", nhf: "7500.00", paye: "63950.00", otherDeductions: "0.00", net: "388550.00",
    });
    // A ₦100,000 bonus is taxed as extra income that month (all of it in the 18% band).
    expect(computeSlip(500_000, "NGN", { bonus: "100000" })).toMatchObject({ gross: "600000.00", paye: "81950.00", net: "470550.00" });
    // Low pay: no tax at all.
    expect(computeSlip(60_000, "NGN")).toMatchObject({ pension: "4800.00", nhf: "900.00", paye: "0.00", net: "54300.00" });
    // HR's amount wins; the rest is worked out around it.
    expect(computeSlip(500_000, "NGN", { paye: "50000" })).toMatchObject({ paye: "50000.00", net: "402500.00" });
    // Other currencies: nothing deducted unless HR types it in.
    expect(computeSlip(3_000, "USD")).toMatchObject({ pension: "0.00", paye: "0.00", net: "3000.00" });
    expect(monthlyFrom(1_000, "Weekly")).toBeCloseTo(4_333.33, 1);
  });
});

describe("payroll: prepared, checked, approved, paid", () => {
  it("runs a month from HR to everyone's payslip", async () => {
    const app = await getApp();
    const admin = await signUpWithOrg(app);
    const staff = await addMember(app, admin.c, "member", "Bola Ade");
    const hr = await addMember(app, admin.c, "member", "Hauwa Musa");
    await giveAccess(admin.c, hr.email, { people: "manage" });
    const made0 = await admin.c.post("/api/people/employees", { firstName: "Bola", lastName: "Ade", email: staff.email, jobTitle: "Sales", startDate: "2024-01-01" });
    const bola = made0.body.employee;
    expect((await admin.c.put(`/api/people/employees/${bola.id}/pay`, { salaryAmount: "500000", currency: "NGN", payFrequency: "Monthly", bankName: "GTBank", accountNumber: "0123456789" })).status).toBe(200);

    // People & HR "manage" isn't enough without See pay.
    expect((await hr.c.post("/api/payroll/runs", { period: "2026-10" })).status).toBe(403);
    const m = (await admin.c.get("/api/members")).body.find((x: any) => x.email === hr.email);
    expect((await admin.c.patch(`/api/members/${m.id}`, { specialPermissions: ["see_pay"] })).status).toBe(200);

    const made = await hr.c.post("/api/payroll/runs", { period: "2026-10" });
    expect(made.status).toBe(200);
    expect((await hr.c.post("/api/payroll/runs", { period: "2026-10" })).status).toBe(409);
    let run = (await hr.c.get(`/api/payroll/runs/${made.body.id}`)).body;
    expect(run.run.status).toBe("prepared");
    const slip = run.slips.find((s: any) => s.name === "Bola Ade");
    expect(slip).toMatchObject({ gross: "500000.00", paye: "63950.00", net: "388550.00", accountNumber: "0123456789" });

    // HR changes an amount; a blank puts it back.
    const changed = await hr.c.patch(`/api/payroll/payslips/${slip.id}`, { overrides: { bonus: "100000" } });
    expect(changed.body.slip).toMatchObject({ net: "470550.00", overrides: ["bonus"] });
    expect((await hr.c.patch(`/api/payroll/payslips/${slip.id}`, { overrides: { otherDeductions: "999999" } })).status).toBe(400);

    // Bola can't see it until it's paid.
    expect((await staff.c.get("/api/my/payslips")).body.payslips).toEqual([]);

    expect((await hr.c.post(`/api/payroll/runs/${made.body.id}/step`, { action: "approve" })).status).toBe(403);
    expect((await hr.c.post(`/api/payroll/runs/${made.body.id}/step`, { action: "check" })).body.status).toBe("checked");
    expect((await hr.c.patch(`/api/payroll/payslips/${slip.id}`, { overrides: { bonus: "" } })).status).toBe(409);
    expect((await admin.c.get(`/api/payroll/runs/${made.body.id}/bank-file`)).status).toBe(409);
    expect((await admin.c.post(`/api/payroll/runs/${made.body.id}/step`, { action: "approve" })).body.status).toBe("approved");
    const bank = await admin.c.get(`/api/payroll/runs/${made.body.id}/bank-file`);
    expect(bank.status).toBe(200);
    expect(String(bank.body)).toContain("Bola Ade,GTBank,0123456789,470550.00,NGN");
    expect((await hr.c.del(`/api/payroll/runs/${made.body.id}`)).status).toBe(409);
    expect((await admin.c.post(`/api/payroll/runs/${made.body.id}/step`, { action: "pay" })).body.status).toBe("paid");
    expect((await admin.c.post(`/api/payroll/runs/${made.body.id}/step`, { action: "reopen" })).status).toBe(409);

    run = (await admin.c.get("/api/payroll/runs")).body;
    expect(run.runs[0]).toMatchObject({ period: "2026-10", status: "paid", totals: { people: 1, net: "470550.00" } });

    // Bola sees the payslip in Finance, with the account number hidden but the last four.
    const mine = (await staff.c.get("/api/my/payslips")).body.payslips;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ label: "October 2026", net: "470550.00", bonus: "100000.00", accountNumber: "•••• 6789" });
    const one = await staff.c.get(`/api/my/payslips/${mine[0].id}`);
    expect(one.body.employee.name).toBe("Bola Ade");
    // Nobody without payroll rights sees the runs.
    expect((await staff.c.get("/api/payroll/runs")).status).toBe(403);
    expect((await hr.c.get(`/api/my/payslips/${mine[0].id}`)).status).toBe(404);
  });
});
