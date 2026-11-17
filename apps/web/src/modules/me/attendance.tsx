import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, EmptyState, Loading, Pill } from "@windveal/ui";
import { api } from "../../lib/api";
import { fmtDate, fmtTime } from "../../lib/format";
import { fmtDuration, useMyClock } from "../people/clock";
import { RequestLeaveModal } from "../people/Leave";
import type { Balance, LeaveRequest } from "../people/lib";
import "./attendance.css";

type Status = "on_time" | "late" | "leave" | "sick" | "holiday" | "missed" | "today" | "none";
type Day = { date: string; status: Status; clockIn: string | null; clockOut: string | null; minutes: number | null; label: string | null };
type Overview = {
  month: string; workdayStart: string; days: Day[];
  totals: { minutes: number; prevMinutes: number; worked: number; onTime: number; late: number };
  usual: { clockIn: number | null; clockOut: number | null; breakMinutes: number | null; days: number } | null;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthOf = (d: Date) => iso(d).slice(0, 7);
const shiftMonth = (m: string, n: number) => { const d = new Date(`${m}-01T00:00:00`); d.setMonth(d.getMonth() + n); return monthOf(d); };
const monthName = (m: string, year = true) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", ...(year ? { year: "numeric" } : {}) });
const hrs = (m: number) => (m >= 600 ? `${Math.round(m / 60)}h` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
const hm = (min: number | null) => (min == null ? "-" : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);

export const useOverview = (month: string) =>
  useQuery({ queryKey: ["my", "attendance", "overview", month], queryFn: () => api.get<Overview>(`/api/my/attendance/overview?month=${month}`) });
const useMyLeave = () => useQuery({ queryKey: ["people", "leave", "mine"], queryFn: () => api.get<LeaveRequest[]>("/api/people/leave/requests?scope=mine") });
const useMyBalances = () => useQuery({ queryKey: ["people", "balances", "me"], queryFn: () => api.get<{ balances: Balance[] }>("/api/people/leave/balances") });

/** What each colour on the calendar means; shown under it, and read out with each day. */
const STATUS: Record<Status, string> = {
  on_time: "On time", late: "Late", leave: "Leave", sick: "Sick", holiday: "Public holiday", missed: "No clock-in", today: "Today", none: "",
};
const LEGEND: Status[] = ["on_time", "late", "leave", "holiday", "missed"];

/** One month, a square per day, coloured by how the day went. */
export function MonthCalendar({ month, setMonth, data, loading }: { month: string; setMonth: (m: string) => void; data?: Overview; loading: boolean }) {
  const first = new Date(`${month}-01T00:00:00`);
  const lead = (first.getDay() + 6) % 7;
  const today = iso(new Date());
  const canNext = month < monthOf(new Date());
  return (
    <Card className="at-cal-card">
      <div className="at-cal-head">
        <span className="at-eyebrow">{monthName(month)}</span><span className="grow" />
        <button className="at-nav" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
        <button className="at-nav" aria-label="Next month" disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
      </div>
      {loading || !data ? <Loading /> : (
        <div className="at-cal" role="grid" aria-label={`Attendance in ${monthName(month)}`}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => <div key={w} className="wd" role="columnheader">{w}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
          {data.days.map((d) => {
            const n = Number(d.date.slice(8));
            const status = d.date === today && d.status !== "on_time" && d.status !== "late" ? "today" : d.status;
            const what = d.clockIn ? fmtTime(d.clockIn) : status === "holiday" ? "Holiday" : status === "leave" || status === "sick" ? (status === "sick" ? "Sick" : "Leave") : status === "today" ? "Today" : "";
            return (
              <div key={d.date} role="gridcell" className={`at-day s-${status}${d.date === today ? " is-today" : ""}`}
                aria-label={`${fmtDate(d.date, { weekday: "long", day: "numeric", month: "long" })}${STATUS[status] ? `: ${STATUS[status]}` : ""}${d.clockIn ? `, in at ${fmtTime(d.clockIn)}` : ""}${d.minutes ? `, ${hrs(d.minutes)} worked` : ""}`}
                title={[STATUS[status], d.label, d.minutes ? `${hrs(d.minutes)} worked` : null].filter(Boolean).join(" · ")}>
                <b>{n}</b><span>{what}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="at-legend">{LEGEND.map((s) => <span key={s}><i className={`s-${s}`} />{STATUS[s]}</span>)}</div>
    </Card>
  );
}

/** Hours worked each day of the month: one bar per day, today's still growing. */
function HoursChart({ data }: { data: Overview }) {
  const [hover, setHover] = useState<number | null>(null);
  const today = iso(new Date());
  const days = data.days.filter((d) => d.date <= today);
  if (!days.some((d) => d.minutes)) return <EmptyState title="No hours yet this month">Your hours show here once you clock in.</EmptyState>;
  const max = Math.max(9 * 60, ...days.map((d) => d.minutes ?? 0));
  const top = Math.ceil(max / 180) * 180;
  const ticks = [top / 3, (top * 2) / 3, top];
  const h = hover != null ? days[hover] : null;
  return (
    <div className="at-chart">
      <div className="at-plot">
        {ticks.map((t) => <div key={t} className="at-grid" style={{ bottom: `${(t / top) * 100}%` }}><span>{t / 60}h</span></div>)}
        <div className="at-bars" onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => (
            <div key={d.date} className="at-col" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={d.minutes ? 0 : -1}
              aria-label={`${fmtDate(d.date, { day: "numeric", month: "short" })}: ${d.minutes ? hrs(d.minutes) : "no hours"}`}>
              {!!d.minutes && <i className={d.date === today ? "now" : ""} style={{ height: `${(d.minutes / top) * 100}%` }} />}
            </div>
          ))}
        </div>
        {h && (
          <div className="at-tip" style={{ left: `${((hover! + 0.5) / days.length) * 100}%` }}>
            <b>{fmtDate(h.date, { weekday: "short", day: "numeric", month: "short" })}</b>
            {h.minutes ? <>{hrs(h.minutes)}{h.date === today ? " so far" : ""}{h.clockIn && <small>{fmtTime(h.clockIn)} to {h.clockOut ? fmtTime(h.clockOut) : "now"}</small>}</> : <small>{STATUS[h.status] || "No hours"}</small>}
          </div>
        )}
      </div>
      <div className="at-x">{days.map((d) => <span key={d.date}>{Number(d.date.slice(8))}</span>)}</div>
    </div>
  );
}

/** A ring showing how much of a year's leave is left. */
function LeaveRing({ left, of }: { left: number; of: number }) {
  const r = 50, c = 2 * Math.PI * r, part = of ? Math.max(0, Math.min(1, left / of)) : 0;
  return (
    <svg className="at-ring" viewBox="0 0 120 120" role="img" aria-label={`${left} of ${of} days left`}>
      <circle cx="60" cy="60" r={r} className="track" />
      <circle cx="60" cy="60" r={r} className="fill" strokeDasharray={`${c * part} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="60" className="n">{left}</text><text x="60" y="80" className="t">days left</text>
    </svg>
  );
}

/** Attendance > Today: the clock and the month at a glance. */
export function AttendanceToday() {
  const clock = useMyClock();
  const [month, setMonth] = useState(monthOf(new Date()));
  const q = useOverview(month);
  const now = useOverview(monthOf(new Date()));
  const balances = useMyBalances();
  const leave = useMyLeave();
  const summary = useQuery({ queryKey: ["my", "summary"], queryFn: () => api.get<{ employee: { id: string } | null }>("/api/my/summary"), staleTime: 60_000 });
  const [asking, setAsking] = useState(false);
  const r = clock.record;
  const t = now.data?.totals;
  const timed = (t?.onTime ?? 0) + (t?.late ?? 0);
  const all = balances.data?.balances ?? [];
  const annual = all.find((b) => /annual/i.test(b.name) && b.daysPerYear != null) ?? all.find((b) => b.daysPerYear != null);
  const sick = all.find((b) => /sick/i.test(b.name));
  const todayIso = iso(new Date());
  const upcoming = (leave.data ?? []).filter((l) => l.endDate >= todayIso && (l.status === "approved" || l.status === "pending")).slice(0, 2);
  const booked = upcoming.filter((l) => l.status === "approved").reduce((a, l) => a + Number(l.days), 0);
  const u = now.data?.usual;
  if (clock.state === "none") return <Card><EmptyState title="You're not set up for attendance yet">HR needs to add you to the team first.</EmptyState></Card>;
  return (
    <div className="at">
      <div className="at-kpis">
        <div className="at-kpi accent">
          <small>Today</small>
          <b>{fmtDuration(clock.workedMs)}</b>
          <span>{clock.state === "out" ? "Not clocked in yet" : clock.state === "done" ? `Done, ${fmtTime(r!.clockIn!)} to ${fmtTime(r!.clockOut!)}`
            : clock.state === "break" ? "On a break" : `Working since ${fmtTime(r!.clockIn!)}`}</span>
          <div className="at-actions">
            {clock.state === "out" && <Button size="sm" variant="secondary" loading={clock.busy} onClick={clock.clockIn}>Clock in</Button>}
            {clock.state === "in" && <><Button size="sm" variant="secondary" disabled={clock.busy} onClick={clock.pause}>Take a break</Button><Button size="sm" variant="secondary" loading={clock.busy} onClick={() => void clock.clockOut()}>Clock out</Button></>}
            {clock.state === "break" && <Button size="sm" variant="secondary" loading={clock.busy} onClick={clock.resume}>Back from break</Button>}
          </div>
        </div>
        <div className="at-kpi"><small>Hours this month</small><b>{t ? hrs(t.minutes) : "-"}</b><span>{t ? `${t.worked} day${t.worked === 1 ? "" : "s"} · ${t.prevMinutes ? hrs(t.prevMinutes) : "none"} in ${monthName(shiftMonth(month === monthOf(new Date()) ? month : monthOf(new Date()), -1), false)}` : ""}</span></div>
        <div className="at-kpi"><small>On time</small><b>{timed ? `${Math.round(((t?.onTime ?? 0) / timed) * 100)}%` : "-"}</b><span>{timed ? `${t!.onTime} of ${timed} day${timed === 1 ? "" : "s"} in by ${now.data!.workdayStart}` : `Start of day is ${now.data?.workdayStart ?? "09:00"}`}</span></div>
        <div className="at-kpi"><small>{annual ? `${annual.name} left` : "Leave left"}</small><b>{annual?.remaining != null ? `${annual.remaining} day${annual.remaining === 1 ? "" : "s"}` : "-"}</b><span>{annual?.daysPerYear != null ? `of ${annual.daysPerYear} this year` : "HR sets your allowance"}</span></div>
      </div>
      {clock.dialog}

      <div className="at-grid2">
        <div className="at-main">
          <MonthCalendar month={month} setMonth={setMonth} data={q.data} loading={q.isLoading} />
          <Card title={`Hours each day, ${monthName(month, false)}`} subtitle={month === monthOf(new Date()) ? "Today's bar is lighter: it's still growing." : undefined}>{q.data ? <HoursChart data={q.data} /> : <Loading />}</Card>
        </div>
        <div className="at-side">
          <Card title="Leave">
            {balances.isLoading ? <Loading /> : (
              <div className="at-leave">
                {annual?.daysPerYear != null && <LeaveRing left={annual.remaining ?? 0} of={annual.daysPerYear} />}
                <ul>
                  {annual && <li><b>{annual.used}</b> {annual.name.toLowerCase()} taken</li>}
                  {sick && <li><b>{sick.used}</b> sick day{sick.used === 1 ? "" : "s"}</li>}
                  <li><b>{booked}</b> booked ahead</li>
                  {!!annual?.pending && <li><b>{annual.pending}</b> waiting for approval</li>}
                </ul>
              </div>
            )}
            {upcoming.map((l) => (
              <div key={l.id} className="at-trip"><div className="grow"><b className="ink">{fmtDate(l.startDate, { day: "numeric", month: "short" })}{l.endDate !== l.startDate ? ` to ${fmtDate(l.endDate, { day: "numeric", month: "short" })}` : ""}</b>
                <small className="muted">{l.leaveType?.name ?? "Leave"} · {l.days} day{Number(l.days) === 1 ? "" : "s"}</small></div>
                <Pill tone={l.status === "approved" ? "ok" : "warn"}>{l.status === "approved" ? "Approved" : "Waiting"}</Pill></div>
            ))}
            <Button icon={<CalendarPlus size={16} />} style={{ width: "100%", marginTop: 14 }} onClick={() => setAsking(true)}>Request leave</Button>
          </Card>
          <Card title="Your usual day" subtitle={u ? `From your last ${u.days} full day${u.days === 1 ? "" : "s"}` : undefined}>
            {!u ? <p className="muted at-small">Shows once you've clocked in and out a few times.</p> : (
              <dl className="at-usual">
                <div><dt>Clock in</dt><dd>{hm(u.clockIn)}</dd></div>
                <div><dt>Clock out</dt><dd>{hm(u.clockOut)}</dd></div>
                <div><dt>Breaks</dt><dd>{u.breakMinutes != null ? `${u.breakMinutes}m` : "-"}</dd></div>
              </dl>
            )}
          </Card>
        </div>
      </div>
      <RequestLeaveModal open={asking} onClose={() => setAsking(false)} myEmployeeId={summary.data?.employee?.id} />
    </div>
  );
}

/** Attendance > Calendar: the month as a calendar, then each day's times. */
export function AttendanceCalendar() {
  const [month, setMonth] = useState(monthOf(new Date()));
  const q = useOverview(month);
  const worked = (q.data?.days ?? []).filter((d) => d.clockIn).reverse();
  return (
    <div className="at">
      <MonthCalendar month={month} setMonth={setMonth} data={q.data} loading={q.isLoading} />
      <Card title={`Each day in ${monthName(month)}`} subtitle={q.data ? `${q.data.totals.worked} day${q.data.totals.worked === 1 ? "" : "s"} · ${hrs(q.data.totals.minutes)} worked. If a day looks wrong, ask HR to correct it.` : undefined} flush={!!worked.length}>
        {q.isLoading ? <Loading /> : !worked.length ? <EmptyState title="No clock-ins this month">Clock in from the top bar when you start work.</EmptyState> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Day</th><th>In</th><th>Out</th><th>Worked</th><th className="hide-sm">Status</th></tr></thead>
              <tbody>{worked.map((d) => (
                <tr key={d.date}>
                  <td><b className="ink">{fmtDate(d.date, { weekday: "short", day: "numeric", month: "short" })}</b></td>
                  <td>{fmtTime(d.clockIn!)}</td>
                  <td>{d.clockOut ? fmtTime(d.clockOut) : "Still in"}</td>
                  <td>{d.minutes != null ? hrs(d.minutes) : "-"}</td>
                  <td className="hide-sm"><Pill tone={d.status === "late" ? "warn" : "ok"}>{STATUS[d.status]}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
