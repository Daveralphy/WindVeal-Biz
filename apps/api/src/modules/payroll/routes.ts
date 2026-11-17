import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray, isNull, ne, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { employeePay, employees, memberships, payRuns, payslips, users, type PayOverrides } from "../../db/schema";
import { hasAccess } from "@windveal/shared";
import { can, needPersonal, requireOrg, type OrgContext } from "../../lib/context";
import { badRequest, conflict, forbidden, notFound, parse } from "../../lib/http";
import { audit, notify } from "../../lib/audit";
import { toCsv } from "../../lib/csv";
import { fullName, myEmployee } from "../people/shared";
import { computeSlip, monthlyFrom } from "./calc";

const uuid = z.string().uuid();
const MONEY_FIELDS = ["basic", "housing", "transport", "otherAllowances", "bonus", "pension", "nhf", "paye", "otherDeductions"] as const;
type Run = typeof payRuns.$inferSelect;
type Payslip = typeof payslips.$inferSelect;

const monthLabel = (period: string) => new Date(`${period}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** People who prepare payroll: People & HR "manage" and the See pay permission. Admins always can. */
function canPrepare(ctx: OrgContext) {
  return ctx.membership.role === "admin" || (hasAccess(ctx.access.people, "manage") && can(ctx, "see_pay"));
}
async function preparer(req: Parameters<typeof requireOrg>[0]) {
  const ctx = await requireOrg(req);
  if (!canPrepare(ctx)) throw forbidden("Payroll needs People & HR (manage) and the See pay permission.");
  return ctx;
}

async function loadRun(ctx: OrgContext, id: string): Promise<Run> {
  if (!uuid.safeParse(id).success) throw notFound("That payroll");
  const [r] = await db.select().from(payRuns).where(and(eq(payRuns.id, id), eq(payRuns.orgId, ctx.org.id), isNull(payRuns.deletedAt))).limit(1);
  if (!r) throw notFound("That payroll");
  return r;
}

const slipsOf = (runIds: string[]) => runIds.length
  ? db.select().from(payslips).where(and(inArray(payslips.runId, runIds), isNull(payslips.deletedAt))).orderBy(asc(payslips.name))
  : Promise.resolve([] as Payslip[]);

function totals(slips: Payslip[]) {
  const sum = (k: keyof Payslip) => slips.reduce((a, s) => a + Math.round(Number(s[k]) * 100), 0) / 100;
  return {
    people: slips.length, gross: sum("gross").toFixed(2), net: sum("net").toFixed(2), paye: sum("paye").toFixed(2),
    pension: sum("pension").toFixed(2), nhf: sum("nhf").toFixed(2), deductions: (sum("gross") - sum("net")).toFixed(2),
  };
}

async function namesOf(ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = list.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, list)) : [];
  return new Map(rows.map((r) => [r.id, r.name]));
}

function runView(r: Run, slips: Payslip[], names: Map<string, string>) {
  const who = (id: string | null) => (id ? { id, name: names.get(id) ?? "Someone" } : null);
  return {
    id: r.id, period: r.period, label: monthLabel(r.period), status: r.status, currency: r.currency, note: r.note,
    preparedBy: who(r.preparedBy), createdAt: r.createdAt,
    checkedBy: who(r.checkedBy), checkedAt: r.checkedAt, approvedBy: who(r.approvedBy), approvedAt: r.approvedAt, paidBy: who(r.paidBy), paidAt: r.paidAt,
    totals: totals(slips),
  };
}

const slipView = (s: Payslip, showBank: boolean) => ({
  id: s.id, employeeId: s.employeeId, name: s.name, jobTitle: s.jobTitle,
  basic: s.basic, housing: s.housing, transport: s.transport, otherAllowances: s.otherAllowances, bonus: s.bonus, gross: s.gross,
  pension: s.pension, nhf: s.nhf, paye: s.paye, otherDeductions: s.otherDeductions, net: s.net,
  overrides: Object.keys(s.overrides ?? {}), note: s.note,
  bankName: showBank ? s.bankName : null, accountNumber: showBank ? s.accountNumber : s.accountNumber ? `•••• ${s.accountNumber.slice(-4)}` : null,
});

/** Who is paid in a month: everyone still working who has a salary and started by the month's end. */
async function payable(ctx: OrgContext, period: string) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const end = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const rows = await db.select({ e: employees, p: employeePay }).from(employees).innerJoin(employeePay, eq(employeePay.employeeId, employees.id))
    .where(and(eq(employees.orgId, ctx.org.id), isNull(employees.deletedAt), ne(employees.status, "left")));
  return rows.filter(({ e, p }) => Number(p.salaryAmount ?? 0) > 0 && (!e.startDate || e.startDate <= end));
}

/** A fresh payslip for one person (keeping what HR typed in). */
function slipValues(ctx: OrgContext, run: Run, e: typeof employees.$inferSelect, p: typeof employeePay.$inferSelect, overrides: PayOverrides = {}) {
  return {
    orgId: ctx.org.id, runId: run.id, employeeId: e.id, name: fullName(e), jobTitle: e.jobTitle,
    ...computeSlip(monthlyFrom(Number(p.salaryAmount ?? 0), p.payFrequency), run.currency, overrides),
    overrides, bankName: p.bankName, accountNumber: p.accountNumber,
  };
}

/**
 * Payroll: HR (People & HR manage + See pay) prepares a month's pay, it's checked, an admin approves it, and once the
 * money has gone out it's marked paid and everyone's payslip appears in their Finance space.
 * WindVeal works out PAYE, pension and NHF (see calc.ts); HR can change any amount on anyone's payslip before approval.
 */
export default async function payrollRoutes(app: FastifyInstance) {
  app.get("/api/payroll/runs", async (req) => {
    const ctx = await preparer(req);
    const runs = await db.select().from(payRuns).where(and(eq(payRuns.orgId, ctx.org.id), isNull(payRuns.deletedAt))).orderBy(desc(payRuns.period));
    const slips = await slipsOf(runs.map((r) => r.id));
    const names = await namesOf(runs.flatMap((r) => [r.preparedBy, r.checkedBy, r.approvedBy, r.paidBy]));
    const people = await payable(ctx, new Date().toISOString().slice(0, 7));
    return {
      runs: runs.map((r) => runView(r, slips.filter((s) => s.runId === r.id), names)),
      isAdmin: ctx.membership.role === "admin", payablePeople: people.length, currency: ctx.org.currency,
    };
  });

  /** Prepare a month: a payslip for everyone being paid. One payroll per month. */
  app.post("/api/payroll/runs", async (req) => {
    const ctx = await preparer(req);
    const { period } = parse(z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month") }), req.body);
    const [exists] = await db.select({ id: payRuns.id }).from(payRuns).where(and(eq(payRuns.orgId, ctx.org.id), eq(payRuns.period, period), isNull(payRuns.deletedAt))).limit(1);
    if (exists) throw conflict(`There's already a payroll for ${monthLabel(period)}.`);
    const people = await payable(ctx, period);
    if (!people.length) throw badRequest("No one has a salary yet. Add pay details to people in People & HR first.");
    const run = await db.transaction(async (tx) => {
      const [r] = await tx.insert(payRuns).values({ orgId: ctx.org.id, period, currency: ctx.org.currency ?? "NGN", preparedBy: ctx.user.id }).returning();
      await tx.insert(payslips).values(people.map(({ e, p }) => slipValues(ctx, r!, e, p)));
      return r!;
    });
    await audit(ctx, { action: "payroll.prepared", category: "data", entityType: "pay_run", entityId: run.id, summary: `${ctx.user.name} prepared payroll for ${monthLabel(period)}` });
    return { id: run.id };
  });

  app.get<{ Params: { id: string } }>("/api/payroll/runs/:id", async (req) => {
    const ctx = await preparer(req);
    const run = await loadRun(ctx, req.params.id);
    const slips = await slipsOf([run.id]);
    const names = await namesOf([run.preparedBy, run.checkedBy, run.approvedBy, run.paidBy]);
    return {
      run: runView(run, slips, names), slips: slips.map((s) => slipView(s, true)),
      canEdit: run.status === "prepared", isAdmin: ctx.membership.role === "admin", me: ctx.user.id,
    };
  });

  /** Change amounts on one payslip. A blank amount goes back to what WindVeal works out. */
  app.patch<{ Params: { id: string } }>("/api/payroll/payslips/:id", async (req) => {
    const ctx = await preparer(req);
    if (!uuid.safeParse(req.params.id).success) throw notFound("That payslip");
    const [s] = await db.select().from(payslips).where(and(eq(payslips.id, req.params.id), eq(payslips.orgId, ctx.org.id), isNull(payslips.deletedAt))).limit(1);
    if (!s) throw notFound("That payslip");
    const run = await loadRun(ctx, s.runId);
    if (run.status !== "prepared") throw conflict("This payroll has moved on. Send it back to Prepared to change amounts.");
    const amount = z.union([z.literal(""), z.null(), z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 150000 or 150000.50"), z.number().nonnegative()]);
    const input = parse(z.object({ overrides: z.record(z.enum(MONEY_FIELDS), amount).optional(), note: z.string().trim().max(500).nullable().optional() }), req.body);
    const overrides: PayOverrides = { ...(s.overrides ?? {}) };
    for (const [k, v] of Object.entries(input.overrides ?? {}) as [keyof PayOverrides, string | number | null][]) {
      if (v === null || v === "") delete overrides[k]; else overrides[k] = String(v);
    }
    const [p] = await db.select().from(employeePay).where(eq(employeePay.employeeId, s.employeeId)).limit(1);
    const monthly = monthlyFrom(Number(p?.salaryAmount ?? 0), p?.payFrequency);
    const slip = computeSlip(monthly, run.currency, overrides);
    if (Number(slip.net) < 0) throw badRequest("Deductions can't be more than the pay.", { net: "Take-home pay would be below zero" });
    const [u] = await db.update(payslips).set({ ...slip, overrides, note: input.note === undefined ? s.note : input.note, version: dsql`${payslips.version} + 1` })
      .where(eq(payslips.id, s.id)).returning();
    await audit(ctx, { action: "payroll.changed", category: "data", entityType: "pay_run", entityId: run.id, summary: `${ctx.user.name} changed ${s.name}'s pay for ${monthLabel(run.period)}` });
    return { slip: slipView(u!, true) };
  });

  /** Work everything out again from people's current pay details (keeps typed-in amounts; adds and drops people). */
  app.post<{ Params: { id: string } }>("/api/payroll/runs/:id/refresh", async (req) => {
    const ctx = await preparer(req);
    const run = await loadRun(ctx, req.params.id);
    if (run.status !== "prepared") throw conflict("Send this payroll back to Prepared first.");
    const people = await payable(ctx, run.period);
    const old = await slipsOf([run.id]);
    await db.transaction(async (tx) => {
      await tx.update(payslips).set({ deletedAt: new Date() }).where(eq(payslips.runId, run.id));
      if (people.length) await tx.insert(payslips).values(people.map(({ e, p }) => {
        const was = old.find((s) => s.employeeId === e.id);
        return { ...slipValues(ctx, run, e, p, was?.overrides ?? {}), note: was?.note ?? null };
      }));
    });
    return { ok: true, people: people.length };
  });

  /**
   * Move the payroll on: check (anyone who prepares payroll), approve (an admin), pay (an admin, once the bank has
   * paid it), or send it back to Prepared to change something (before it's paid).
   */
  app.post<{ Params: { id: string } }>("/api/payroll/runs/:id/step", async (req) => {
    const ctx = await preparer(req);
    const run = await loadRun(ctx, req.params.id);
    const { action } = parse(z.object({ action: z.enum(["check", "approve", "pay", "reopen"]) }), req.body);
    const admin = ctx.membership.role === "admin";
    const now = new Date();
    const label = monthLabel(run.period);
    let set: Partial<Run>;
    if (action === "check") {
      if (run.status !== "prepared") throw conflict("Only a prepared payroll can be checked.");
      set = { status: "checked", checkedBy: ctx.user.id, checkedAt: now };
    } else if (action === "approve") {
      if (!admin) throw forbidden("Only an admin can approve payroll.");
      if (run.status !== "checked") throw conflict("Check the payroll before approving it.");
      set = { status: "approved", approvedBy: ctx.user.id, approvedAt: now };
    } else if (action === "pay") {
      if (!admin) throw forbidden("Only an admin can mark payroll as paid.");
      if (run.status !== "approved") throw conflict("Approve the payroll before marking it paid.");
      set = { status: "paid", paidBy: ctx.user.id, paidAt: now };
    } else {
      if (run.status === "paid") throw conflict("This payroll has been paid and can't be changed.");
      if (run.status === "approved" && !admin) throw forbidden("Only an admin can reopen an approved payroll.");
      set = { status: "prepared", checkedBy: null, checkedAt: null, approvedBy: null, approvedAt: null };
    }
    await db.update(payRuns).set({ ...set, version: dsql`${payRuns.version} + 1` }).where(eq(payRuns.id, run.id));
    const verb = { check: "checked", approve: "approved", pay: "marked as paid", reopen: "sent back to Prepared" }[action];
    await audit(ctx, { action: `payroll.${action}`, category: "data", entityType: "pay_run", entityId: run.id, summary: `${ctx.user.name} ${verb} payroll for ${label}` });
    // Tell the people who need to act next, and everyone paid once it's paid.
    if (action === "check") {
      const admins = await db.select({ userId: memberships.userId }).from(memberships)
        .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.role, "admin"), eq(memberships.status, "active")));
      for (const a of admins) if (a.userId !== ctx.user.id) await notify(ctx.org.id, a.userId, `Payroll for ${label} is ready to approve`, `Checked by ${ctx.user.name}.`, `/people/payroll/${run.id}`);
    }
    if (action === "pay") {
      const slips = await db.select({ userId: employees.userId }).from(payslips).innerJoin(employees, eq(employees.id, payslips.employeeId))
        .where(and(eq(payslips.runId, run.id), isNull(payslips.deletedAt)));
      for (const s of slips) if (s.userId) await notify(ctx.org.id, s.userId, `Your payslip for ${label} is ready`, undefined, "/me/finance/payslips");
    }
    return { ok: true, status: set.status };
  });

  /** Throw away a payroll that hasn't been approved. */
  app.delete<{ Params: { id: string } }>("/api/payroll/runs/:id", async (req) => {
    const ctx = await preparer(req);
    const run = await loadRun(ctx, req.params.id);
    if (run.status === "approved" || run.status === "paid") throw conflict("An approved payroll can't be deleted.");
    await db.update(payRuns).set({ deletedAt: new Date() }).where(eq(payRuns.id, run.id));
    await audit(ctx, { action: "payroll.deleted", category: "data", entityType: "pay_run", entityId: run.id, summary: `${ctx.user.name} deleted payroll for ${monthLabel(run.period)}` });
    return { ok: true };
  });

  /** The bank file: who to pay, to which account, how much. Only once approved. */
  app.get<{ Params: { id: string } }>("/api/payroll/runs/:id/bank-file", async (req, reply) => {
    const ctx = await preparer(req);
    const run = await loadRun(ctx, req.params.id);
    if (run.status !== "approved" && run.status !== "paid") throw conflict("The bank file is ready once the payroll is approved.");
    const slips = await slipsOf([run.id]);
    await audit(ctx, { action: "payroll.bank_file", category: "data", entityType: "pay_run", entityId: run.id, summary: `${ctx.user.name} downloaded the bank file for ${monthLabel(run.period)}` });
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="payroll-${run.period}-bank.csv"`);
    return toCsv(["Name", "Bank", "Account number", "Amount", "Currency", "Narration"],
      slips.map((s) => [s.name, s.bankName ?? "", s.accountNumber ?? "", s.net, run.currency, `Salary ${monthLabel(run.period)}`]));
  });

  // ----- a person's own payslips (Finance) -----

  app.get("/api/my/payslips", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "finance");
    const me = await myEmployee(ctx);
    if (!me) return { payslips: [] };
    const rows = await db.select({ s: payslips, r: payRuns }).from(payslips).innerJoin(payRuns, eq(payRuns.id, payslips.runId))
      .where(and(eq(payslips.employeeId, me.id), isNull(payslips.deletedAt), isNull(payRuns.deletedAt), eq(payRuns.status, "paid")))
      .orderBy(desc(payRuns.period));
    return { payslips: rows.map(({ s, r }) => ({ ...slipView(s, false), period: r.period, label: monthLabel(r.period), currency: r.currency, paidAt: r.paidAt })) };
  });

  app.get<{ Params: { id: string } }>("/api/my/payslips/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "finance");
    const me = await myEmployee(ctx);
    if (!me || !uuid.safeParse(req.params.id).success) throw notFound("That payslip");
    const [row] = await db.select({ s: payslips, r: payRuns }).from(payslips).innerJoin(payRuns, eq(payRuns.id, payslips.runId))
      .where(and(eq(payslips.id, req.params.id), eq(payslips.employeeId, me.id), isNull(payslips.deletedAt), eq(payRuns.status, "paid"))).limit(1);
    if (!row) throw notFound("That payslip");
    return {
      payslip: { ...slipView(row.s, false), period: row.r.period, label: monthLabel(row.r.period), currency: row.r.currency, paidAt: row.r.paidAt },
      employee: { name: fullName(me), jobTitle: me.jobTitle, reference: (me as { reference?: string | null }).reference ?? null },
      org: { name: ctx.org.tradingName || ctx.org.legalName },
    };
  });
}
