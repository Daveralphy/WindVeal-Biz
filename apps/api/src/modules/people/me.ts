import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "../../db/client";
import {
  attendance, checklists, departments, employeePay, employees, staffRequests, tasks,
} from "../../db/schema";
import { requireOrg, needPersonal } from "../../lib/context";
import { checklistProgress, myEmployee } from "./shared";
import { workedMinutes } from "./attendance";
import { localDate } from "./util";

/**
 * My Workspace: a person's own things, whatever their role. Nothing here shows anyone else's records,
 * and none of it needs People & HR access.
 */
export default async function mySpaceRoutes(app: FastifyInstance) {
  /** What My space has for this person (so the sidebar only shows what applies). */
  app.get("/api/my/summary", async (req) => {
    const ctx = await requireOrg(req);
    const me = await myEmployee(ctx);
    const handles = await handlesRequests(ctx);
    if (!me) return { employee: null, onboarding: false, handles, leads: false };
    const [led] = await db.select({ id: departments.id }).from(departments)
      .where(and(eq(departments.orgId, ctx.org.id), eq(departments.headEmployeeId, me.id), isNull(departments.deletedAt))).limit(1);
    const [cl] = await db.select({ id: checklists.id }).from(checklists)
      .where(and(eq(checklists.employeeId, me.id), isNull(checklists.deletedAt))).limit(1);
    // The next onboarding step that isn't done.
    const [next] = cl ? await db.select({ title: tasks.title, dueAt: tasks.dueAt }).from(tasks).innerJoin(checklists, eq(checklists.id, tasks.checklistId))
      .where(and(eq(checklists.employeeId, me.id), isNull(tasks.deletedAt), isNull(checklists.deletedAt), eq(checklists.status, "in_progress")))
      .orderBy(asc(tasks.dueAt)).limit(1) : [];
    return {
      employee: { id: me.id, firstName: me.firstName, jobTitle: me.jobTitle, startDate: me.startDate, status: me.status },
      onboarding: !!cl, nextStep: next ?? null, handles, leads: !!led,
    };
  });

  /** Their own clock-ins, a month at a time. */
  app.get<{ Querystring: { month?: string } }>("/api/my/attendance", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "attendance");
    const me = await myEmployee(ctx);
    const month = /^\d{4}-\d{2}$/.test(req.query.month ?? "") ? req.query.month! : localDate().slice(0, 7);
    if (!me) return { month, days: [] };
    const [y, m] = month.split("-").map(Number) as [number, number];
    const last = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    const rows = await db.select().from(attendance)
      .where(and(eq(attendance.employeeId, me.id), isNull(attendance.deletedAt), gte(attendance.workDate, `${month}-01`), lte(attendance.workDate, last)))
      .orderBy(desc(attendance.workDate));
    return {
      month,
      days: rows.map((r) => ({
        date: r.workDate, clockIn: r.clockIn, clockOut: r.clockOut, breaks: r.breaks.length, corrected: r.source === "correction", note: r.note,
        minutes: r.clockIn ? workedMinutes(r, r.clockOut ?? (r.workDate === localDate() ? new Date() : null)) : null,
      })),
    };
  });

  /** Their own pay details (no payroll yet, so no payslips). */
  app.get("/api/my/pay", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "finance");
    const me = await myEmployee(ctx);
    const [p] = me ? await db.select().from(employeePay).where(eq(employeePay.employeeId, me.id)).limit(1) : [];
    return {
      pay: p ? {
        salaryAmount: p.salaryAmount, currency: p.currency ?? ctx.org.currency, payFrequency: p.payFrequency,
        bankName: p.bankName, accountNumber: p.accountNumber, updatedAt: p.updatedAt,
      } : null,
      employmentType: me?.employmentType ?? null, startDate: me?.startDate ?? null,
    };
  });

  /** Their onboarding (and offboarding) checklists. Each one opens with /api/people/checklists/:id. */
  app.get("/api/my/checklists", async (req) => {
    const ctx = await requireOrg(req);
    const me = await myEmployee(ctx);
    if (!me) return [];
    const rows = await db.select().from(checklists).where(and(eq(checklists.employeeId, me.id), isNull(checklists.deletedAt))).orderBy(desc(checklists.createdAt));
    const prog = await checklistProgress(rows.map((c) => c.id));
    return rows.map((c) => ({ id: c.id, kind: c.kind, title: c.title, status: c.status, total: prog.get(c.id)?.total ?? 0, done: prog.get(c.id)?.done ?? 0 }));
  });
}

/**
 * Whether requests may come to this person to handle: admins, anyone someone reports to, anyone chosen in
 * Settings to handle a kind, or anyone with something waiting. Decides whether "To handle" shows.
 */
async function handlesRequests(ctx: Parameters<typeof myEmployee>[0]): Promise<boolean> {
  if (ctx.membership.role === "admin") return true;
  if (Object.values(ctx.org.settings.requestHandlers ?? {}).includes(ctx.user.id)) return true;
  const [mine] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.orgId, ctx.org.id), eq(employees.userId, ctx.user.id), isNull(employees.deletedAt))).limit(1);
  if (mine) {
    const [report] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.managerId, mine.id), isNull(employees.deletedAt))).limit(1);
    if (report) return true;
  }
  const [waiting] = await db.select({ id: staffRequests.id }).from(staffRequests)
    .where(and(eq(staffRequests.orgId, ctx.org.id), eq(staffRequests.handlerUserId, ctx.user.id), isNull(staffRequests.deletedAt))).limit(1);
  return !!waiting;
}
