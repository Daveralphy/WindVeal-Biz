import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus, Star, Target, Trash2 } from "lucide-react";
import { Button, Card, ConfirmDialog, EmptyState, Input, Loading, Modal, Pill, Textarea, useToast } from "@windveal/ui";
import { api, ApiError } from "../../lib/api";
import { fmtDate } from "../../lib/format";

type Goal = { id: string; title: string; details: string | null; progress: number; dueOn: string | null; status: "active" | "done" | "dropped"; setBy: string | null };
type Review = {
  id: string; title: string; dueOn: string | null; status: "self" | "manager" | "done"; selfReview: string | null; managerReview: string | null;
  rating: number | null; person: string; reviewer: string; mine: boolean; userId: string;
};
type Training = { id: string; title: string; provider: string | null; status: "planned" | "in_progress" | "done"; dueOn: string | null; completedOn: string | null; certificateExpiresOn: string | null };
const failed = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast(e instanceof ApiError ? e.message : "That didn't work. Try again.", "error");
const short = (d: string) => fmtDate(d, { day: "numeric", month: "short", year: "numeric" });

/** Managers pick whose growth to look at: theirs, or someone who reports to them. */
function useWhose() {
  const q = useQuery({ queryKey: ["growth", "people"], queryFn: () => api.get<{ people: { id: string; name: string }[] }>("/api/growth/people") });
  const [who, setWho] = useState<string | null>(null);
  const people = q.data?.people ?? [];
  const current = who ?? people[0]?.id ?? null;
  const picker = people.length > 1 ? (
    <select className="select" style={{ width: "auto", minWidth: 200 }} aria-label="Whose" value={current ?? ""} onChange={(e) => setWho(e.target.value)}>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  ) : null;
  const isMe = current === people[0]?.id;
  return { who: current, picker, isMe, name: people.find((p) => p.id === current)?.name ?? "" };
}

/** Growth › Goals: what each person is working towards, with progress. */
export function Goals() {
  const qc = useQueryClient();
  const toast = useToast();
  const { who, picker, isMe, name } = useWhose();
  const q = useQuery({ queryKey: ["growth", "goals", who], enabled: !!who, queryFn: () => api.get<{ goals: Goal[] }>(`/api/growth/goals?for=${who}`) });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [removing, setRemoving] = useState<Goal | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["growth", "goals"] });
  const add = useMutation({
    mutationFn: () => api.post("/api/growth/goals", { for: who, title: title.trim(), dueOn: dueOn || undefined }),
    onSuccess: () => { refresh(); setAdding(false); setTitle(""); setDueOn(""); }, onError: failed(toast),
  });
  const progress = useMutation({ mutationFn: (v: { id: string; progress: number }) => api.patch(`/api/growth/goals/${v.id}`, { progress: v.progress }), onSuccess: refresh, onError: failed(toast) });
  const goals = q.data?.goals ?? [];
  return (
    <>
      <div className="toolbar">{picker}<span className="grow" /><Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>{isMe ? "Add a goal" : `Set a goal for ${name}`}</Button></div>
      <Card title={isMe ? "Your goals" : `${name}'s goals`} flush={!!goals.length}>
        {q.isLoading ? <Loading /> : !goals.length ? <EmptyState icon={<Target size={24} />} title="No goals yet">{isMe ? "Add what you're working towards this year, or agree them with your manager." : "Set them a goal to work towards."}</EmptyState>
          : goals.map((g) => (
            <div key={g.id} className="gr-goal">
              <div className="gr-head"><b className="ink">{g.title}</b>{g.status === "done" ? <Pill tone="ok">Done</Pill> : g.dueOn ? <span className="muted">by {short(g.dueOn)}</span> : null}
                <button className="bd-ic" aria-label={`Remove ${g.title}`} onClick={() => setRemoving(g)}><Trash2 size={15} /></button></div>
              {g.setBy && <small className="muted">Set by {g.setBy}</small>}
              <div className="gr-bar"><input type="range" min={0} max={100} step={5} value={g.progress} aria-label={`Progress on ${g.title}`}
                onChange={(e) => qc.setQueryData(["growth", "goals", who], { goals: goals.map((x) => (x.id === g.id ? { ...x, progress: Number(e.target.value) } : x)) })}
                onPointerUp={(e) => progress.mutate({ id: g.id, progress: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={(e) => progress.mutate({ id: g.id, progress: Number((e.target as HTMLInputElement).value) })}
                style={{ ["--p" as string]: `${g.progress}%` }} /><span>{g.progress}%</span></div>
            </div>
          ))}
      </Card>
      {adding && (
        <Modal open onClose={() => setAdding(false)} title={isMe ? "Add a goal" : `Set a goal for ${name}`}
          footer={<><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button loading={add.isPending} disabled={!title.trim()} onClick={() => add.mutate()}>Add goal</Button></>}>
          <Input label="The goal" autoFocus placeholder="e.g. Bring in 20 new clients" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="By when" optional type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </Modal>
      )}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} danger title={`Remove "${removing?.title}"?`} confirmLabel="Remove goal"
        onConfirm={async () => { const g = removing!; setRemoving(null); try { await api.del(`/api/growth/goals/${g.id}`); refresh(); } catch (e) { failed(toast)(e); } }}>
        It's taken off the list.
      </ConfirmDialog>
    </>
  );
}

function ReviewPanel({ r, onClose }: { r: Review; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const myTurn = (r.mine && r.status === "self") || (!r.mine && r.status === "manager");
  const send = useMutation({
    mutationFn: () => api.post(`/api/growth/reviews/${r.id}`, { text: text.trim(), rating: !r.mine && rating ? rating : undefined }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["growth", "reviews"] }); toast(r.mine ? "Sent to your manager" : "Review finished"); onClose(); }, onError: failed(toast),
  });
  return (
    <Modal open onClose={onClose} title={r.title} subtitle={r.mine ? `With ${r.reviewer}` : `${r.person}'s review`}
      footer={myTurn ? <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={send.isPending} disabled={!text.trim()} onClick={() => send.mutate()}>{r.mine ? "Send my self-review" : "Finish the review"}</Button></>
        : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      {r.selfReview && <div className="gr-quote"><small className="muted">{r.mine ? "What you wrote" : `What ${r.person} wrote`}</small><p>{r.selfReview}</p></div>}
      {r.managerReview && <div className="gr-quote"><small className="muted">{r.mine ? `What ${r.reviewer} wrote` : "What you wrote"}</small><p>{r.managerReview}</p>
        {r.rating && <span className="gr-stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>}</div>}
      {myTurn && <>
        <Textarea label={r.mine ? "How has it gone? What went well, and what would you like to do next?" : `Your review of ${r.person}`} rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        {!r.mine && <div className="gr-rate" role="group" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={rating >= n} aria-label={`${n} out of 5`} onClick={() => setRating(n)}>{rating >= n ? "★" : "☆"}</button>
        ))}</div>}
      </>}
      {!myTurn && r.status !== "done" && <p className="muted">{r.status === "self" ? `Waiting for ${r.mine ? "you" : r.person} to write a self-review.` : `Waiting for ${r.reviewer} to finish it.`}</p>}
    </Modal>
  );
}

/** Growth › Reviews: reviews of you, and (for managers) the ones you give. */
export function Reviews() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["growth", "reviews"], queryFn: () => api.get<{ reviews: Review[] }>("/api/growth/reviews") });
  const people = useQuery({ queryKey: ["growth", "people"], queryFn: () => api.get<{ people: { id: string; name: string }[] }>("/api/growth/people") });
  const reports = (people.data?.people ?? []).slice(1);
  const [open, setOpen] = useState<Review | null>(null);
  const [starting, setStarting] = useState(false);
  const [f, setF] = useState({ for: "", title: "Year-end review", dueOn: "" });
  const start = useMutation({
    mutationFn: () => api.post("/api/growth/reviews", { for: f.for || reports[0]?.id, title: f.title.trim(), dueOn: f.dueOn || undefined }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["growth", "reviews"] }); setStarting(false); toast("Started. They'll write their self-review first."); }, onError: failed(toast),
  });
  const all = q.data?.reviews ?? [];
  const row = (r: Review) => {
    const myTurn = (r.mine && r.status === "self") || (!r.mine && r.status === "manager");
    return (
      <button key={r.id} className="list-row rq-row" onClick={() => setOpen(r)}>
        <span className="rq-ic"><Star size={18} /></span>
        <span className="grow"><b className="ink">{r.mine ? r.title : `${r.person}: ${r.title}`}</b><small className="muted">{[r.mine ? `with ${r.reviewer}` : null, r.dueOn ? `due ${short(r.dueOn)}` : null].filter(Boolean).join(" · ")}</small></span>
        <Pill tone={r.status === "done" ? "ok" : myTurn ? "warn" : "blue"}>{r.status === "done" ? "Finished" : myTurn ? "Your turn" : "Waiting"}</Pill>
      </button>
    );
  };
  if (q.isLoading) return <Loading />;
  return (
    <>
      {!!reports.length && <div className="toolbar"><span className="grow" /><Button icon={<Plus size={16} />} onClick={() => setStarting(true)}>Start a review</Button></div>}
      <Card title="Your reviews" flush={all.some((r) => r.mine)}>
        {all.some((r) => r.mine) ? all.filter((r) => r.mine).map(row) : <EmptyState icon={<Star size={24} />} title="No reviews yet">Your manager starts them. You'll write your part first.</EmptyState>}
      </Card>
      {!!reports.length && <Card title="Reviews you give" flush={all.some((r) => !r.mine)}>
        {all.some((r) => !r.mine) ? all.filter((r) => !r.mine).map(row) : <EmptyState title="None yet">Start one for someone who reports to you.</EmptyState>}
      </Card>}
      {open && <ReviewPanel r={open} onClose={() => setOpen(null)} />}
      {starting && (
        <Modal open onClose={() => setStarting(false)} title="Start a review"
          footer={<><Button variant="secondary" onClick={() => setStarting(false)}>Cancel</Button><Button loading={start.isPending} disabled={!f.title.trim()} onClick={() => start.mutate()}>Start review</Button></>}>
          <label className="field"><span className="label">For</span>
            <select className="select" value={f.for || reports[0]?.id} onChange={(e) => setF({ ...f, for: e.target.value })}>{reports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <Input label="Name" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input label="Self-review due" optional type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
        </Modal>
      )}
    </>
  );
}

/** Growth › Training: courses and certificates, and when certificates run out. */
export function TrainingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { who, picker, isMe, name } = useWhose();
  const q = useQuery({ queryKey: ["growth", "training", who], enabled: !!who, queryFn: () => api.get<{ training: Training[] }>(`/api/growth/training?for=${who}`) });
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", provider: "", dueOn: "", done: false, certificateExpiresOn: "" });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["growth", "training"] });
  const add = useMutation({
    mutationFn: () => api.post("/api/growth/training", { for: who, title: f.title.trim(), provider: f.provider.trim() || undefined, dueOn: f.dueOn || undefined,
      status: f.done ? "done" : "planned", certificateExpiresOn: f.certificateExpiresOn || undefined }),
    onSuccess: () => { refresh(); setAdding(false); setF({ title: "", provider: "", dueOn: "", done: false, certificateExpiresOn: "" }); }, onError: failed(toast),
  });
  const set = useMutation({ mutationFn: (v: { id: string; status: Training["status"] }) => api.patch(`/api/growth/training/${v.id}`, { status: v.status }), onSuccess: refresh, onError: failed(toast) });
  const list = q.data?.training ?? [];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="toolbar">{picker}<span className="grow" /><Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>{isMe ? "Add training" : `Add training for ${name}`}</Button></div>
      <Card title={isMe ? "Your training" : `${name}'s training`} flush={!!list.length}>
        {q.isLoading ? <Loading /> : !list.length ? <EmptyState icon={<GraduationCap size={24} />} title="No training yet">Courses and certificates show here, with a reminder when a certificate runs out.</EmptyState>
          : list.map((t) => {
            const expired = t.certificateExpiresOn && t.certificateExpiresOn < today;
            return (
              <div key={t.id} className="list-row rq-row" style={{ cursor: "default" }}>
                <span className="rq-ic"><GraduationCap size={18} /></span>
                <span className="grow"><b className="ink">{t.title}</b><small className="muted">{[t.provider, t.status === "done" && t.completedOn ? `done ${short(t.completedOn)}` : t.dueOn ? `due ${short(t.dueOn)}` : null,
                  t.certificateExpiresOn ? `certificate ${expired ? "ran out" : "until"} ${short(t.certificateExpiresOn)}` : null].filter(Boolean).join(" · ")}</small></span>
                {expired ? <Pill tone="red">Renew</Pill> : <select className="select gr-status" aria-label={`Status of ${t.title}`} value={t.status} onChange={(e) => set.mutate({ id: t.id, status: e.target.value as Training["status"] })}>
                  <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="done">Done</option></select>}
              </div>
            );
          })}
      </Card>
      {adding && (
        <Modal open onClose={() => setAdding(false)} title={isMe ? "Add training" : `Add training for ${name}`}
          footer={<><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button loading={add.isPending} disabled={!f.title.trim()} onClick={() => add.mutate()}>Add</Button></>}>
          <Input label="Course or certificate" autoFocus placeholder="e.g. First aid, Negotiation skills" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input label="Who runs it" optional value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} />
          <div className="grid-2">
            <Input label="Due by" optional type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
            <Input label="Certificate runs out" optional type="date" value={f.certificateExpiresOn} onChange={(e) => setF({ ...f, certificateExpiresOn: e.target.value })} />
          </div>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={f.done} onChange={(e) => setF({ ...f, done: e.target.checked })} />Already done</label>
        </Modal>
      )}
    </>
  );
}
