import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, FileText, Inbox, Laptop, Mail, Paperclip, Receipt, ShoppingCart, Wrench } from "lucide-react";
import { Button, Card, EmptyState, Input, Loading, Modal, Pill, Textarea, useToast } from "@windveal/ui";
import type { RequestKind } from "@windveal/shared";
import { api, ApiError } from "../../lib/api";
import { useSession } from "../../lib/session";
import { fmtDate } from "../../lib/format";

type Req = {
  id: string; kind: RequestKind; kindName: string; title: string; details: string | null; amount: string | null; spentOn: string | null;
  hasReceipt: boolean; status: string; statusName: string; stage: string; requester: { id: string; name: string }; with: { id: string; name: string } | null;
  history: { at: string; by: string; byName: string; action: string; note?: string }[]; createdAt: string; mine: boolean; canAct: boolean;
};
type Kind = { kind: RequestKind; name: string; hint: string; goesTo: string | null };

export const KIND_ICON: Record<RequestKind, ReactNode> = {
  equipment: <Laptop size={18} />, purchase: <ShoppingCart size={18} />, it: <Wrench size={18} />, hr_letter: <Mail size={18} />,
  hr_question: <CircleHelp size={18} />, other: <Inbox size={18} />, expense: <Receipt size={18} />,
};
const TONE: Record<string, "ok" | "warn" | "blue" | "grey" | "red"> = {
  waiting: "warn", in_progress: "blue", approved: "blue", done: "ok", paid: "ok", declined: "grey", cancelled: "grey",
};
const ACTION_TEXT: Record<string, string> = {
  asked: "Asked", start: "Started on it", done: "Marked it done", approve: "Approved it", pay: "Marked it paid", decline: "Didn't approve it", cancelled: "Cancelled it",
};
const failed = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast(e instanceof ApiError ? e.message : "That didn't work. Try again.", "error");
const useKinds = () => useQuery({ queryKey: ["requests", "kinds"], queryFn: () => api.get<{ kinds: Kind[] }>("/api/requests/kinds"), staleTime: 60_000 });

/** Opens the form when a Home card's button sent the person here with ?new. */
function useOpenFromLink(open: (v: string) => void) {
  const [params, setParams] = useSearchParams();
  const done = useRef(false);
  useEffect(() => {
    const v = params.get("new");
    if (v && !done.current) { done.current = true; open(v); const p = new URLSearchParams(params); p.delete("new"); setParams(p, { replace: true }); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Row({ r, onOpen, showWho }: { r: Req; onOpen: () => void; showWho?: boolean }) {
  const { money } = useSession();
  const sub = [
    showWho ? r.requester.name : r.kindName, r.amount ? money(r.amount) : null, `asked ${fmtDate(r.createdAt, { day: "numeric", month: "short" })}`,
    !showWho && r.with ? `with ${r.with.name}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <button className="list-row rq-row" onClick={onOpen}>
      <span className="rq-ic">{KIND_ICON[r.kind]}</span>
      <span className="grow"><b className="ink">{r.title}</b><small className="muted">{sub}</small></span>
      <Pill tone={TONE[r.status] ?? "grey"}>{r.statusName}</Pill>
    </button>
  );
}

/** One request: what was asked, where it has been, and (for whoever it's with) what to do next. */
function Detail({ r, onClose }: { r: Req; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { money } = useSession();
  const [note, setNote] = useState("");
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["requests"] }); void qc.invalidateQueries({ queryKey: ["home"] }); };
  const act = useMutation({
    mutationFn: (action: string) => api.post(`/api/requests/${r.id}/act`, { action, note: note.trim() || undefined }),
    onSuccess: () => { refresh(); onClose(); toast("Done. They've been told."); }, onError: failed(toast),
  });
  const cancel = useMutation({ mutationFn: () => api.post(`/api/requests/${r.id}/cancel`), onSuccess: () => { refresh(); onClose(); }, onError: failed(toast) });
  const expense = r.kind === "expense";
  const actions: [string, string, boolean?][] = !r.canAct || r.mine ? [] : expense
    ? (r.stage === "manager" ? [["decline", "Don't approve", true], ["approve", "Approve"]] : [["decline", "Don't pay", true], ["pay", "Mark as paid"]])
    : r.status === "waiting" ? [["decline", "Can't do this", true], ["start", "Start on it"], ["done", "Mark done"]] : [["decline", "Can't do this", true], ["done", "Mark done"]];
  return (
    <Modal open onClose={onClose} title={r.title} subtitle={`${r.kindName} from ${r.mine ? "you" : r.requester.name}`}
      footer={<>
        {r.mine && r.status === "waiting" && <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel request</Button>}
        <span className="grow" />
        {actions.map(([a, label, quiet]) => <Button key={a} variant={quiet ? "secondary" : "primary"} loading={act.isPending && act.variables === a} disabled={act.isPending} onClick={() => act.mutate(a)}>{label}</Button>)}
        {!actions.length && <Button variant="secondary" onClick={onClose}>Close</Button>}
      </>}>
      <dl className="kv rq-kv">
        <div><dt>Status</dt><dd><Pill tone={TONE[r.status] ?? "grey"}>{r.statusName}</Pill>{r.with ? <span className="muted"> with {r.with.name}</span> : null}</dd></div>
        {r.amount && <div><dt>Amount</dt><dd>{money(r.amount)}</dd></div>}
        {r.spentOn && <div><dt>Spent on</dt><dd>{fmtDate(r.spentOn)}</dd></div>}
        {r.details && <div><dt>Details</dt><dd className="rq-pre">{r.details}</dd></div>}
        {r.hasReceipt && <div><dt>Receipt</dt><dd><a className="link" href={`/api/requests/${r.id}/receipt`} target="_blank" rel="noreferrer"><FileText size={14} /> Open the receipt</a></dd></div>}
      </dl>
      <div className="rq-tl">
        {r.history.map((h, i) => (
          <div key={i}><i /><span><b>{h.by === r.requester.id && h.action === "asked" ? `${h.byName} asked` : `${h.byName}: ${ACTION_TEXT[h.action] ?? h.action}`}</b>
            <small className="muted">{fmtDate(h.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small>{h.note && <em>{h.note}</em>}</span></div>
        ))}
      </div>
      {!!actions.length && <Textarea label="Note for them" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={expense ? "e.g. Paid by transfer on Friday" : "e.g. It's on your desk"} />}
    </Modal>
  );
}

function NewRequest({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const send = useMutation({
    mutationFn: () => api.post("/api/requests", { kind: kind.kind, title: title.trim(), details: details.trim() || undefined }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["requests"] }); toast(kind.goesTo ? `Sent to ${kind.goesTo}` : "Sent"); onClose(); },
    onError: failed(toast),
  });
  return (
    <Modal open onClose={onClose} title={kind.name} subtitle={kind.goesTo ? `This goes to ${kind.goesTo}.` : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={send.isPending} disabled={!title.trim()} onClick={() => send.mutate()}>Send</Button></>}>
      <Input label="What do you need?" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind.hint} />
      <Textarea label="More details" optional rows={4} value={details} onChange={(e) => setDetails(e.target.value)} />
    </Modal>
  );
}

/** Requests › My requests: pick what you need, and see where each request has got to. */
export function MyRequests() {
  const kinds = useKinds();
  const q = useQuery({ queryKey: ["requests", "mine"], queryFn: () => api.get<{ requests: Req[] }>("/api/requests?kind=other") });
  const [asking, setAsking] = useState<Kind | null>(null);
  const [open, setOpen] = useState<Req | null>(null);
  // Sent here from Home's "New request": open the form once the kinds have loaded.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const v = params.get("new");
    if (!v || !kinds.data) return;
    setAsking(kinds.data.kinds.find((x) => x.kind === v) ?? null);
    const p = new URLSearchParams(params); p.delete("new"); setParams(p, { replace: true });
  }, [kinds.data, params]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Card title="What do you need?">
        {kinds.isLoading ? <Loading /> : <div className="rq-kinds">
          {(kinds.data?.kinds ?? []).filter((k) => k.kind !== "expense").map((k) => (
            <button key={k.kind} onClick={() => setAsking(k)}><span className="rq-ic">{KIND_ICON[k.kind]}</span><b>{k.name}</b><small>{k.hint}</small></button>
          ))}
        </div>}
      </Card>
      <Card title="My requests" flush={!!q.data?.requests.length}>
        {q.isLoading ? <Loading /> : !q.data?.requests.length ? <EmptyState title="Nothing asked yet">Pick what you need above. You'll see here who it's with and when it's done.</EmptyState>
          : q.data.requests.map((r) => <Row key={r.id} r={r} onOpen={() => setOpen(r)} />)}
      </Card>
      {asking && <NewRequest kind={asking} onClose={() => setAsking(null)} />}
      {open && <Detail r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Requests › To handle: requests and expense claims waiting for this person. */
export function ToHandle() {
  const q = useQuery({ queryKey: ["requests", "handle"], queryFn: () => api.get<{ requests: Req[] }>("/api/requests?scope=handle") });
  const [open, setOpen] = useState<Req | null>(null);
  return (
    <>
      <Card title="Waiting for you" subtitle="Requests and expense claims from your team. Open one to answer it." flush={!!q.data?.requests.length}>
        {q.isLoading ? <Loading /> : !q.data?.requests.length ? <EmptyState title="Nothing waiting">When someone asks you for something, it shows here.</EmptyState>
          : q.data.requests.map((r) => <Row key={r.id} r={r} showWho onOpen={() => setOpen(r)} />)}
      </Card>
      {open && <Detail r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function NewClaim({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { org } = useSession();
  const kinds = useKinds();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const goesTo = kinds.data?.kinds.find((k) => k.kind === "expense")?.goesTo;
  const upload = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try { const r = await api.upload<{ file: { id: string; name: string } }>("/api/files", f, { kind: "system" }); setReceipt({ id: r.file.id, name: r.file.name }); }
    catch (e) { failed(toast)(e); } finally { setUploading(false); }
  };
  const send = useMutation({
    mutationFn: () => api.post("/api/requests", { kind: "expense", title: title.trim(), amount, spentOn, receiptFileId: receipt?.id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["requests"] }); toast(goesTo ? `Sent to ${goesTo} to approve` : "Sent"); onClose(); },
    onError: failed(toast),
  });
  return (
    <Modal open onClose={onClose} title="New expense claim" subtitle={goesTo ? `${goesTo} approves it first, then it's paid.` : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={send.isPending} disabled={!title.trim() || !Number(amount) || uploading} onClick={() => send.mutate()}>Send claim</Button></>}>
      <Input label="What was it for?" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Taxi to a client meeting" />
      <div className="grid-2">
        <Input label={`Amount (${org.currency})`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
        <Input label="Date" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      </div>
      <label className="rq-receipt">
        <input type="file" hidden accept="image/*,application/pdf" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        <Paperclip size={16} />{uploading ? "Adding the receipt..." : receipt ? receipt.name : "Add the receipt (photo or PDF)"}
      </label>
    </Modal>
  );
}

/** Finance › Expense claims: money spent for work, and where each claim has got to. */
export function ExpenseClaims() {
  const q = useQuery({ queryKey: ["requests", "expenses"], queryFn: () => api.get<{ requests: Req[] }>("/api/requests?kind=expense") });
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Req | null>(null);
  useOpenFromLink(() => setAdding(true));
  return (
    <>
      <div className="toolbar"><span className="grow" /><Button icon={<Receipt size={16} />} onClick={() => setAdding(true)}>New expense claim</Button></div>
      <Card title="Your claims" flush={!!q.data?.requests.length}>
        {q.isLoading ? <Loading /> : !q.data?.requests.length ? <EmptyState title="No claims yet">Spent your own money on something for work? Claim it back here with the receipt.</EmptyState>
          : q.data.requests.map((r) => <Row key={r.id} r={r} onOpen={() => setOpen(r)} />)}
      </Card>
      {adding && <NewClaim onClose={() => setAdding(false)} />}
      {open && <Detail r={open} onClose={() => setOpen(null)} />}
    </>
  );
}
