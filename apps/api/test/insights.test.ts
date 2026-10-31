import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { auditEvents, companies, deals, departments, employees, memberships, users } from "../src/db/schema";
import { addMember, getApp, signUpWithOrg } from "./helpers";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function seed(orgId: string, ownerId: string) {
  const [co] = await db.insert(companies).values({ orgId, name: "=HYPERLINK(\"http://evil\")" }).returning();
  const deal = (name: string, value: string, status: "won" | "lost" | "open", at: Date | null) => ({
    orgId, companyId: co!.id, name, value, currency: "NGN", stage: "Proposal", status, ownerUserId: ownerId,
    wonAt: status === "won" ? at : null, lostAt: status === "lost" ? at : null,
  });
  await db.insert(deals).values([
    deal("A", "1000000", "won", daysAgo(10)),
    deal("B", "2500000", "won", daysAgo(40)),
    deal("C", "500000", "lost", daysAgo(20)),
    deal("D", "750000", "won", daysAgo(120)), // previous period
    deal("E", "300000", "open", null),
    deal("F", "9000000", "won", daysAgo(400)), // outside both periods
  ]);
  const [sales] = await db.insert(departments).values({ orgId, name: "Sales" }).returning();
  await db.insert(employees).values([
    { orgId, firstName: "Ada", lastName: "Obi", departmentId: sales!.id, status: "active", startDate: daysAgo(30).toISOString().slice(0, 10) },
    { orgId, firstName: "Ben", lastName: "Eze", departmentId: sales!.id, status: "on_leave", startDate: "2020-01-06" },
    { orgId, firstName: "Chi", lastName: "Udo", status: "onboarding" },
    { orgId, firstName: "Dan", lastName: "Ola", status: "left", endDate: daysAgo(5).toISOString().slice(0, 10) },
  ]);
}

describe("insights", () => {
  it("computes overview and sales numbers from real records", async () => {
    const app = await getApp();
    const { c } = await signUpWithOrg(app);
    const me = (await c.get("/api/auth/me")).body;
    await seed(me.org.id, me.user.id);

    const ov = await c.get("/api/insights/overview?range=3m");
    expect(ov.status).toBe(200);
    expect(ov.body.revenueWon.value).toBe(3_500_000);
    expect(ov.body.revenueWon.previous).toBe(750_000);
    expect(ov.body.headcount).toEqual({ value: 3, starters: 1 });
    expect(ov.body.headcountByDepartment).toEqual([{ label: "Sales", value: 2 }, { label: "No department", value: 1 }]);
    expect(ov.body.revenueByMonth).toHaveLength(6);
    expect(ov.body.revenueByMonth.reduce((a: number, m: any) => a + m.value, 0)).toBe(3_500_000 + 750_000);
    expect(ov.body.tasksOnTime.value).toBeNull();
    expect(ov.body.definitions.revenueWon).toBeTruthy();

    const sales = await c.get("/api/insights/reports/sales?range=3m");
    const kpi = (k: string) => sales.body.kpis.find((x: any) => x.key === k);
    expect(kpi("revenueWon").value).toBe(3_500_000);
    expect(kpi("dealsWon").value).toBe(2);
    expect(kpi("dealsWon").note).toBe("of 3 closed");
    expect(kpi("winRate").value).toBe(67);
    expect(kpi("averageDeal").value).toBe(1_750_000);
    expect(sales.body.table.rows).toHaveLength(1);
    expect(sales.body.table.total).toMatchObject({ dealsWon: 2, valueWon: 3_500_000, winRate: 67, openPipeline: 300_000 });
    expect(sales.body.charts[0].data.reduce((a: number, d: any) => a + d.value, 0)).toBe(3_500_000);

    const people = await c.get("/api/insights/reports/people?range=3m");
    expect(people.body.kpis.find((k: any) => k.key === "leavers").value).toBe(1);
    for (const name of ["hiring", "work"]) expect((await c.get(`/api/insights/reports/${name}`)).status).toBe(200);
    expect((await c.get("/api/insights/reports/nope")).status).toBe(404);
  });

  it("keeps organisations apart", async () => {
    const app = await getApp();
    const a = await signUpWithOrg(app);
    const meA = (await a.c.get("/api/auth/me")).body;
    await seed(meA.org.id, meA.user.id);
    const b = await signUpWithOrg(app);
    const ov = await b.c.get("/api/insights/overview");
    expect(ov.body.revenueWon.value).toBe(0);
    expect(ov.body.headcount.value).toBe(0);
  });

  it("requires export permission and neutralises formulas", async () => {
    const app = await getApp();
    const { c: admin } = await signUpWithOrg(app);
    const me = (await admin.get("/api/auth/me")).body;
    await seed(me.org.id, me.user.id);
    // Give the owner of the deals a formula-looking name to prove cells are neutralised.
    await db.update(users).set({ name: "=SUM(A1:A9)" }).where(eq(users.id, me.user.id));

    const { c: member, email } = await addMember(app, admin, "member");
    expect((await member.get("/api/insights/overview")).status).toBe(403);
    const [u] = await db.select().from(users).where(eq(users.email, email));
    await db.update(memberships).set({ workspaceAccess: { insights: "view", crm: "view" } }).where(eq(memberships.userId, u!.id));
    expect((await member.get("/api/insights/overview")).status).toBe(200);
    expect((await member.get("/api/insights/reports/sales/export?format=csv")).status).toBe(403);

    const csv = await app.inject({ method: "GET", url: "/api/insights/reports/sales/export?format=csv&range=3m&columns=owner,valueWon", headers: { cookie: `wv_session=${admin.cookies.wv_session}` } });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-disposition"]).toMatch(/^attachment; filename="windveal-sales-report-/);
    const lines = csv.body.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("Owner,Value won");
    expect(lines[1]).toBe("'=SUM(A1:A9),3500000");
    expect(lines[2]).toBe("Total,3500000");

    const xlsx = await app.inject({ method: "GET", url: "/api/insights/reports/sales/export?format=xlsx", headers: { cookie: `wv_session=${admin.cookies.wv_session}` } });
    expect(xlsx.statusCode).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.rawPayload as unknown as ArrayBuffer);
    const values: unknown[] = [];
    wb.worksheets[0]!.eachRow((r) => r.eachCell((cell) => values.push(cell.value)));
    expect(values).toContain("'=SUM(A1:A9)");
    expect(values.some((v) => typeof v === "string" && v.startsWith("="))).toBe(false);

    const events = await db.select().from(auditEvents).where(and(eq(auditEvents.orgId, me.org.id), eq(auditEvents.action, "insights.exported")));
    expect(events).toHaveLength(2);
    expect(events[0]!.summary).toContain("exported the Sales report");
  });
});
