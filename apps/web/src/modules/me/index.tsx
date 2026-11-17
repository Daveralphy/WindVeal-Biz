import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { Button, Card, EmptyState, Loading, PageHeader, Pill, Select } from "@windveal/ui";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { fmtDate, fmtTime } from "../../lib/format";
import { fmtDuration, useMyClock } from "../people/clock";
import { LeaveRequestRow, RequestLeaveModal, balanceText } from "../people/Leave";
import type { Balance, LeaveRequest } from "../people/lib";
import { TaskDrawer, TaskList, useTaskList } from "../workflows/tasks";
import { Board } from "./board";
import "./me.css";

type Summary = {
  employee: { id: string; firstName: string; jobTitle: string | null; startDate: string | null; status: string } | null;
  onboarding: boolean; nextStep: { title: string; dueAt: string | null } | null;
};
type Day = { date: string; clockIn: string | null; clockOut: string | null; breaks: number; corrected: boolean; note: string | null; minutes: number | null };
type Today = { record: { clockIn: string | null; clockOut: string | null; onBreak?: boolean } | null };

/** What My Workspace has for this person (e.g. whether they're onboarding). */
export function useMySummary() {
  return useQuery({ queryKey: ["my", "summary"], queryFn: () => api.get<Summary>("/api/my/summary"), staleTime: 60_000 });
}
const useMyLeave = () => useQuery({ queryKey: ["people", "leave", "mine"], queryFn: () => api.get<LeaveRequest[]>("/api/people/leave/requests?scope=mine") });
const useMyBalances = () => useQuery({ queryKey: ["people", "balances", "me"], queryFn: () => api.get<{ balances: Balance[] }>("/api/people/leave/balances") });
const useMonth = (month: string) => useQuery({ queryKey: ["my", "attendance", month], queryFn: () => api.get<{ days: Day[] }>(`/api/my/attendance?month=${month}`) });

const hours = (m: number | null) => (m == null ? "" : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
const thisMonth = () => new Date().toISOString().slice(0, 7);

/** Attendance > History: each day of a month. */
function History() {
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });
  const [month, setMonth] = useState(months[0]!);
  const q = useMonth(month);
  const total = (q.data?.days ?? []).reduce((a, d) => a + (d.minutes ?? 0), 0);
  return (
    <>
      <div className="toolbar">
        <Select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}
          options={months.map((m) => ({ value: m, label: new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) }))} />
        <span className="grow" />
        {!!q.data?.days.length && <span className="muted">{q.data.days.length} days · {hours(total)} worked</span>}
      </div>
      {q.isLoading ? <Loading /> : !q.data?.days.length ? <Card><EmptyState title="No clock-ins this month">Clock in from the top bar when you start work.</EmptyState></Card> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Day</th><th>In</th><th>Out</th><th className="hide-sm">Breaks</th><th>Worked</th></tr></thead>
            <tbody>{q.data.days.map((d) => (
              <tr key={d.date}>
                <td><b className="ink">{fmtDate(d.date, { weekday: "short", day: "numeric", month: "short" })}</b>{d.corrected && <small className="muted" style={{ display: "block" }}>Corrected by HR{d.note ? `: ${d.note}` : ""}</small>}</td>
                <td>{d.clockIn ? fmtTime(d.clockIn) : "—"}</td>
                <td>{d.clockOut ? fmtTime(d.clockOut) : d.clockIn ? "Still in" : "—"}</td>
                <td className="hide-sm">{d.breaks || "—"}</td>
                <td>{hours(d.minutes)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Leave() {
  const summary = useMySummary();
  const balances = useMyBalances();
  const leave = useMyLeave();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <div className="toolbar"><span className="grow" /><Button icon={<CalendarPlus size={16} />} onClick={() => setAsking(true)}>Ask for leave</Button></div>
      <div className="me-balances">
        {balances.isLoading ? <Loading /> : (balances.data?.balances ?? []).map((b) => (
          <div key={b.leaveTypeId} className="card me-balance"><b className="ink">{b.name}</b><span>{balanceText(b)}</span>{!!b.pending && <small className="muted">{b.pending} waiting for approval</small>}</div>
        ))}
      </div>
      <Card title="Your requests" flush={!!leave.data?.length}>
        {leave.isLoading ? <Loading /> : !leave.data?.length ? <EmptyState title="No leave requests yet">Ask for leave and your manager will be told.</EmptyState>
          : leave.data.map((r) => <LeaveRequestRow key={r.id} r={r} showStatus />)}
      </Card>
      <RequestLeaveModal open={asking} onClose={() => setAsking(false)} myEmployeeId={summary.data?.employee?.id} />
    </>
  );
}

function Pay() {
  const { money } = useSession();
  const q = useQuery({ queryKey: ["my", "pay"], queryFn: () => api.get<{ pay: { salaryAmount: string | null; currency: string; payFrequency: string | null; bankName: string | null; accountNumber: string | null; updatedAt: string } | null; employmentType: string | null; startDate: string | null }>("/api/my/pay") });
  if (q.isLoading) return <Loading />;
  const p = q.data?.pay;
  const masked = (s: string | null) => (s ? `•••• ${s.slice(-4)}` : null);
  const rows: [string, string | null | undefined][] = [
    ["Salary", p?.salaryAmount ? `${money(p.salaryAmount)}${p.payFrequency ? ` ${p.payFrequency.toLowerCase()}` : ""}` : null],
    ["Employment", q.data?.employmentType], ["Started", q.data?.startDate ? fmtDate(q.data.startDate) : null],
    ["Bank", p?.bankName], ["Account", masked(p?.accountNumber ?? null)],
  ];
  return (
    <>
      <Card title="Your pay" subtitle={p ? `Last updated ${fmtDate(p.updatedAt)}. Only you and HR can see this.` : "Only you and HR can see this."}>
        {!p ? <EmptyState title="No pay details yet">HR hasn't added your pay details. Ask them if something should be here.</EmptyState> : (
          <dl className="kv pf-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="muted">Not given</span>}</dd></div>)}</dl>
        )}
      </Card>
    </>
  );
}

function Payslips() {
  return <Card><EmptyState title="Payslips are coming">Once WindVeal runs payroll, each month's payslip will be here to view and download.</EmptyState></Card>;
}



/** The tasks given to this person from anywhere in WindVeal; no Workflows access needed. */
function MyTasks() {
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error } = useTaskList("mine", { q: "", workspace: "", priority: "", createdBy: "" });
  const open = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("task", id); else p.delete("task"); setParams(p, { replace: true }); };
  return (
    <>
      <TaskList data={data} isLoading={isLoading} error={error} onOpen={open} filtered={false} onNew={() => {}} canCreate={false}
        emptyText="Tasks given to you, from anywhere in WindVeal, show up here." />
      <TaskDrawer id={params.get("task")} onClose={() => open(null)} />
    </>
  );
}

// ---------------- Attendance > Today ----------------

const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type Holiday = { id: string; name: string; day: string; recurring: boolean };
const useHolidays = () => useQuery({ queryKey: ["people", "holidays"], queryFn: () => api.get<Holiday[]>("/api/people/holidays"), staleTime: 300_000 });
/** The next date a holiday falls on (yearly ones roll forward). */
function nextOf(h: Holiday, from: string) {
  if (!h.recurring) return h.day;
  const md = h.day.slice(5);
  const y = Number(from.slice(0, 4));
  return `${y}-${md}` >= from ? `${y}-${md}` : `${y + 1}-${md}`;
}

/** Today: the clock, this week, this month, and leave beside it. */
function Today() {
  const clock = useMyClock();
  const summary = useMySummary();
  const balances = useMyBalances();
  const leave = useMyLeave();
  const holidays = useHolidays();
  const [asking, setAsking] = useState(false);
  const now = new Date();
  const mon = mondayOf(now);
  const week = Array.from({ length: 5 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const thisM = useMonth(iso(now).slice(0, 7));
  const prevM = useMonth(iso(mon).slice(0, 7));
  const days = new Map([...(prevM.data?.days ?? []), ...(thisM.data?.days ?? [])].map((d) => [d.date, d]));
  const todayIso = iso(now);
  const todayMin = Math.round(clock.workedMs / 60000);
  const weekMinutes = week.reduce((a, d) => a + (iso(d) === todayIso ? todayMin : days.get(iso(d))?.minutes ?? 0), 0);
  const monthDays = thisM.data?.days ?? [];
  const r = clock.record;
  const upcoming = (leave.data ?? []).filter((l) => l.endDate >= todayIso && (l.status === "approved" || l.status === "pending")).slice(0, 3);
  const nextHoliday = (holidays.data ?? []).map((h) => ({ ...h, next: nextOf(h, todayIso) })).filter((h) => h.next >= todayIso).sort((a, b) => a.next.localeCompare(b.next))[0];
  const shown = (balances.data?.balances ?? []).filter((b) => b.daysPerYear != null).slice(0, 2);
  const taken = (balances.data?.balances ?? []).reduce((a, b) => a + b.used, 0);
  return (
    <div className="grid-side side-360 me-today">
      <div>
        <Card title="Today">
          {clock.state === "none" ? <EmptyState title="You're not set up for attendance yet">HR needs to add you to the team first.</EmptyState> : <>
            <div className="me-clock">
              <div>
                <span className="big">{fmtDuration(clock.workedMs)}</span>
                <small>{clock.state === "out" ? "Not clocked in yet" : clock.state === "done" ? `Done for today, ${fmtTime(r!.clockIn!)} to ${fmtTime(r!.clockOut!)}`
                  : clock.state === "break" ? "On a break" : `Working since ${fmtTime(r!.clockIn!)}`}</small>
              </div>
              <span className="grow" />
              {clock.state === "out" && <Button loading={clock.busy} onClick={clock.clockIn}>Clock in</Button>}
              {clock.state === "in" && <><Button variant="secondary" disabled={clock.busy} onClick={clock.pause}>Take a break</Button><Button loading={clock.busy} onClick={() => void clock.clockOut()}>Clock out</Button></>}
              {clock.state === "break" && <Button loading={clock.busy} onClick={clock.resume}>Back from break</Button>}
            </div>
            <div className="me-week">
              {week.map((d) => {
                const k = iso(d), today = k === todayIso, m = today ? todayMin : days.get(k)?.minutes ?? null;
                return <div key={k} className={today ? "today" : ""}>{d.toLocaleDateString("en-GB", { weekday: "short" })}<b>{m ? hours(m) : "-"}</b></div>;
              })}
            </div>
            <p className="muted me-small">This week: {hours(weekMinutes) || "0h 00m"}. If a day looks wrong, ask HR to correct it.</p>
          </>}
          {clock.dialog}
        </Card>
        <Card title="This month">
          {thisM.isLoading ? <Loading /> : (
            <div className="list-row"><div className="grow"><b className="ink">{monthDays.length} day{monthDays.length === 1 ? "" : "s"} worked</b>
              <small className="muted" style={{ display: "block" }}>{hours(monthDays.reduce((a, d) => a + (d.minutes ?? 0), 0)) || "0h 00m"} in total</small></div>
              <Link className="btn btn-secondary btn-sm" to="/me/attendance/history">See each day</Link></div>
          )}
        </Card>
      </div>
      <div>
        <Card title="Leave">
          {balances.isLoading ? <Loading /> : <div className="me-bal">
            {shown.map((b) => <div key={b.leaveTypeId}><b>{b.remaining ?? "-"}</b><small>{b.name} left</small></div>)}
            <div><b>{taken}</b><small>Taken this year</small></div>
          </div>}
          {upcoming.map((l) => (
            <div key={l.id} className="list-row"><div className="grow"><b className="ink">{fmtDate(l.startDate)}{l.endDate !== l.startDate ? ` to ${fmtDate(l.endDate)}` : ""}</b>
              <small className="muted" style={{ display: "block" }}>{l.leaveType?.name ?? "Leave"}, {l.days} day{l.days === 1 ? "" : "s"}</small></div>
              <Pill tone={l.status === "approved" ? "ok" : "warn"}>{l.status === "approved" ? "Approved" : "Waiting"}</Pill></div>
          ))}
          <Button icon={<CalendarPlus size={16} />} style={{ width: "100%", marginTop: 12 }} onClick={() => setAsking(true)}>Request leave</Button>
        </Card>
        {nextHoliday && <Card title="Coming up">
          <div className="list-row"><div className="grow"><b className="ink">{nextHoliday.name}</b>
            <small className="muted" style={{ display: "block" }}>{fmtDate(nextHoliday.next, { weekday: "short", day: "numeric", month: "short" })}, public holiday</small></div></div>
        </Card>}
      </div>
      <RequestLeaveModal open={asking} onClose={() => setAsking(false)} myEmployeeId={summary.data?.employee?.id} />
    </div>
  );
}

/** Attendance > Public holidays: days off for everyone. */
function Holidays() {
  const q = useHolidays();
  const todayIso = iso(new Date());
  const list = (q.data ?? []).map((h) => ({ ...h, next: nextOf(h, todayIso) })).sort((a, b) => a.next.localeCompare(b.next));
  return (
    <Card title="Public holidays" subtitle="Days off for everyone. Leave isn't taken on these days." flush={!!list.length}>
      {q.isLoading ? <Loading /> : !list.length ? <EmptyState title="No public holidays yet">HR adds them in People &amp; HR.</EmptyState>
        : list.map((h) => <div key={h.id} className="list-row"><div className="grow"><b className="ink">{h.name}</b></div><span className="muted">{fmtDate(h.next, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span></div>)}
    </Card>
  );
}

// ---------------- the spaces ----------------

function Space({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  useEffect(() => { document.title = `${title} · WindVeal`; }, [title]);
  return <div className="me"><PageHeader title={title} subtitle={subtitle} />{children}</div>;
}

/**
 * My Workspace: each person's own things, whatever their role, split into spaces (Attendance, Tasks, Finance...).
 * Each space has its own sidebar; nothing here shows anyone else's records.
 */
export default function MySpace() {
  return (
    <Routes>
      <Route index element={<Navigate to="/" replace />} />
      <Route path="attendance" element={<Space title="Attendance" subtitle="Your time and your leave."><Today /></Space>} />
      <Route path="attendance/history" element={<Space title="Attendance" subtitle="Each day you've worked."><History /></Space>} />
      <Route path="attendance/leave" element={<Space title="Attendance" subtitle="Your leave balances and requests."><Leave /></Space>} />
      <Route path="attendance/holidays" element={<Space title="Attendance" subtitle="Public holidays."><Holidays /></Space>} />
      <Route path="tasks" element={<Space title="Tasks" subtitle="Your team's board. Drag cards from list to list."><Board /></Space>} />
      <Route path="tasks/mine" element={<Space title="Tasks" subtitle="Every card that's yours, from every board and anywhere in the business."><MyTasks /></Space>} />
      <Route path="tasks/getting-started" element={<Navigate to="/me/tasks" replace />} />
      <Route path="finance" element={<Space title="Finance" subtitle="Your pay. Only you and HR can see this."><Pay /></Space>} />
      <Route path="finance/payslips" element={<Space title="Finance" subtitle="Your payslips."><Payslips /></Space>} />
      {/* Old addresses (bookmarks, notifications) still land in the right place. */}
      <Route path="leave" element={<Navigate to="/me/attendance/leave" replace />} />
      <Route path="pay" element={<Navigate to="/me/finance" replace />} />
      <Route path="onboarding" element={<Navigate to="/me/tasks" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
