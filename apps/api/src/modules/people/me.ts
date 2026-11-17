import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "../../db/client";
import {
  attendance, checklists, departments, employeePay, employees, leaveRequests, leaveTypes, publicHolidays, staffRequests, tasks,
} from "../../db/schema";
import { requireOrg, needPersonal } from "../../lib/context";
import { checklistProgress, myEmployee } from "./shared";
import { workedMinutes } from "./attendance";
import { addDays, isHoliday, localDate, minutesOfDay, parseHm, weekday } from "./util";

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

  /**
   * Attendance at a glance for one month: each day's status (on time, late, leave, public holiday, no clock-in),
   * hours worked, this month against last, and their usual day (average clock-in, clock-out and break).
   * "Late" means clocking in after the business's start of day (Settings, 09:00 unless changed).
   */
  app.get<{ Querystring: { month?: string } }>("/api/my/attendance/overview", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "attendance");
    const me = await myEmployee(ctx);
    const today = localDate();
    const month = /^\d{4}-\d{2}$/.test(req.query.month ?? "") ? req.query.month! : today.slice(0, 7);
    const workdayStart = ctx.org.settings.workdayStart ?? "09:00";
    const empty = { month, workdayStart, days: [], totals: { minutes: 0, prevMinutes: 0, worked: 0, onTime: 0, late: 0 }, usual: null };
    if (!me) return empty;
    const [y, m] = month.split("-").map(Number) as [number, number];
    const first = `${month}-01`, last = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    const prevFirst = localDate(new Date(y, m - 2, 1)), prevLast = addDays(first, -1);
    const usualFrom = addDays(today, -60);
    const from = [prevFirst, usualFrom].sort()[0]!;
    const [rows, leave, holidays] = await Promise.all([
      db.select().from(attendance).where(and(eq(attendance.employeeId, me.id), isNull(attendance.deletedAt), gte(attendance.workDate, from), lte(attendance.workDate, last > today ? last : today))),
      db.select({ start: leaveRequests.startDate, end: leaveRequests.endDate, type: leaveTypes.name }).from(leaveRequests)
        .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
        .where(and(eq(leaveRequests.employeeId, me.id), eq(leaveRequests.status, "approved"), isNull(leaveRequests.deletedAt), lte(leaveRequests.startDate, last), gte(leaveRequests.endDate, first))),
      db.select().from(publicHolidays).where(eq(publicHolidays.orgId, ctx.org.id)),
    ]);
    const startMin = parseHm(workdayStart);
    const byDate = new Map(rows.map((r) => [r.workDate, r]));
    const breakMin = (r: (typeof rows)[number]) => r.breaks.reduce((a, b) => a + Math.max(0, ((b.end ? Date.parse(b.end) : (r.clockOut ?? new Date()).getTime()) - Date.parse(b.start)) / 60_000), 0);
    const minutesOf = (r: (typeof rows)[number]) => (r.clockIn ? workedMinutes(r, r.clockOut ?? (r.workDate === today ? new Date() : null)) ?? 0 : 0);
    const days = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const r = byDate.get(d);
      const holiday = holidays.find((h) => isHoliday(d, [h]));
      const off = leave.find((l) => l.start <= d && l.end >= d);
      const weekend = weekday(d) === 0 || weekday(d) === 6;
      const status = r?.clockIn ? (minutesOfDay(r.clockIn) > startMin ? "late" : "on_time")
        : holiday ? "holiday" : off ? (/sick/i.test(off.type) ? "sick" : "leave")
        : d > today || weekend || (me.startDate && d < me.startDate) ? "none" : d === today ? "today" : "missed";
      days.push({
        date: d, status, clockIn: r?.clockIn ?? null, clockOut: r?.clockOut ?? null, minutes: r?.clockIn ? minutesOf(r) : null,
        label: holiday?.name ?? off?.type ?? null,
      });
    }
    const inMonth = rows.filter((r) => r.workDate >= first && r.workDate <= last && r.clockIn);
    const prev = rows.filter((r) => r.workDate >= prevFirst && r.workDate <= prevLast && r.clockIn);
    const recent = rows.filter((r) => r.workDate >= usualFrom && r.clockIn && r.clockOut);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    return {
      month, workdayStart, days,
      totals: {
        minutes: inMonth.reduce((a, r) => a + minutesOf(r), 0), prevMinutes: prev.reduce((a, r) => a + minutesOf(r), 0),
        worked: inMonth.length, onTime: days.filter((d) => d.status === "on_time").length, late: days.filter((d) => d.status === "late").length,
      },
      usual: recent.length ? {
        clockIn: avg(recent.map((r) => minutesOfDay(r.clockIn!))), clockOut: avg(recent.map((r) => minutesOfDay(r.clockOut!))),
        breakMinutes: avg(recent.map(breakMin)), days: recent.length,
      } : null,
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
