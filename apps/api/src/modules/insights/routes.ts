import type { FastifyInstance } from "fastify";
import ExcelJS from "exceljs";
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql as dsql } from "drizzle-orm";
import { WORKSPACE_LABELS, type Workspace } from "@windveal/shared";
import { db } from "../../db/client";
import {
  applications, approvals, deals, departments, employees, jobs, leaveRequests, leaveTypes, memberships, tasks, users,
} from "../../db/schema";
import { can, requireAccess, type OrgContext } from "../../lib/context";
import { badRequest, forbidden, notFound } from "../../lib/http";
import { audit } from "../../lib/audit";
import { safeCell, toCsv } from "../../lib/csv";

// ---------------- ranges ----------------

export type RangeKey = "3m" | "month" | "quarter" | "year";
const RANGE_LABELS: Record<RangeKey, { label: string; compare: string }> = {
  "3m": { label: "Last 3 months", compare: "the 3 months before" },
  month: { label: "This month", compare: "the same days before" },
  quarter: { label: "This quarter", compare: "the period before" },
  year: { label: "This year", compare: "the period before" },
};
const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function rangeOf(key: string | undefined, now = new Date()) {
  const k: RangeKey = key === "month" || key === "quarter" || key === "year" ? key : "3m";
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let start: Date;
  if (k === "month") start = new Date(Date.UTC(y, m, 1));
  else if (k === "quarter") start = new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
  else if (k === "year") start = new Date(Date.UTC(y, 0, 1));
  else start = new Date(Date.UTC(y, m - 3, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()));
  const end = now;
  const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
  return { key: k, start, end, prevStart, prevEnd: start, ...RANGE_LABELS[k] };
}
type Range = ReturnType<typeof rangeOf>;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const pctChange = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
const round1 = (n: number) => Math.round(n * 10) / 10;
const sees = (ctx: OrgContext, ws: Workspace) => ctx.access[ws] !== "none";

/** First day (UTC) of each of the last `n` months, oldest first. */
function lastMonths(n: number, now = new Date()) {
  const out: { start: Date; end: Date; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
    out.push({ start: s, end: e, label: MONTHS[s.getUTCMonth()]! });
  }
  return out;
}

// ---------------- shared queries ----------------

const ACTIVE_STATUSES = ["active", "onboarding", "on_leave", "leaving"] as const;

async function revenueWon(orgId: string, from: Date, to: Date, owner?: string) {
  const [r] = await db.select({ v: dsql<string>`coalesce(sum(${deals.value}),0)`, n: dsql<number>`count(*)::int` }).from(deals)
    .where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), eq(deals.status, "won"), gte(deals.wonAt, from), lt(deals.wonAt, to), owner ? eq(deals.ownerUserId, owner) : undefined));
  return { value: Number(r?.v ?? 0), count: r?.n ?? 0 };
}

async function dealsLost(orgId: string, from: Date, to: Date, owner?: string) {
  const [r] = await db.select({ n: dsql<number>`count(*)::int` }).from(deals)
    .where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), eq(deals.status, "lost"), gte(deals.lostAt, from), lt(deals.lostAt, to), owner ? eq(deals.ownerUserId, owner) : undefined));
  return r?.n ?? 0;
}

async function headcount(orgId: string) {
  const [r] = await db.select({ n: dsql<number>`count(*)::int` }).from(employees)
    .where(and(eq(employees.orgId, orgId), isNull(employees.deletedAt), inArray(employees.status, [...ACTIVE_STATUSES])));
  return r?.n ?? 0;
}

async function starters(orgId: string, from: Date, to: Date) {
  const [r] = await db.select({ n: dsql<number>`count(*)::int` }).from(employees)
    .where(and(eq(employees.orgId, orgId), isNull(employees.deletedAt), gte(employees.startDate, ymd(from)), dsql`${employees.startDate} <= ${ymd(to)}`));
  return r?.n ?? 0;
}

async function leavers(orgId: string, from: Date, to: Date) {
  const [r] = await db.select({ n: dsql<number>`count(*)::int` }).from(employees)
    .where(and(eq(employees.orgId, orgId), isNull(employees.deletedAt), eq(employees.status, "left"), gte(employees.endDate, ymd(from)), dsql`${employees.endDate} <= ${ymd(to)}`));
  return r?.n ?? 0;
}

async function tasksOnTime(orgId: string, from: Date, to: Date) {
  const [r] = await db.select({
    total: dsql<number>`count(*)::int`,
    onTime: dsql<number>`count(*) filter (where ${tasks.completedAt} <= ${tasks.dueAt})::int`,
  }).from(tasks).where(and(eq(tasks.orgId, orgId), isNull(tasks.deletedAt), eq(tasks.status, "done"), isNotNull(tasks.dueAt), gte(tasks.completedAt, from), lt(tasks.completedAt, to)));
  const total = r?.total ?? 0;
  return { total, onTime: r?.onTime ?? 0, pct: total ? Math.round(((r?.onTime ?? 0) / total) * 100) : null };
}

async function daysToHire(orgId: string, from: Date, to: Date) {
  const [r] = await db.select({
    avg: dsql<string | null>`avg(extract(epoch from (${applications.hiredAt} - ${applications.createdAt})) / 86400)`,
    n: dsql<number>`count(*)::int`,
  }).from(applications).where(and(eq(applications.orgId, orgId), isNull(applications.deletedAt), gte(applications.hiredAt, from), lt(applications.hiredAt, to)));
  return { avg: r?.avg === null || r?.avg === undefined ? null : Math.round(Number(r.avg)), hires: r?.n ?? 0 };
}

async function headcountByDepartment(orgId: string) {
  const rows = await db.select({ name: departments.name, n: dsql<number>`count(*)::int` }).from(employees)
    .leftJoin(departments, and(eq(departments.id, employees.departmentId), isNull(departments.deletedAt)))
    .where(and(eq(employees.orgId, orgId), isNull(employees.deletedAt), inArray(employees.status, [...ACTIVE_STATUSES])))
    .groupBy(departments.name);
  return rows.map((r) => ({ label: r.name ?? "No department", value: r.n })).sort((a, b) => b.value - a.value);
}

async function leaveByType(orgId: string, from: Date, to: Date) {
  const rows = await db.select({ name: leaveTypes.name, days: dsql<string>`coalesce(sum(${leaveRequests.days}),0)` }).from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
    .where(and(eq(leaveRequests.orgId, orgId), isNull(leaveRequests.deletedAt), eq(leaveRequests.status, "approved"),
      gte(leaveRequests.startDate, ymd(from)), dsql`${leaveRequests.startDate} <= ${ymd(to)}`))
    .groupBy(leaveTypes.name);
  return rows.map((r) => ({ label: r.name, value: round1(Number(r.days)) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}

// ---------------- report shapes ----------------

type Format = "text" | "number" | "money" | "percent" | "days" | "years";
type Kpi = { key: string; label: string; value: number | null; previous?: number | null; format: Format; note?: string; definition: string };
type Column = { key: string; label: string; format: Format };
type Table = { columns: Column[]; rows: Record<string, string | number | null>[]; total: Record<string, string | number | null> | null };
type Chart = { key: string; title: string; subtitle: string; kind: "bar" | "hbar" | "line"; format: Format; data: { label: string; value: number }[] };
type Report = {
  name: string; title: string; range: { key: string; label: string; compare: string; start: string; end: string };
  restricted: boolean; kpis: Kpi[]; charts: Chart[]; table: Table; definitions: Record<string, string>; notes: string[]; filters?: Record<string, unknown>;
};

const rangeView = (r: Range) => ({ key: r.key, label: r.label, compare: r.compare, start: r.start.toISOString(), end: r.end.toISOString() });
const defsOf = (kpis: Kpi[], extra: Record<string, string> = {}) => ({ ...Object.fromEntries(kpis.map((k) => [k.key, k.definition])), ...extra });
const emptyTable = (columns: Column[]): Table => ({ columns, rows: [], total: null });

function twoWeekBuckets(range: Range) {
  const span = range.end.getTime() - range.start.getTime();
  const out: { start: Date; end: Date; label: string }[] = [];
  if (span > 120 * DAY) {
    let s = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1));
    while (s < range.end) {
      const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
      out.push({ start: s < range.start ? range.start : s, end: e > range.end ? range.end : e, label: MONTHS[s.getUTCMonth()]! });
      s = e;
    }
    return { buckets: out, every: "Every month" };
  }
  let s = range.start;
  while (s < range.end) {
    const e = new Date(Math.min(s.getTime() + 14 * DAY, range.end.getTime()));
    const mid = new Date((s.getTime() + e.getTime()) / 2);
    out.push({ start: s, end: e, label: `${mid.getUTCDate() <= 15 ? "Early" : "Late"} ${MONTHS[mid.getUTCMonth()]}` });
    s = e;
  }
  return { buckets: out, every: "Every two weeks" };
}

async function salesReport(ctx: OrgContext, range: Range, owner?: string): Promise<Report> {
  const orgId = ctx.org.id;
  const columns: Column[] = [
    { key: "owner", label: "Owner", format: "text" }, { key: "dealsWon", label: "Deals won", format: "number" },
    { key: "valueWon", label: "Value won", format: "money" }, { key: "winRate", label: "Win rate", format: "percent" },
    { key: "openPipeline", label: "Open pipeline", format: "money" },
  ];
  const definitions = {
    revenueWon: "The total value of deals marked Won in the period, using each deal's value on the day it was marked Won.",
    dealsWon: "Deals marked Won in the period, out of all deals closed (won or lost) in the period.",
    winRate: "Deals won divided by all deals closed (won or lost) in the period.",
    averageDeal: "Revenue won divided by the number of deals won in the period.",
    openPipeline: "The total value of deals that are still open today.",
  };
  const base = { name: "sales", title: "Sales report", range: rangeView(range), notes: [] as string[] };
  if (!sees(ctx, "crm")) return { ...base, restricted: true, kpis: [], charts: [], table: emptyTable(columns), definitions };

  const [cur, prev, lostCur, lostPrev] = await Promise.all([
    revenueWon(orgId, range.start, range.end, owner), revenueWon(orgId, range.prevStart, range.prevEnd, owner),
    dealsLost(orgId, range.start, range.end, owner), dealsLost(orgId, range.prevStart, range.prevEnd, owner),
  ]);
  const closed = cur.count + lostCur;
  const winRate = closed ? Math.round((cur.count / closed) * 100) : null;
  const prevClosed = prev.count + lostPrev;
  const prevWinRate = prevClosed ? Math.round((prev.count / prevClosed) * 100) : null;
  const avg = cur.count ? cur.value / cur.count : null;
  const prevAvg = prev.count ? prev.value / prev.count : null;
  const kpis: Kpi[] = [
    { key: "revenueWon", label: "Revenue won", value: cur.value, previous: prev.value, format: "money", definition: definitions.revenueWon },
    { key: "dealsWon", label: "Deals won", value: cur.count, format: "number", note: `of ${closed} closed`, definition: definitions.dealsWon },
    { key: "winRate", label: "Win rate", value: winRate, previous: prevWinRate, format: "percent", definition: definitions.winRate },
    { key: "averageDeal", label: "Average deal", value: avg, previous: prevAvg, format: "money", definition: definitions.averageDeal },
  ];

  // Series across the range.
  const { buckets, every } = twoWeekBuckets(range);
  const wonRows = await db.select({ value: deals.value, wonAt: deals.wonAt }).from(deals)
    .where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), eq(deals.status, "won"), gte(deals.wonAt, range.start), lt(deals.wonAt, range.end), owner ? eq(deals.ownerUserId, owner) : undefined));
  const series = buckets.map((b) => ({
    label: b.label,
    value: wonRows.filter((d) => d.wonAt! >= b.start && d.wonAt! < b.end).reduce((a, d) => a + Number(d.value), 0),
  }));
  const first = buckets[0]?.start, last = buckets[buckets.length - 1]?.start;
  const fmtMonth = (d?: Date) => (d ? new Date(d).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }) : "");

  // Table by owner.
  const byOwner = await db.select({
    owner: deals.ownerUserId,
    won: dsql<number>`count(*) filter (where ${deals.status} = 'won' and ${deals.wonAt} >= ${range.start.toISOString()}::timestamptz and ${deals.wonAt} < ${range.end.toISOString()}::timestamptz)::int`,
    value: dsql<string>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won' and ${deals.wonAt} >= ${range.start.toISOString()}::timestamptz and ${deals.wonAt} < ${range.end.toISOString()}::timestamptz),0)`,
    lost: dsql<number>`count(*) filter (where ${deals.status} = 'lost' and ${deals.lostAt} >= ${range.start.toISOString()}::timestamptz and ${deals.lostAt} < ${range.end.toISOString()}::timestamptz)::int`,
    open: dsql<string>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'open'),0)`,
  }).from(deals).where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), owner ? eq(deals.ownerUserId, owner) : undefined)).groupBy(deals.ownerUserId);
  const people = await ownerList(orgId);
  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? "Former member" : "No owner");
  const rows = byOwner
    .filter((r) => r.won || r.lost || Number(r.open))
    .map((r) => ({
      owner: nameOf(r.owner), ownerId: r.owner, dealsWon: r.won, valueWon: Number(r.value),
      winRate: r.won + r.lost ? Math.round((r.won / (r.won + r.lost)) * 100) : null, openPipeline: Number(r.open),
    }))
    .sort((a, b) => b.valueWon - a.valueWon || b.openPipeline - a.openPipeline);
  const tw = rows.reduce((a, r) => a + r.dealsWon, 0);
  const tl = byOwner.reduce((a, r) => a + r.lost, 0);
  const total = rows.length ? {
    owner: "Total", dealsWon: tw, valueWon: rows.reduce((a, r) => a + r.valueWon, 0),
    winRate: tw + tl ? Math.round((tw / (tw + tl)) * 100) : null, openPipeline: rows.reduce((a, r) => a + r.openPipeline, 0),
  } : null;
  return {
    ...base, restricted: false, kpis,
    charts: [{
      key: "revenue", title: "Revenue won over time", kind: "bar", format: "money", data: series,
      subtitle: `${every}, ${fmtMonth(first)}${fmtMonth(last) && fmtMonth(last) !== fmtMonth(first) ? ` to ${fmtMonth(last)}` : ""}`,
    }],
    table: { columns, rows, total }, definitions,
    filters: { owner: owner ?? null, owners: people },
    notes: closed === 0 ? ["No deals closed in this period yet."] : [],
  };
}

async function ownerList(orgId: string) {
  return db.select({ id: users.id, name: users.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), isNull(memberships.deletedAt))).orderBy(users.name);
}

async function peopleReport(ctx: OrgContext, range: Range): Promise<Report> {
  const orgId = ctx.org.id;
  const columns: Column[] = [
    { key: "department", label: "Department", format: "text" }, { key: "headcount", label: "Headcount", format: "number" },
    { key: "starters", label: "Starters", format: "number" }, { key: "leavers", label: "Leavers", format: "number" },
    { key: "averageTenure", label: "Average tenure", format: "years" },
  ];
  const definitions = {
    headcount: "People whose status is active, onboarding, on leave or leaving, today.",
    starters: "People whose start date falls in the period.",
    leavers: "People marked as left whose end date falls in the period.",
    averageTenure: "Average years from start date to today for people counted in headcount who have a start date.",
    leaveByType: "Approved leave days, by leave type, for leave starting in the period.",
  };
  const base = { name: "people", title: "People report", range: rangeView(range), notes: [] as string[] };
  if (!sees(ctx, "people")) return { ...base, restricted: true, kpis: [], charts: [], table: emptyTable(columns), definitions };

  const staff = await db.select({ departmentId: employees.departmentId, status: employees.status, startDate: employees.startDate, endDate: employees.endDate })
    .from(employees).where(and(eq(employees.orgId, orgId), isNull(employees.deletedAt)));
  const depts = await db.select({ id: departments.id, name: departments.name }).from(departments).where(and(eq(departments.orgId, orgId), isNull(departments.deletedAt)));
  const from = ymd(range.start), to = ymd(range.end);
  const now = Date.now();
  const isActive = (s: string) => (ACTIVE_STATUSES as readonly string[]).includes(s);
  const agg = (list: typeof staff) => {
    const active = list.filter((e) => isActive(e.status));
    const tenures = active.filter((e) => e.startDate && e.startDate <= to).map((e) => (now - new Date(`${e.startDate}T00:00:00Z`).getTime()) / (365.25 * DAY));
    return {
      headcount: active.length,
      starters: list.filter((e) => e.startDate && e.startDate >= from && e.startDate <= to).length,
      leavers: list.filter((e) => e.status === "left" && e.endDate && e.endDate >= from && e.endDate <= to).length,
      averageTenure: tenures.length ? round1(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null,
    };
  };
  const all = agg(staff);
  const prevStarters = await starters(orgId, range.prevStart, range.prevEnd);
  const prevLeavers = await leavers(orgId, range.prevStart, range.prevEnd);
  const groups = new Map<string | null, typeof staff>();
  for (const e of staff) groups.set(e.departmentId, [...(groups.get(e.departmentId) ?? []), e]);
  const rows = [...groups.entries()].map(([id, list]) => ({ department: depts.find((d) => d.id === id)?.name ?? "No department", ...agg(list) }))
    .filter((r) => r.headcount || r.starters || r.leavers).sort((a, b) => b.headcount - a.headcount);
  const leave = await leaveByType(orgId, range.start, range.end);
  const kpis: Kpi[] = [
    { key: "headcount", label: "Headcount", value: all.headcount, format: "number", note: `${all.starters} started in this period`, definition: definitions.headcount },
    { key: "starters", label: "Starters", value: all.starters, previous: prevStarters, format: "number", definition: definitions.starters },
    { key: "leavers", label: "Leavers", value: all.leavers, previous: prevLeavers, format: "number", definition: definitions.leavers },
    { key: "averageTenure", label: "Average tenure", value: all.averageTenure, format: "years", definition: definitions.averageTenure },
  ];
  return {
    ...base, restricted: false, kpis,
    charts: [
      { key: "headcount", title: "Headcount by department", subtitle: "Active employees today", kind: "hbar", format: "number", data: rows.filter((r) => r.headcount).map((r) => ({ label: r.department, value: r.headcount })) },
      { key: "leave", title: "Leave taken", subtitle: `Approved days, ${range.label.toLowerCase()}`, kind: "bar", format: "number", data: leave },
    ],
    table: { columns, rows, total: rows.length ? { department: "Total", ...all } : null },
    definitions,
    notes: staff.length ? [] : ["No employees added yet."],
  };
}

async function hiringReport(ctx: OrgContext, range: Range): Promise<Report> {
  const orgId = ctx.org.id;
  const columns: Column[] = [
    { key: "job", label: "Job", format: "text" }, { key: "status", label: "Status", format: "text" },
    { key: "applications", label: "Applications", format: "number" }, { key: "hired", label: "Hired", format: "number" },
    { key: "daysToHire", label: "Days to hire", format: "days" },
  ];
  const definitions = {
    applications: "Applications received in the period.",
    hired: "Applications marked Hired in the period.",
    daysToHire: "Average days from application to being hired, for people hired in the period.",
    openRoles: "Job openings whose status is open today.",
    bySource: "Applications received in the period, by where the candidate came from.",
  };
  const base = { name: "hiring", title: "Hiring report", range: rangeView(range), notes: [] as string[] };
  if (!sees(ctx, "recruitment")) return { ...base, restricted: true, kpis: [], charts: [], table: emptyTable(columns), definitions };

  const apps = await db.select({ jobId: applications.jobId, stage: applications.stage, source: applications.source, createdAt: applications.createdAt, hiredAt: applications.hiredAt })
    .from(applications).where(and(eq(applications.orgId, orgId), isNull(applications.deletedAt)));
  const jobList = await db.select({ id: jobs.id, title: jobs.title, status: jobs.status }).from(jobs).where(and(eq(jobs.orgId, orgId), isNull(jobs.deletedAt)));
  const inRange = (d: Date | null, a = range.start, b = range.end) => !!d && d >= a && d < b;
  const received = apps.filter((a) => inRange(a.createdAt));
  const hired = apps.filter((a) => inRange(a.hiredAt));
  const avgDays = (list: typeof apps) => {
    if (!list.length) return null;
    return Math.round(list.reduce((s, a) => s + (a.hiredAt!.getTime() - a.createdAt.getTime()) / DAY, 0) / list.length);
  };
  const prevHired = apps.filter((a) => inRange(a.hiredAt, range.prevStart, range.prevEnd));
  const count = (list: typeof apps, key: "stage" | "source") => {
    const m = new Map<string, number>();
    for (const a of list) m.set(a[key], (m.get(a[key]) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const openRoles = jobList.filter((j) => j.status === "open").length;
  const kpis: Kpi[] = [
    { key: "applications", label: "Applications", value: received.length, previous: apps.filter((a) => inRange(a.createdAt, range.prevStart, range.prevEnd)).length, format: "number", definition: definitions.applications },
    { key: "hired", label: "Hired", value: hired.length, previous: prevHired.length, format: "number", definition: definitions.hired },
    { key: "daysToHire", label: "Days to hire", value: avgDays(hired), previous: avgDays(prevHired), format: "days", definition: definitions.daysToHire },
    { key: "openRoles", label: "Open roles", value: openRoles, format: "number", definition: definitions.openRoles },
  ];
  const rows = jobList.map((j) => {
    const mine = apps.filter((a) => a.jobId === j.id);
    const h = mine.filter((a) => inRange(a.hiredAt));
    return { job: j.title, status: j.status === "open" ? "Open" : j.status === "draft" ? "Draft" : "Closed", applications: mine.filter((a) => inRange(a.createdAt)).length, hired: h.length, daysToHire: avgDays(h) };
  }).filter((r) => r.applications || r.hired || r.status === "Open").sort((a, b) => b.applications - a.applications);
  return {
    ...base, restricted: false, kpis,
    charts: [
      { key: "stages", title: "Applications by stage", subtitle: "Where this period's applications are now", kind: "bar", format: "number", data: count(received, "stage") },
      { key: "sources", title: "Applications by source", subtitle: "Where candidates came from", kind: "hbar", format: "number", data: count(received, "source") },
    ],
    table: { columns, rows, total: rows.length ? { job: "Total", status: `${openRoles} open`, applications: received.length, hired: hired.length, daysToHire: avgDays(hired) } : null },
    definitions,
    notes: received.length || hired.length ? [] : ["No applications in this period yet."],
  };
}

async function workReport(ctx: OrgContext, range: Range): Promise<Report> {
  const orgId = ctx.org.id;
  const columns: Column[] = [
    { key: "workspace", label: "Workspace", format: "text" }, { key: "done", label: "Tasks done", format: "number" },
    { key: "onTime", label: "Done on time", format: "percent" }, { key: "overdue", label: "Overdue now", format: "number" },
  ];
  const definitions = {
    done: "Tasks marked done in the period.",
    onTime: "Of the tasks done in the period that had a due date, the share finished on or before it.",
    overdue: "Tasks not yet done whose due date has passed, today.",
    approvals: "Approval requests approved or declined in the period.",
  };
  const base = { name: "work", title: "Work report", range: rangeView(range), notes: [] as string[] };
  if (!sees(ctx, "workflows")) return { ...base, restricted: true, kpis: [], charts: [], table: emptyTable(columns), definitions };

  const now = new Date();
  const byWs = await db.select({
    workspace: tasks.workspace,
    done: dsql<number>`count(*) filter (where ${tasks.status} = 'done' and ${tasks.completedAt} >= ${range.start.toISOString()}::timestamptz and ${tasks.completedAt} < ${range.end.toISOString()}::timestamptz)::int`,
    withDue: dsql<number>`count(*) filter (where ${tasks.status} = 'done' and ${tasks.dueAt} is not null and ${tasks.completedAt} >= ${range.start.toISOString()}::timestamptz and ${tasks.completedAt} < ${range.end.toISOString()}::timestamptz)::int`,
    onTime: dsql<number>`count(*) filter (where ${tasks.status} = 'done' and ${tasks.completedAt} <= ${tasks.dueAt} and ${tasks.completedAt} >= ${range.start.toISOString()}::timestamptz and ${tasks.completedAt} < ${range.end.toISOString()}::timestamptz)::int`,
    overdue: dsql<number>`count(*) filter (where ${tasks.status} <> 'done' and ${tasks.dueAt} < ${now.toISOString()}::timestamptz)::int`,
  }).from(tasks).where(and(eq(tasks.orgId, orgId), isNull(tasks.deletedAt))).groupBy(tasks.workspace);
  const [ap] = await db.select({ n: dsql<number>`count(*)::int` }).from(approvals)
    .where(and(eq(approvals.orgId, orgId), isNull(approvals.deletedAt), inArray(approvals.status, ["approved", "declined"]), gte(approvals.decidedAt, range.start), lt(approvals.decidedAt, range.end)));
  const [apPrev] = await db.select({ n: dsql<number>`count(*)::int` }).from(approvals)
    .where(and(eq(approvals.orgId, orgId), isNull(approvals.deletedAt), inArray(approvals.status, ["approved", "declined"]), gte(approvals.decidedAt, range.prevStart), lt(approvals.decidedAt, range.prevEnd)));
  const cur = await tasksOnTime(orgId, range.start, range.end);
  const prev = await tasksOnTime(orgId, range.prevStart, range.prevEnd);
  const label = (w: string) => WORKSPACE_LABELS[w as Workspace] ?? w;
  const rows = byWs.filter((r) => r.done || r.overdue).map((r) => ({
    workspace: label(r.workspace), done: r.done, onTime: r.withDue ? Math.round((r.onTime / r.withDue) * 100) : null, overdue: r.overdue,
  })).sort((a, b) => b.done - a.done);
  const doneTotal = rows.reduce((a, r) => a + r.done, 0);
  const overdueTotal = rows.reduce((a, r) => a + r.overdue, 0);
  const kpis: Kpi[] = [
    { key: "done", label: "Tasks done", value: doneTotal, previous: null, format: "number", definition: definitions.done },
    { key: "onTime", label: "Done on time", value: cur.pct, previous: prev.pct, format: "percent", definition: definitions.onTime },
    { key: "overdue", label: "Overdue now", value: overdueTotal, format: "number", definition: definitions.overdue },
    { key: "approvals", label: "Approvals decided", value: ap?.n ?? 0, previous: apPrev?.n ?? 0, format: "number", definition: definitions.approvals },
  ];
  return {
    ...base, restricted: false, kpis,
    charts: [{ key: "done", title: "Tasks done by workspace", subtitle: range.label, kind: "hbar", format: "number", data: rows.filter((r) => r.done).map((r) => ({ label: r.workspace, value: r.done })) }],
    table: { columns, rows, total: rows.length ? { workspace: "Total", done: doneTotal, onTime: cur.pct, overdue: overdueTotal } : null },
    definitions,
    notes: doneTotal || overdueTotal ? [] : ["No tasks finished in this period yet."],
  };
}

const REPORTS = {
  sales: (ctx: OrgContext, r: Range, q: Q) => salesReport(ctx, r, q.owner && q.owner !== "everyone" ? q.owner : undefined),
  people: (ctx: OrgContext, r: Range) => peopleReport(ctx, r),
  hiring: (ctx: OrgContext, r: Range) => hiringReport(ctx, r),
  work: (ctx: OrgContext, r: Range) => workReport(ctx, r),
} as const;
type Q = { range?: string; owner?: string; format?: string; columns?: string };

function formatForSheet(v: string | number | null, f: Format, currency: string) {
  if (v === null || v === undefined) return "";
  if (f === "percent" && typeof v === "number") return `${v}%`;
  if (f === "money" && typeof v === "number") return Math.round(v * 100) / 100;
  if (f === "days" && typeof v === "number") return v;
  void currency;
  return v;
}

export default async function insightsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: Q }>("/api/insights/overview", async (req) => {
    const ctx = await requireAccess(req, "insights", "view");
    const orgId = ctx.org.id;
    const range = rangeOf(req.query.range);
    const months = lastMonths(6);
    const definitions = {
      revenueWon: "The total value of deals marked Won in the period, compared with the same length of time just before it.",
      headcount: "People whose status is active, onboarding, on leave or leaving, today. Starters are people whose start date falls in the period.",
      tasksOnTime: "Of the tasks marked done in the period that had a due date, the share finished on or before the due date.",
      daysToHire: "Average days from application to being hired, for people hired in the period.",
      revenueByMonth: "Value of deals marked Won in each of the last six months.",
      headcountByDepartment: "People counted in headcount today, by department.",
      daysToHireByMonth: "Average days from application to hired, for people hired in each of the last six months.",
      leaveByType: "Approved leave days, by leave type, for leave starting in the period.",
    };
    const out: Record<string, unknown> = { range: rangeView(range), currency: ctx.org.currency, definitions, restricted: [] as string[] };
    const restricted = out.restricted as string[];

    if (sees(ctx, "crm")) {
      const [cur, prev] = await Promise.all([revenueWon(orgId, range.start, range.end), revenueWon(orgId, range.prevStart, range.prevEnd)]);
      const monthly = await Promise.all(months.map((m) => revenueWon(orgId, m.start, m.end)));
      out.revenueWon = { value: cur.value, previous: prev.value, change: pctChange(cur.value, prev.value), deals: cur.count };
      out.revenueByMonth = months.map((m, i) => ({ label: m.label, value: monthly[i]!.value }));
    } else restricted.push("crm");

    if (sees(ctx, "people")) {
      const [hc, st, byDept, leave] = await Promise.all([
        headcount(orgId), starters(orgId, range.start, range.end), headcountByDepartment(orgId), leaveByType(orgId, range.start, range.end),
      ]);
      out.headcount = { value: hc, starters: st };
      out.headcountByDepartment = byDept;
      out.leaveByType = leave;
    } else restricted.push("people");

    if (sees(ctx, "workflows")) {
      const [cur, prev] = await Promise.all([tasksOnTime(orgId, range.start, range.end), tasksOnTime(orgId, range.prevStart, range.prevEnd)]);
      out.tasksOnTime = { value: cur.pct, previous: prev.pct, done: cur.total };
    } else restricted.push("workflows");

    if (sees(ctx, "recruitment")) {
      const [cur, prev] = await Promise.all([daysToHire(orgId, range.start, range.end), daysToHire(orgId, range.prevStart, range.prevEnd)]);
      const monthly = await Promise.all(months.map((m) => daysToHire(orgId, m.start, m.end)));
      out.daysToHire = { value: cur.avg, previous: prev.avg, hires: cur.hires };
      out.daysToHireByMonth = months.map((m, i) => ({ label: m.label, value: monthly[i]!.avg ?? 0, hires: monthly[i]!.hires }));
    } else restricted.push("recruitment");

    return out;
  });

  app.get<{ Params: { name: string }; Querystring: Q }>("/api/insights/reports/:name", async (req) => {
    const ctx = await requireAccess(req, "insights", "view");
    const fn = REPORTS[req.params.name as keyof typeof REPORTS];
    if (!fn) throw notFound("That report");
    return fn(ctx, rangeOf(req.query.range), req.query);
  });

  app.get<{ Params: { name: string }; Querystring: Q }>("/api/insights/reports/:name/export", async (req, reply) => {
    const ctx = await requireAccess(req, "insights", "view");
    if (!can(ctx, "export_data")) throw forbidden("You don't have permission to export data. Ask an admin.");
    const fn = REPORTS[req.params.name as keyof typeof REPORTS];
    if (!fn) throw notFound("That report");
    const format = req.query.format === "xlsx" ? "xlsx" : req.query.format === "csv" || !req.query.format ? "csv" : null;
    if (!format) throw badRequest("Choose Excel or CSV.");
    const range = rangeOf(req.query.range);
    const report = await fn(ctx, range, req.query);
    if (report.restricted) throw forbidden("You don't have access to the records behind this report.");
    const wanted = req.query.columns ? req.query.columns.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const columns = wanted ? report.table.columns.filter((c) => wanted.includes(c.key)) : report.table.columns;
    if (!columns.length) throw badRequest("Choose at least one column.");
    const allRows = [...report.table.rows, ...(report.table.total ? [report.table.total] : [])];
    const matrix = allRows.map((r) => columns.map((c) => formatForSheet(r[c.key] ?? null, c.format, ctx.org.currency)));
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `windveal-${report.name}-report-${stamp}`;

    await audit(ctx, {
      action: "insights.exported", category: "data", entityType: "report",
      summary: `${ctx.user.name} exported the ${report.title.replace(/ report$/, "")} report (${range.label.toLowerCase()}, ${format.toUpperCase()})`,
      meta: { report: report.name, range: range.key, format, columns: columns.map((c) => c.key), rows: report.table.rows.length },
    });

    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    if (format === "csv") {
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="${base}.csv"`);
      return reply.send(toCsv(columns.map((c) => c.label), matrix));
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = "WindVeal";
    const ws = wb.addWorksheet(report.title.slice(0, 31));
    ws.addRow([safeCell(report.title)]).font = { bold: true, size: 14 };
    ws.addRow([safeCell(`${range.label} · ${ctx.org.tradingName ?? ctx.org.legalName}`)]);
    ws.addRow([]);
    const head = ws.addRow(columns.map((c) => safeCell(c.label)));
    head.font = { bold: true };
    head.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF3FF" } }; });
    for (const [i, r] of matrix.entries()) {
      const row = ws.addRow(r.map((v) => (typeof v === "number" ? v : safeCell(v))));
      if (report.table.total && i === matrix.length - 1) row.font = { bold: true };
    }
    columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.format === "text" ? 28 : 16;
      if (c.format === "money") col.numFmt = "#,##0";
    });
    const buf = await wb.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="${base}.xlsx"`);
    return reply.send(Buffer.from(buf as ArrayBuffer));
  });
}
