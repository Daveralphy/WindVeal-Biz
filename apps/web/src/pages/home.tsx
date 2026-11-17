import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LogIn, LogOut, Play, Plus } from "lucide-react";
import { Button, useToast } from "@windveal/ui";
import { useSession } from "../lib/session";
import { accentOf, usePalette, type Accent } from "../lib/palette";
import { areaArt } from "../lib/areaArt";
import { api, ApiError } from "../lib/api";
import { WORKSPACE_DEFS, useAreaAccess, type WorkspaceDef } from "../lib/workspaces";
import { useHomeData } from "../layouts/AppShell";
import { useMyClock } from "../modules/people/clock";
import { useMySummary } from "../modules/me";

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** What each card says: a fuller line than the sidebar's, about what you can do there. */
const ABOUT: Record<string, string> = {
  attendance: "Clock in and out, your hours, and your leave.",
  tasks: "Everything given to you, from anywhere in the business.",
  finance: "Your pay, payslips and expense claims.",
  requests: "Ask for equipment, purchases, letters or help.",
  people: "See who's in today, approve leave, and keep everyone's records up to date.",
  recruitment: "Post jobs on your careers page, move candidates along and book interviews.",
  crm: "Follow leads and deals through your pipeline, and never miss a follow-up.",
  workflows: "Hand out tasks, get approvals signed off and run checklists that keep work moving.",
  documents: "Keep every business file in one place, and bring in your spreadsheets.",
  insights: "Reports on sales, people, hiring and work, so you see how the business is doing.",
  settings: "Invite your team, set up roles and decide who can see and change what.",
  admin: "Approve new businesses, look after accounts and help people who are stuck.",
};

/** A drawing of what the card is for, in its own colour (static markup from areaArt). */
const Art = ({ k }: { k: string }) => <div className="art" aria-hidden dangerouslySetInnerHTML={{ __html: areaArt(k) }} />;

/**
 * One card: the whole card opens its page; a quick action (when there is one) sits on top of that, so the most
 * common job can be done from Home. A red dot when something is waiting.
 */
function Card({ to, label, art, about, accent, dot, action, className = "" }: {
  to: string; label: string; art: string; about?: string; accent: Accent; dot?: boolean; action?: ReactNode; className?: string;
}) {
  return (
    <div className={`home-card ${className}`} style={{ "--ws-c": accent.c, "--ws-t": accent.t } as CSSProperties}>
      <Link to={to} className="home-card-link" aria-label={dot ? `${label}, something to check` : label} />
      <Art k={art} />
      <b>{label}</b><span>{ABOUT[about ?? art]}</span>
      {action && <div className="home-card-act">{action}</div>}
      {dot && <i className="home-dot" title="Something to check" />}
    </div>
  );
}

/** Whether anything in an area is waiting for this person (the same counts as the sidebar badges). */
function useWaiting() {
  const { data } = useHomeData();
  const { sectionsOf } = useAreaAccess();
  return (w: WorkspaceDef) => sectionsOf(w).some((s) => {
    if (!s.badge || !data) return false;
    return (data.badges[s.badge] ?? (s.badge === "adminWaiting" ? data.adminWaiting : 0) ?? 0) > 0;
  });
}

// ---------------- My Workspace: one card for each of the person's own things ----------------

function ClockAction() {
  const clock = useMyClock();
  if (clock.state === "none" || clock.loading) return null;
  return <>
    {clock.state === "out" && <Button size="sm" icon={<LogIn size={14} />} loading={clock.busy} onClick={clock.clockIn}>Clock in</Button>}
    {clock.state === "in" && <Button size="sm" variant="secondary" icon={<LogOut size={14} />} loading={clock.busy} onClick={() => void clock.clockOut()}>Clock out</Button>}
    {clock.state === "break" && <Button size="sm" icon={<Play size={14} />} loading={clock.busy} onClick={clock.resume}>Back from break</Button>}
    {clock.state === "done" && <small className="muted">Done for today</small>}
    {clock.dialog}
  </>;
}

type OpenTask = { id: string; title: string };
/** The next task given to them, ticked off right here. */
function TaskAction() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["wf-tasks", "mine", "next"], queryFn: () => api.get<{ groups: { key: string; tasks: (OpenTask & { status: string })[] }[] }>("/api/workflows/tasks?scope=mine&status=open") });
  const next = q.data?.groups.flatMap((g) => g.tasks).find((t) => t.status !== "done");
  const done = useMutation({
    mutationFn: (t: OpenTask) => api.post(`/api/workflows/tasks/${t.id}/complete`),
    onSuccess: (_r, t) => { toast(`Done: ${t.title}`); void qc.invalidateQueries({ queryKey: ["wf-tasks"] }); void qc.invalidateQueries({ queryKey: ["home"] }); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "That didn't work. Try again.", "error"),
  });
  if (!next) return null;
  return (
    <button className="home-next" title="Mark as done" disabled={done.isPending} onClick={() => done.mutate(next)}>
      <span className="tick"><Check size={13} /></span><span className="t">{next.title}</span>
    </button>
  );
}

/** The everyday action on each space's card. */
function actionFor(key: string, employeeId?: string): ReactNode {
  if (key === "attendance") return <ClockAction />;
  if (key === "tasks") return <TaskAction />;
  if (key === "finance") return <Link className="btn btn-secondary btn-sm" to="/me/finance/expenses?new=1"><Plus size={14} />New claim</Link>;
  if (key === "requests") return <Link className="btn btn-secondary btn-sm" to="/me/requests"><Plus size={14} />New request</Link>;
  return undefined;
}

/** My Workspace: a card for each of the person's own spaces. */
function MyWorkspace({ spaces }: { spaces: WorkspaceDef[] }) {
  const palette = usePalette();
  const waiting = useWaiting();
  const { sectionsOf } = useAreaAccess();
  const summary = useMySummary();
  if (!spaces.length) return null;
  return (
    <section className="home-group">
      <h2 className="home-group-title">My Workspace</h2>
      <div className="home-grid">
        {spaces.map((w) => (
          <Card key={w.key} to={sectionsOf(w)[0]?.to ?? w.base} label={w.label} art={w.art ?? w.key} about={w.key} accent={accentOf(palette, w.key)}
            dot={waiting(w)} action={actionFor(w.key, summary.data?.employee?.id)} />
        ))}
      </div>
    </section>
  );
}

function Group({ title, areas }: { title: string; areas: WorkspaceDef[] }) {
  const palette = usePalette();
  const waiting = useWaiting();
  const { sectionsOf } = useAreaAccess();
  if (!areas.length) return null;
  return (
    <section className="home-group">
      <h2 className="home-group-title">{title}</h2>
      <div className="home-grid">
        {areas.map((w) => <Card key={w.key} to={sectionsOf(w)[0]?.to ?? w.base} label={w.label} art={w.art ?? w.key} accent={accentOf(palette, w.key)} dot={waiting(w)} />)}
      </div>
    </section>
  );
}

/**
 * Home: where everyone lands after signing in. Their own things first (a card each, with the everyday action on
 * it), then the workspaces they share with their team, then running the business, and WindVeal's own admin.
 */
export function Home() {
  const { user } = useSession();
  const { canOpen, sectionsOf } = useAreaAccess();
  const palette = usePalette();
  const waiting = useWaiting();
  const today = new Date();
  useEffect(() => { document.title = "Home · WindVeal"; }, []);
  const open = WORKSPACE_DEFS.filter(canOpen);
  const mine = open.filter((w) => w.group === "mine");
  const workspaces = open.filter((w) => w.group === "workspace");
  const manage = open.filter((w) => w.group === "manage" && w.key !== "admin");
  const admin = open.find((w) => w.key === "admin");
  return (
    <div className="home">
      <div className="home-hello">
        <h1>{greeting(today)}, {user.name.split(" ")[0]}</h1>
        <p>{today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <MyWorkspace spaces={mine} />
      <Group title="With your team" areas={workspaces} />
      <Group title="Manage the business" areas={manage} />
      {admin && (
        <section className="home-group">
          <h2 className="home-group-title">Platform</h2>
          <div className="home-grid">
            <Card to={sectionsOf(admin)[0]?.to ?? admin.base} label={admin.label} art="admin" accent={palette.admin} dot={waiting(admin)} className="home-admin" />
          </div>
        </section>
      )}
    </div>
  );
}
