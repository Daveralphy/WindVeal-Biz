import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { Button, Card, EmptyState, Loading, PageHeader } from "@windveal/ui";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { fmtDate } from "../../lib/format";
import { LeaveRequestRow, RequestLeaveModal, balanceText } from "../people/Leave";
import type { Balance, LeaveRequest } from "../people/lib";
import { TaskDrawer, TaskList, useTaskList } from "../workflows/tasks";
import { Board } from "./board";
import { Payslips } from "./payslips";
import { AttendanceCalendar, AttendanceToday } from "./attendance";
import { ExpenseClaims, MyRequests, ToHandle } from "./requests";
import { MyDetails, MyDocuments } from "./profile";
import { Goals, Reviews, TrainingPage } from "./growth";
import "./me.css";

type Summary = {
  employee: { id: string; firstName: string; jobTitle: string | null; startDate: string | null; status: string } | null;
  onboarding: boolean; nextStep: { title: string; dueAt: string | null } | null;
};

/** What My Workspace has for this person (e.g. whether they're onboarding). */
export function useMySummary() {
  return useQuery({ queryKey: ["my", "summary"], queryFn: () => api.get<Summary>("/api/my/summary"), staleTime: 60_000 });
}
const useMyLeave = () => useQuery({ queryKey: ["people", "leave", "mine"], queryFn: () => api.get<LeaveRequest[]>("/api/people/leave/requests?scope=mine") });
const useMyBalances = () => useQuery({ queryKey: ["people", "balances", "me"], queryFn: () => api.get<{ balances: Balance[] }>("/api/people/leave/balances") });


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
      <Route path="attendance" element={<Space title="Attendance" subtitle="Your time and your leave, this month at a glance."><AttendanceToday /></Space>} />
      <Route path="attendance/history" element={<Space title="Attendance" subtitle="Each day you've worked, month by month."><AttendanceCalendar /></Space>} />
      <Route path="attendance/leave" element={<Space title="Attendance" subtitle="Your leave balances and requests."><Leave /></Space>} />
      <Route path="attendance/holidays" element={<Space title="Attendance" subtitle="Public holidays."><Holidays /></Space>} />
      <Route path="tasks" element={<Space title="Tasks" subtitle="Your team's board. Drag cards from list to list."><Board /></Space>} />
      <Route path="tasks/mine" element={<Space title="Tasks" subtitle="Every card that's yours, from every board and anywhere in the business."><MyTasks /></Space>} />
      <Route path="tasks/getting-started" element={<Navigate to="/me/tasks" replace />} />
      <Route path="finance" element={<Space title="Finance" subtitle="Your pay. Only you and HR can see this."><Pay /></Space>} />
      <Route path="finance/payslips" element={<Space title="Finance" subtitle="Your payslips. Only you and HR can see these."><Payslips /></Space>} />
      <Route path="finance/expenses" element={<Space title="Finance" subtitle="Money you spent for work, claimed back."><ExpenseClaims /></Space>} />
      <Route path="requests" element={<Space title="Requests" subtitle="Ask for what you need. Each request goes to the right person, and you can see where it is."><MyRequests /></Space>} />
      <Route path="profile" element={<Space title="Profile & documents" subtitle="Your details and papers. HR sees the same."><MyDetails /></Space>} />
      <Route path="profile/documents" element={<Space title="Profile & documents" subtitle="Your contract, ID and certificates."><MyDocuments /></Space>} />
      <Route path="growth" element={<Space title="Growth" subtitle="What you're working towards, and how it's going."><Goals /></Space>} />
      <Route path="growth/reviews" element={<Space title="Growth" subtitle="How you're doing, in your words and your manager's."><Reviews /></Space>} />
      <Route path="growth/training" element={<Space title="Growth" subtitle="Courses and certificates."><TrainingPage /></Space>} />
      <Route path="requests/handle" element={<Space title="Requests" subtitle="What your team has asked you for."><ToHandle /></Space>} />
      {/* Old addresses (bookmarks, notifications) still land in the right place. */}
      <Route path="leave" element={<Navigate to="/me/attendance/leave" replace />} />
      <Route path="pay" element={<Navigate to="/me/finance" replace />} />
      <Route path="onboarding" element={<Navigate to="/me/tasks" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
