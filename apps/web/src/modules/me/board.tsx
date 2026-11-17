import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity, AlignLeft, Archive, ArrowRight, Calendar as CalendarIcon, CheckSquare, ChevronLeft, ChevronRight, Clock, Columns3, Copy,
  MessageCircle, MoreHorizontal, Paperclip, Plus, Search, Table2, Tag, Trash2, User, X,
} from "lucide-react";
import { Avatar, Button, ConfirmDialog, EmptyState, Loading, Menu, useToast } from "@windveal/ui";
import { api, ApiError } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import type { TaskView } from "../workflows/tasks";
import "./board.css";

// ---------------- data ----------------

type Person = { id: string; name: string; avatarFileId?: string | null; openCards?: number };
type List = { id: string; name: string; kind: "start" | "todo" | "doing" | "done" | "custom"; position: number };
type Label = { id: string; name: string; color: string };
type Card = TaskView & { listId: string; position: number; labels: string[]; members: Person[]; canMove: boolean; archived: boolean };
type BoardData = { board: { id: string; name: string; personal: boolean }; role: "lead" | "member"; me: string; lists: List[]; labels: Label[]; cards: Card[]; people: Person[]; leads: string[] };
type CardDetail = {
  card: Card & { history: { at: string; by: string; byName: string; text: string }[] };
  items: { id: string; label: string; done: boolean; position: number }[];
  comments: { id: string; body: string; author: Person; createdAt: string }[];
  files: { id: string; name: string; size: number; mime: string; createdAt: string }[];
  canEdit: boolean; canDelete: boolean; lead: boolean;
};

/** Label colours: a soft fill with readable text, in light and dark mode. */
export const LABEL_COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  red: { bg: "var(--red-bg)", fg: "var(--red)", dot: "#e5484d" }, orange: { bg: "color-mix(in srgb, #f08c3a 20%, var(--surface))", fg: "color-mix(in srgb, #b8561a 80%, var(--ink))", dot: "#f08c3a" },
  yellow: { bg: "var(--warn-bg)", fg: "var(--warn)", dot: "#f4b740" }, green: { bg: "var(--ok-bg)", fg: "var(--ok)", dot: "#2bb37e" },
  blue: { bg: "var(--pale)", fg: "var(--deep)", dot: "#486fe4" }, purple: { bg: "var(--violet-bg)", fg: "var(--violet)", dot: "#8e5cd9" },
  grey: { bg: "var(--soft)", fg: "var(--muted)", dot: "#8b93ad" },
};
const LIST_DOT: Record<List["kind"], string> = { start: "#8e5cd9", todo: "var(--muted)", doing: "#486fe4", done: "var(--ok-dot)", custom: "#f4b740" };
const failed = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast(e instanceof ApiError ? e.message : "That didn't work. Try again.", "error");
/** When a drag last ended: the click that ends a drag must not open the card. */
let droppedAt = 0;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dueChip(iso: string | null, done: boolean) {
  if (!iso) return null;
  const d = new Date(iso), today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  const text = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : fmtDate(iso, { day: "numeric", month: "short" });
  return { text, tone: done ? "ok" : diff < 0 ? "late" : diff <= 1 ? "soon" : "" };
}

function LabelChip({ l, big }: { l: Label; big?: boolean }) {
  const c = LABEL_COLORS[l.color] ?? LABEL_COLORS.grey!;
  return <span className={`bd-lbl${big ? " big" : ""}`} style={{ background: c.bg, color: c.fg }}>{l.name}</span>;
}

/** Plain text with **bold**, _italics_ and "- " lists: what the description box writes. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : p);
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[-*]\s+(.*)/);
    if (m) { list.push(m[1]!); continue; }
    flush();
    if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="bd-rich">{out}</div>;
}

/** Closes a popover when someone clicks elsewhere or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [open, close]);
  return ref;
}

// ---------------- pickers ----------------

/** Search the people on the board; suggestions as you type, with how many open cards each has. */
function PersonPicker({ people, me, onPick, onClose, allowOthers, picked = [] }: {
  people: Person[]; me: string; onPick: (p: Person) => void; onClose: () => void; allowOthers: boolean; picked?: string[];
}) {
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(0);
  const ref = useDismiss(true, onClose);
  const list = people.filter((p) => (allowOthers || p.id === me) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (p?: Person) => { if (p) { onPick(p); onClose(); } };
  return (
    <div className="bd-pop" ref={ref} role="dialog" aria-label="Choose someone">
      <div className="bd-search"><Search size={15} /><input autoFocus value={q} placeholder={allowOthers ? "Search the team" : "Only the team lead can assign others"} aria-label="Search people"
        onChange={(e) => { setQ(e.target.value); setHl(0); }}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => Math.min(h + 1, list.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); } if (e.key === "Enter") { e.preventDefault(); pick(list[hl]); } }} /></div>
      <div className="bd-opts">
        {!list.length && <p className="muted bd-none">No one on this board by that name.</p>}
        {list.filter((p) => p.id !== me).map((p) => {
          const i = list.indexOf(p);
          return (
            <button key={p.id} className={`bd-opt${i === hl ? " hl" : ""}`} onMouseEnter={() => setHl(i)} onClick={() => pick(p)}>
              <Avatar name={p.name} size={30} /><span className="grow"><b>{p.name}</b><small>{p.openCards ?? 0} open card{p.openCards === 1 ? "" : "s"}</small></span>
              {picked.includes(p.id) && <CheckSquare size={15} />}
            </button>
          );
        })}
        {people.some((p) => p.id === me) && <>
          {list.some((p) => p.id !== me) && <hr />}
          <button className={`bd-opt${list[hl]?.id === me ? " hl" : ""}`} onClick={() => pick(people.find((p) => p.id === me))}>
            <Avatar name={people.find((p) => p.id === me)!.name} size={30} /><span className="grow"><b>Assign to me</b><small>{people.find((p) => p.id === me)!.name}</small></span>
            {picked.includes(me) && <CheckSquare size={15} />}
          </button>
        </>}
      </div>
    </div>
  );
}

/** Tick labels on or off, or make a new one. */
function LabelPicker({ board, labels, chosen, onToggle, onClose }: { board: string; labels: Label[]; chosen: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useDismiss(true, onClose);
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [adding, setAdding] = useState(false);
  const add = useMutation({
    mutationFn: () => api.post<{ label: Label }>(`/api/boards/${board}/labels`, { name: name.trim(), color }),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ["board", board] }); onToggle(r.label.id); setName(""); setAdding(false); },
    onError: failed(toast),
  });
  return (
    <div className="bd-pop" ref={ref} role="dialog" aria-label="Labels">
      <div className="bd-pop-title">Labels</div>
      {labels.map((l) => (
        <button key={l.id} className="bd-lblrow" onClick={() => onToggle(l.id)} aria-pressed={chosen.includes(l.id)}>
          <span className={`bd-tick${chosen.includes(l.id) ? " on" : ""}`}>{chosen.includes(l.id) ? "✓" : ""}</span><LabelChip l={l} big />
        </button>
      ))}
      {adding ? (
        <div className="bd-newlbl">
          <input className="input" autoFocus placeholder="Label name" aria-label="Label name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) add.mutate(); }} />
          <div className="bd-swatches">{Object.entries(LABEL_COLORS).map(([k, c]) => <button key={k} aria-label={k} aria-pressed={color === k} style={{ background: c.dot }} onClick={() => setColor(k)} />)}</div>
          <Button size="sm" loading={add.isPending} disabled={!name.trim()} onClick={() => add.mutate()}>Add label</Button>
        </div>
      ) : <button className="bd-opt" onClick={() => setAdding(true)}><Plus size={15} />New label</button>}
    </div>
  );
}

// ---------------- the card's face ----------------

function CardFace({ c, labels, dragging }: { c: Card; labels: Label[]; dragging?: boolean }) {
  const due = dueChip(c.dueAt, c.status === "done");
  const people = [c.assignee, ...c.members].filter((p, i, a): p is Person => !!p && a.findIndex((x) => x?.id === p.id) === i);
  const mine = labels.filter((l) => c.labels.includes(l.id));
  const items = c.counts.items;
  return (
    <div className={`bd-card${dragging ? " dragging" : ""}${c.status === "done" ? " done" : ""}`}>
      {!!mine.length && <div className="bd-lbls">{mine.map((l) => <LabelChip key={l.id} l={l} />)}</div>}
      <b>{c.title}</b>
      {c.description && <p className="bd-desc">{c.description.replace(/[*_]/g, "").split("\n")[0]}</p>}
      {!!items && <div className="bd-prog"><i style={{ width: `${(c.counts.itemsDone / items) * 100}%` }} /></div>}
      <div className="bd-meta">
        {due && <span className={`bd-due ${due.tone}`}><Clock size={12} />{due.text}</span>}
        {!!items && <span><CheckSquare size={12} />{c.counts.itemsDone}/{items}</span>}
        {!!c.counts.comments && <span><MessageCircle size={12} />{c.counts.comments}</span>}
        {!!c.counts.files && <span><Paperclip size={12} />{c.counts.files}</span>}
        <span className="grow" />
        <span className="bd-avs">{people.slice(0, 3).map((p) => <Avatar key={p.id} name={p.name} size={22} />)}</span>
      </div>
    </div>
  );
}

function SortableCard({ c, labels, onOpen }: { c: Card; labels: Label[]; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, data: { type: "card", listId: c.listId }, disabled: !c.canMove });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="bd-card-wrap" {...attributes} {...listeners} onClick={() => { if (Date.now() - droppedAt > 250) onOpen(); }} aria-label={c.title}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); listeners?.onKeyDown?.(e); }}>
      <CardFace c={c} labels={labels} />
    </div>
  );
}

function ListColumn({ list, cards, labels, lead, onOpen, onAdd, onRename, onDelete }: {
  list: List; cards: Card[]; labels: Label[]; lead: boolean; onOpen: (id: string) => void; onAdd: () => void; onRename: () => void; onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${list.id}`, data: { type: "list", listId: list.id } });
  const fixed = list.kind === "todo" || list.kind === "doing" || list.kind === "done";
  return (
    <section className={`bd-list${isOver ? " over" : ""}`} aria-label={list.name}>
      <header>
        <i className="bd-dot" style={{ background: LIST_DOT[list.kind] }} /><h3>{list.name}</h3><span className="n">{cards.length}</span><span className="grow" />
        <Menu trigger={(t) => <button className="bd-ic" aria-label={`${list.name} options`} onClick={t}><MoreHorizontal size={16} /></button>}>
          {(close) => <>
            <button onClick={() => { close(); onAdd(); }}>Add a card</button>
            {lead && <button onClick={() => { close(); onRename(); }}>Rename list</button>}
            {lead && !fixed && <button className="danger" onClick={() => { close(); onDelete(); }}>Remove list</button>}
          </>}
        </Menu>
      </header>
      <div ref={setNodeRef} className="bd-cards">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => <SortableCard key={c.id} c={c} labels={labels} onOpen={() => onOpen(c.id)} />)}
        </SortableContext>
      </div>
      <button className="bd-add" onClick={onAdd}><Plus size={15} />Add a card</button>
    </section>
  );
}

// ---------------- a new card ----------------

function NewCard({ d, listId, onClose }: { d: BoardData; listId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const lead = d.role === "lead";
  const me = d.people.find((p) => p.id === d.me);
  const [f, setF] = useState({ title: "", description: "", listId, dueDate: "", assignee: me ?? null as Person | null, labels: [] as string[], items: [] as string[] });
  const [item, setItem] = useState("");
  const [pop, setPop] = useState<"person" | "labels" | null>(null);
  const desc = useRef<HTMLTextAreaElement>(null);
  const create = useMutation({
    mutationFn: () => api.post(`/api/boards/${d.board.id}/cards`, {
      title: f.title.trim(), description: f.description.trim() || undefined, listId: f.listId, assigneeUserId: f.assignee?.id ?? null,
      dueDate: f.dueDate || null, labelIds: f.labels, items: [...f.items, ...(item.trim() ? [item.trim()] : [])],
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["board", d.board.id] }); toast("Card added"); onClose(); },
    onError: failed(toast),
  });
  // The description toolbar wraps the selected text (or starts a list line).
  const wrap = (before: string, after = before) => {
    const t = desc.current; if (!t) return;
    const [a, b] = [t.selectionStart, t.selectionEnd];
    const v = f.description.slice(0, a) + before + f.description.slice(a, b) + after + f.description.slice(b);
    setF({ ...f, description: v }); requestAnimationFrame(() => { t.focus(); t.setSelectionRange(a + before.length, b + before.length); });
  };
  const listName = d.lists.find((l) => l.id === f.listId)?.name;
  return (
    <Overlay onClose={onClose} label="New card" narrow>
      <div className="bdm-head"><div className="grow"><h3>New card</h3><small>In <b>{listName}</b> on {d.board.name}</small></div>
        <button className="bdm-x" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
      <div className="bdm-form">
        <label className="f-lbl" htmlFor="nc-title">Title</label>
        <input id="nc-title" className="input" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What needs doing?" />
        <label className="f-lbl" htmlFor="nc-desc">Description <em>(optional)</em></label>
        <div className="bd-tool">
          <button type="button" aria-label="Bold" onClick={() => wrap("**")}><b>B</b></button>
          <button type="button" aria-label="Italics" onClick={() => wrap("_")}><i>I</i></button>
          <button type="button" aria-label="List" onClick={() => wrap("\n- ", "")}><AlignLeft size={15} /></button>
        </div>
        <textarea id="nc-desc" ref={desc} className="bd-area" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Add more detail" />
        <div className="grid-2">
          <div style={{ position: "relative" }}>
            <span className="f-lbl">Assign to</span>
            <button type="button" className="bd-field" onClick={() => setPop("person")} aria-label="Assign to">
              {f.assignee ? <><Avatar name={f.assignee.name} size={22} />{f.assignee.id === d.me ? "Me" : f.assignee.name}</> : <><User size={15} /><span className="muted">No one yet</span></>}
            </button>
            {pop === "person" && <PersonPicker people={d.people} me={d.me} allowOthers={lead} onPick={(p) => setF({ ...f, assignee: p })} onClose={() => setPop(null)} />}
          </div>
          <div><label className="f-lbl" htmlFor="nc-due">Due date <em>(optional)</em></label><input id="nc-due" className="input" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
        </div>
        <div style={{ position: "relative" }}>
          <span className="f-lbl">Labels</span>
          <div className="bd-lbls wrap">
            {d.labels.filter((l) => f.labels.includes(l.id)).map((l) => <LabelChip key={l.id} l={l} big />)}
            <button type="button" className="bd-chipbtn" onClick={() => setPop("labels")}><Tag size={13} />{f.labels.length ? "Change" : "Add labels"}</button>
          </div>
          {pop === "labels" && <LabelPicker board={d.board.id} labels={d.labels} chosen={f.labels}
            onToggle={(id) => setF((x) => ({ ...x, labels: x.labels.includes(id) ? x.labels.filter((y) => y !== id) : [...x.labels, id] }))} onClose={() => setPop(null)} />}
        </div>
        <span className="f-lbl">Checklist <em>(optional)</em></span>
        {f.items.map((it, i) => <div key={i} className="bd-item"><span className="bd-box" /><span className="grow">{it}</span>
          <button className="bd-ic" aria-label={`Remove ${it}`} onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })}><X size={14} /></button></div>)}
        <div className="bd-additem"><Plus size={15} /><input value={item} placeholder="Add an item and press Enter" aria-label="Checklist item" onChange={(e) => setItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { e.preventDefault(); setF({ ...f, items: [...f.items, item.trim()] }); setItem(""); } }} /></div>
        <label className="f-lbl" htmlFor="nc-list">List</label>
        <select id="nc-list" className="select" value={f.listId} onChange={(e) => setF({ ...f, listId: e.target.value })}>{d.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      </div>
      <div className="bdm-foot"><span className="grow" /><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={create.isPending} disabled={!f.title.trim()} onClick={() => create.mutate()}>Create card</Button></div>
    </Overlay>
  );
}

/** A window over the board, closed with Escape or the backdrop. */
function Overlay({ children, onClose, label, narrow }: { children: ReactNode; onClose: () => void; label: string; narrow?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="bdm-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bdm${narrow ? " narrow" : ""}`} role="dialog" aria-label={label}>{children}</div>
    </div>
  );
}

// ---------------- an open card ----------------

function CardWindow({ id, d, onClose }: { id: string; d: BoardData; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["card", id], queryFn: () => api.get<CardDetail>(`/api/boards/cards/${id}`) });
  const [pop, setPop] = useState<"assign" | "members" | "labels" | "move" | "due" | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [item, setItem] = useState("");
  const [comment, setComment] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const itemInput = useRef<HTMLInputElement>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["card", id] }); void qc.invalidateQueries({ queryKey: ["board", d.board.id] }); };
  const patch = useMutation({ mutationFn: (body: Record<string, unknown>) => api.patch(`/api/boards/cards/${id}`, body), onSuccess: refresh, onError: failed(toast) });
  const move = useMutation({ mutationFn: (listId: string) => api.post(`/api/boards/cards/${id}/move`, { listId }), onSuccess: () => { refresh(); toast("Moved"); }, onError: failed(toast) });
  const copy = useMutation({ mutationFn: () => api.post(`/api/boards/cards/${id}/copy`, {}), onSuccess: () => { refresh(); toast("Copied"); }, onError: failed(toast) });
  const addItem = useMutation({ mutationFn: (label: string) => api.post(`/api/workflows/tasks/${id}/items`, { label }), onSuccess: () => { setItem(""); refresh(); }, onError: failed(toast) });
  // Ticks show at once; the server catches up (and a failure puts it back).
  const tick = useMutation({
    mutationFn: (v: { itemId: string; done: boolean }) => api.patch(`/api/workflows/tasks/${id}/items/${v.itemId}`, { done: v.done }),
    onMutate: (v) => qc.setQueryData<CardDetail>(["card", id], (old) => old && { ...old, items: old.items.map((i) => (i.id === v.itemId ? { ...i, done: v.done } : i)) }),
    onSettled: refresh, onError: failed(toast),
  });
  const dropItem = useMutation({ mutationFn: (itemId: string) => api.del(`/api/workflows/tasks/${id}/items/${itemId}`), onSuccess: refresh, onError: failed(toast) });
  const say = useMutation({ mutationFn: () => api.post(`/api/workflows/tasks/${id}/comments`, { body: comment.trim() }), onSuccess: () => { setComment(""); refresh(); }, onError: failed(toast) });
  const upload = async (file?: File) => {
    if (!file) return;
    try { await api.upload("/api/files", file, { kind: "system", linkType: "task", linkId: id }); refresh(); toast("Attached"); } catch (e) { failed(toast)(e); }
  };
  if (q.isLoading || !q.data) return <Overlay onClose={onClose} label="Card"><div style={{ padding: 40 }}><Loading /></div></Overlay>;
  const { card, items, comments, files, canEdit, canDelete, lead } = q.data;
  const list = d.lists.find((l) => l.id === card.listId);
  const mine = d.labels.filter((l) => card.labels.includes(l.id));
  const done = items.filter((i) => i.done).length;
  const due = dueChip(card.dueAt, card.status === "done");
  const activity = [
    ...comments.map((c) => ({ at: c.createdAt, who: c.author.name, body: c.body as string | null, text: null as string | null })),
    ...card.history.map((h) => ({ at: h.at, who: h.byName, body: null, text: h.text })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const setLabels = (lid: string) => patch.mutate({ labelIds: card.labels.includes(lid) ? card.labels.filter((x) => x !== lid) : [...card.labels, lid] });
  return (
    <Overlay onClose={onClose} label={card.title}>
      <div className="bdm-head">
        <div className="grow">
          {title !== null && canEdit
            ? <input className="input bdm-title-in" autoFocus value={title} aria-label="Card title" onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim() && title !== card.title) patch.mutate({ title: title.trim() }); setTitle(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setTitle(null); }} />
            : <h3 className={canEdit ? "editable" : ""} onClick={() => canEdit && setTitle(card.title)}>{card.title}</h3>}
          <small>In list <b>{list?.name}</b>{card.createdBy ? ` · added by ${card.createdBy.name} on ${fmtDate(card.createdAt, { day: "numeric", month: "short" })}` : ""}{card.archived ? " · archived" : ""}</small>
        </div>
        <button className="bdm-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="bdm-body">
        <div className="bdm-main">
          <div className="bdm-meta">
            <div style={{ position: "relative" }}><small>Assigned</small>
              <div className="row2">
                {[card.assignee, ...card.members].filter((p, i, a): p is Person => !!p && a.findIndex((x) => x?.id === p.id) === i).map((p) => <span key={p.id} title={p.name}><Avatar name={p.name} size={30} /></span>)}
                {canEdit && <button className="bdm-plus" aria-label="Assign" onClick={() => setPop("assign")}><Plus size={15} /></button>}
              </div>
              {pop === "assign" && <PersonPicker people={d.people} me={d.me} allowOthers={lead} picked={card.assignee ? [card.assignee.id] : []}
                onPick={(p) => patch.mutate({ assigneeUserId: p.id })} onClose={() => setPop(null)} />}
            </div>
            <div style={{ position: "relative" }}><small>Labels</small>
              <div className="row2">{mine.map((l) => <LabelChip key={l.id} l={l} big />)}{canEdit && <button className="bdm-plus" aria-label="Labels" onClick={() => setPop("labels")}><Plus size={15} /></button>}</div>
              {pop === "labels" && <LabelPicker board={d.board.id} labels={d.labels} chosen={card.labels} onToggle={setLabels} onClose={() => setPop(null)} />}
            </div>
            <div><small>Due</small>
              <div className="row2">
                {canEdit ? <input className="input bdm-date" type="date" aria-label="Due date" value={card.dueAt ? isoDay(new Date(card.dueAt)) : ""} onChange={(e) => patch.mutate({ dueDate: e.target.value || null })} />
                  : due ? <span className={`bd-due ${due.tone}`}><Clock size={12} />{due.text}</span> : <span className="muted">No date</span>}
                {due && <span className={`bd-due ${due.tone}`}>{due.tone === "late" ? "Overdue" : due.tone === "ok" ? "Done" : due.text}</span>}
              </div>
            </div>
          </div>

          <section className="bdm-sec"><header><AlignLeft size={17} /><b>Description</b><span className="grow" />{canEdit && desc === null && <Button size="sm" variant="secondary" onClick={() => setDesc(card.description ?? "")}>Edit</Button>}</header>
            {desc !== null ? <>
              <textarea className="bd-area" autoFocus rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Description" />
              <div className="row bdm-save"><Button size="sm" loading={patch.isPending} onClick={() => { patch.mutate({ description: desc }); setDesc(null); }}>Save</Button><Button size="sm" variant="secondary" onClick={() => setDesc(null)}>Cancel</Button></div>
            </> : card.description ? <div className="bdm-desc"><Rich text={card.description} /></div>
              : <button className="bdm-empty" disabled={!canEdit} onClick={() => setDesc("")}>{canEdit ? "Add a more detailed description" : "No description"}</button>}
          </section>

          <section className="bdm-sec"><header><CheckSquare size={17} /><b>Checklist</b><span className="grow" />
            {!!items.length && <Button size="sm" variant="secondary" onClick={() => setHideDone((v) => !v)}>{hideDone ? "Show done" : "Hide done"}</Button>}</header>
            {!!items.length && <div className="bdm-bar"><span>{Math.round((done / items.length) * 100)}%</span><div><i style={{ width: `${(done / items.length) * 100}%` }} /></div></div>}
            {items.filter((i) => !hideDone || !i.done).map((i) => (
              <div key={i.id} className={`bd-item${i.done ? " done" : ""}`}>
                <input type="checkbox" checked={i.done} disabled={!canEdit} aria-label={i.label} onChange={(e) => tick.mutate({ itemId: i.id, done: e.target.checked })} />
                <span className="grow">{i.label}</span>
                {canEdit && <button className="bd-ic" aria-label={`Remove ${i.label}`} onClick={() => dropItem.mutate(i.id)}><X size={14} /></button>}
              </div>
            ))}
            {canEdit && <div className="bd-additem"><Plus size={15} /><input ref={itemInput} value={item} placeholder="Add an item and press Enter" aria-label="New checklist item" onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) addItem.mutate(item.trim()); }} /></div>}
          </section>

          <section className="bdm-sec"><header><Paperclip size={17} /><b>Attachments</b><span className="grow" />{canEdit && <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>Add</Button>}</header>
            <input ref={fileInput} type="file" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            {!files.length ? <p className="muted bdm-small">No files yet.</p> : <div className="bdm-files">{files.map((f) => (
              <a key={f.id} className="bdm-file" href={`/api/files/${f.id}/content`} target="_blank" rel="noreferrer">
                <span className="th">{(f.name.split(".").pop() ?? "file").slice(0, 4).toUpperCase()}</span>
                <span className="grow"><b>{f.name}</b><small>Added {fmtDate(f.createdAt, { day: "numeric", month: "short" })}</small></span>
              </a>
            ))}</div>}
          </section>

          <section className="bdm-sec"><header><Activity size={17} /><b>Activity</b></header>
            <div className="bdm-comment"><textarea rows={comment ? 3 : 1} value={comment} placeholder="Write a comment... use @ to mention someone" aria-label="Write a comment" onChange={(e) => setComment(e.target.value)} />
              {comment.trim() && <Button size="sm" loading={say.isPending} onClick={() => say.mutate()}>Save</Button>}</div>
            {activity.map((a, i) => (
              <div key={i} className="bdm-act"><Avatar name={a.who} size={28} />
                <div className="grow">{a.body !== null ? <><b>{a.who}</b> <small>{fmtDate(a.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small><div className="bdm-bubble">{a.body}</div></>
                  : <><b>{a.who}</b> {a.text} <small>{fmtDate(a.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small></>}</div>
              </div>
            ))}
          </section>
        </div>

        <aside className="bdm-side">
          {canEdit && <><small>Add to card</small>
            <button onClick={() => setPop("assign")}><User size={15} />Assign</button>
            <button onClick={() => setPop("labels")}><Tag size={15} />Labels</button>
            <button onClick={() => itemInput.current?.focus()}><CheckSquare size={15} />Checklist</button>
            <button onClick={() => (document.querySelector(".bdm-date") as HTMLInputElement | null)?.showPicker?.()}><CalendarIcon size={15} />Due date</button>
            <button onClick={() => fileInput.current?.click()}><Paperclip size={15} />Attachment</button></>}
          <small>Actions</small>
          {card.canMove && <div style={{ position: "relative" }}>
            <button onClick={() => setPop(pop === "move" ? null : "move")}><ArrowRight size={15} />Move</button>
            {pop === "move" && <MovePicker lists={d.lists} current={card.listId} onPick={(l) => { move.mutate(l); setPop(null); }} onClose={() => setPop(null)} />}
          </div>}
          <button onClick={() => copy.mutate()}><Copy size={15} />Copy</button>
          {canEdit && <button onClick={() => patch.mutate({ archived: !card.archived }, { onSuccess: () => { toast(card.archived ? "Brought back to the board" : "Archived"); if (!card.archived) onClose(); } })}><Archive size={15} />{card.archived ? "Bring back" : "Archive"}</button>}
          {canDelete && <button className="danger" onClick={() => setDeleting(true)}><Trash2 size={15} />Delete</button>}
        </aside>
      </div>
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} danger title={`Delete "${card.title}"?`} confirmLabel="Delete card"
        onConfirm={async () => { setDeleting(false); try { await api.del(`/api/boards/cards/${id}`); refresh(); toast("Card deleted"); onClose(); } catch (e) { failed(toast)(e); } }}>
        The card, its checklist and comments are removed. To keep it out of the way instead, archive it.
      </ConfirmDialog>
    </Overlay>
  );
}

function MovePicker({ lists, current, onPick, onClose }: { lists: List[]; current: string; onPick: (id: string) => void; onClose: () => void }) {
  const ref = useDismiss(true, onClose);
  return (
    <div className="bd-pop right" ref={ref} role="dialog" aria-label="Move to">
      <div className="bd-pop-title">Move to</div>
      {lists.map((l) => <button key={l.id} className="bd-opt" disabled={l.id === current} onClick={() => onPick(l.id)}><i className="bd-dot" style={{ background: LIST_DOT[l.kind] }} />{l.name}{l.id === current ? " (here)" : ""}</button>)}
    </div>
  );
}

// ---------------- table and calendar views ----------------

function TableView({ d, cards, onOpen }: { d: BoardData; cards: Card[]; onOpen: (id: string) => void }) {
  if (!cards.length) return <EmptyState title="No cards match">Try another search or filter.</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="table bd-table">
        <thead><tr><th>Card</th><th>List</th><th>Assigned</th><th>Due</th><th className="hide-sm">Checklist</th></tr></thead>
        <tbody>{cards.map((c) => {
          const due = dueChip(c.dueAt, c.status === "done");
          return (
            <tr key={c.id} className="clickable" onClick={() => onOpen(c.id)}>
              <td><b className="ink">{c.title}</b><div className="bd-lbls">{d.labels.filter((l) => c.labels.includes(l.id)).map((l) => <LabelChip key={l.id} l={l} />)}</div></td>
              <td>{d.lists.find((l) => l.id === c.listId)?.name}</td>
              <td>{c.assignee ? <span className="row" style={{ gap: 8 }}><Avatar name={c.assignee.name} size={24} />{c.assignee.name}</span> : <span className="muted">No one</span>}</td>
              <td>{due ? <span className={`bd-due ${due.tone}`}><Clock size={12} />{due.text}</span> : <span className="muted">No date</span>}</td>
              <td className="hide-sm">{c.counts.items ? `${c.counts.itemsDone} of ${c.counts.items}` : "-"}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function CalendarView({ d, cards, onOpen }: { d: BoardData; cards: Card[]; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(() => { const x = new Date(); x.setDate(1); x.setHours(0, 0, 0, 0); return x; });
  const first = new Date(month); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return x; });
  const today = isoDay(new Date());
  const byDay = new Map<string, Card[]>();
  for (const c of cards) if (c.dueAt) { const k = isoDay(new Date(c.dueAt)); byDay.set(k, [...(byDay.get(k) ?? []), c]); }
  const noDate = cards.filter((c) => !c.dueAt).length;
  const shift = (n: number) => setMonth((m) => { const x = new Date(m); x.setMonth(x.getMonth() + n); return x; });
  return (
    <div className="card bd-calcard">
      <div className="bd-calhead"><b>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b><span className="grow" />
        {!!noDate && <span className="muted">{noDate} card{noDate === 1 ? "" : "s"} without a date</span>}
        <button className="bd-ic" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
        <button className="bd-ic" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={16} /></button></div>
      <div className="bd-cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => <div key={w} className="wd">{w}</div>)}
        {days.map((x) => {
          const k = isoDay(x), list = byDay.get(k) ?? [];
          return (
            <div key={k} className={`bd-day${x.getMonth() !== month.getMonth() ? " out" : ""}${k === today ? " today" : ""}`}>
              <span className="num">{x.getDate()}</span>
              {list.slice(0, 3).map((c) => {
                const l = d.labels.find((y) => c.labels.includes(y.id));
                return <button key={c.id} className={`bd-calcard-item${c.status === "done" ? " done" : ""}`} onClick={() => onOpen(c.id)}
                  style={{ borderLeftColor: l ? LABEL_COLORS[l.color]?.dot : "var(--line)" }}>{c.title}</button>;
              })}
              {list.length > 3 && <small className="muted">+{list.length - 3} more</small>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- the board ----------------

/**
 * The team board (like Trello): lists of cards you drag from one to another, a table and a calendar of the same
 * cards, search and filters. Everyone on the team sees every card; people add and move their own, and the team lead
 * gives out cards and moves anyone's. A new person's first tasks sit in Getting started.
 */
export function Board() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const boards = useQuery({ queryKey: ["boards"], queryFn: () => api.get<{ boards: { id: string; name: string; lead: boolean; personal: boolean }[] }>("/api/boards") });
  const boardId = params.get("board") ?? boards.data?.boards[0]?.id ?? null;
  const [showArchived, setShowArchived] = useState(false);
  const q = useQuery({ queryKey: ["board", boardId, showArchived], enabled: !!boardId, queryFn: () => api.get<BoardData>(`/api/boards/${boardId}${showArchived ? "?archived=1" : ""}`) });
  const [view, setView] = useState<"board" | "table" | "calendar">(() => { try { return (localStorage.getItem("wv-board-view") as "board") || "board"; } catch { return "board"; } });
  const [search, setSearch] = useState("");
  const [who, setWho] = useState<string[]>([]);
  const [lbls, setLbls] = useState<string[]>([]);
  const [due, setDue] = useState<"" | "late" | "week" | "none">("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [active, setActive] = useState<Card | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<List | null>(null);
  const [newName, setNewName] = useState("");
  const [removing, setRemoving] = useState<List | null>(null);
  const [addingList, setAddingList] = useState(false);
  const from = useRef<string | null>(null);
  useEffect(() => { if (q.data) setCards(q.data.cards); }, [q.data]);
  useEffect(() => { try { localStorage.setItem("wv-board-view", view); } catch { /* private window */ } }, [view]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const d = q.data;
  const lead = d?.role === "lead";
  const shown = useMemo(() => {
    if (!d) return [];
    const s = search.trim().toLowerCase();
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return cards.filter((c) => {
      const people = [c.assignee?.id, ...c.members.map((m) => m.id)];
      if (onlyMine && !people.includes(d.me)) return false;
      if (who.length && !who.some((w) => people.includes(w))) return false;
      if (lbls.length && !lbls.some((l) => c.labels.includes(l))) return false;
      if (due === "none" && c.dueAt) return false;
      if (due === "late" && (!c.dueAt || new Date(c.dueAt) >= today || c.status === "done")) return false;
      if (due === "week" && (!c.dueAt || new Date(c.dueAt) > weekEnd)) return false;
      return !s || c.title.toLowerCase().includes(s) || (c.description ?? "").toLowerCase().includes(s);
    });
  }, [cards, d, search, who, lbls, due, onlyMine]);
  const inList = (listId: string) => shown.filter((c) => c.listId === listId).sort((a, b) => a.position - b.position);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["board", boardId] }); void qc.invalidateQueries({ queryKey: ["home"] }); };
  const cardId = params.get("card") ?? params.get("task");
  const openCard = (id: string | null) => { const p = new URLSearchParams(params); p.delete("task"); if (id) p.set("card", id); else p.delete("card"); setParams(p, { replace: true }); };
  const pickBoard = (id: string) => { const p = new URLSearchParams(params); p.set("board", id); setParams(p, { replace: true }); };

  const listOf = (id: string | number | undefined) => {
    const s = String(id ?? "");
    if (s.startsWith("list:")) return s.slice(5);
    return cards.find((c) => c.id === s)?.listId ?? null;
  };
  const onStart = (e: DragStartEvent) => { const c = cards.find((x) => x.id === e.active.id) ?? null; setActive(c); from.current = c?.listId ?? null; };
  // Moving across lists while dragging: the card joins the other list at once, so the drop shows where it lands.
  const onOver = (e: DragOverEvent) => {
    const to = listOf(e.over?.id);
    const id = String(e.active.id);
    setCards((cs) => { const c = cs.find((x) => x.id === id); return !c || !to || c.listId === to ? cs : cs.map((x) => (x.id === id ? { ...x, listId: to } : x)); });
  };
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    droppedAt = Date.now();
    const id = String(e.active.id);
    const card = cards.find((c) => c.id === id);
    const to = listOf(e.over?.id) ?? card?.listId;
    if (!card || !to) return;
    const others = cards.filter((c) => c.listId === to && c.id !== id).sort((a, b) => a.position - b.position);
    const overIndex = others.findIndex((c) => c.id === String(e.over?.id));
    const at = overIndex === -1 ? others.length : overIndex;
    const before = others[at - 1]?.position, after = others[at]?.position;
    const position = before == null && after == null ? 1 : before == null ? after! - 1 : after == null ? before + 1 : (before + after) / 2;
    if (to === from.current && Math.abs(position - card.position) < 1e-9) return;
    setCards((cs) => cs.map((x) => (x.id === id ? { ...x, listId: to, position } : x)));
    api.post(`/api/boards/cards/${id}/move`, { listId: to, position }).then(refresh).catch((err) => { failed(toast)(err); refresh(); });
  };
  const addList = useMutation({ mutationFn: () => api.post(`/api/boards/${boardId}/lists`, { name: newName.trim() }), onSuccess: () => { setNewName(""); setAddingList(false); refresh(); }, onError: failed(toast) });
  const rename = useMutation({ mutationFn: () => api.patch(`/api/boards/lists/${renaming!.id}`, { name: newName.trim() }), onSuccess: () => { setRenaming(null); setNewName(""); refresh(); }, onError: failed(toast) });

  if (boards.isLoading || (boardId && q.isLoading)) return <Loading />;
  if (!d) return <EmptyState title="Your board couldn't be opened">Try again in a moment.</EmptyState>;
  const leadNames = d.people.filter((p) => d.leads.includes(p.id)).map((p) => p.name);
  const filtered = !!(search || who.length || lbls.length || due || onlyMine);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="bd">
      <div className="bd-head">
        {(boards.data?.boards.length ?? 0) > 1
          ? <select className="select bd-pick" aria-label="Board" value={d.board.id} onChange={(e) => pickBoard(e.target.value)}>{boards.data!.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          : <b className="bd-name">{d.board.name}</b>}
        {!d.board.personal && <span className="muted bd-led">{leadNames.length ? `Led by ${leadNames.join(", ")}` : "No team lead set"}</span>}
        <span className="grow" />
        {!d.board.personal && <span className="bd-team" title={d.people.map((p) => p.name).join(", ")}>{d.people.slice(0, 6).map((p) => <Avatar key={p.id} name={p.name} size={28} />)}</span>}
        <Button icon={<Plus size={16} />} onClick={() => setAdding(d.lists.find((l) => l.kind === "todo")?.id ?? d.lists[0]!.id)}>Add card</Button>
      </div>
      <div className="bd-bar">
        <div className="seg" role="group" aria-label="View">
          <button className={view === "board" ? "on" : ""} onClick={() => setView("board")}><Columns3 size={15} />Board</button>
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Table2 size={15} />Table</button>
          <button className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}><CalendarIcon size={15} />Calendar</button>
        </div>
        <div className="bd-search wide"><Search size={15} /><input value={search} placeholder="Search cards" aria-label="Search cards" onChange={(e) => setSearch(e.target.value)} /></div>
        {!d.board.personal && <Menu align="left" trigger={(t) => <button className={`bd-chip${who.length ? " on" : ""}`} onClick={t}><User size={15} />Members{who.length ? ` (${who.length})` : ""}</button>}>
          {() => <>{d.people.map((p) => <button key={p.id} onClick={() => toggle(who, setWho, p.id)}>{who.includes(p.id) ? "✓ " : ""}{p.name}</button>)}</>}
        </Menu>}
        <Menu align="left" trigger={(t) => <button className={`bd-chip${lbls.length ? " on" : ""}`} onClick={t}><Tag size={15} />Labels{lbls.length ? ` (${lbls.length})` : ""}</button>}>
          {() => <>{d.labels.map((l) => <button key={l.id} onClick={() => toggle(lbls, setLbls, l.id)}>{lbls.includes(l.id) ? "✓ " : ""}{l.name}</button>)}</>}
        </Menu>
        <Menu align="left" trigger={(t) => <button className={`bd-chip${due ? " on" : ""}`} onClick={t}><Clock size={15} />{due === "late" ? "Overdue" : due === "week" ? "Due this week" : due === "none" ? "No date" : "Due"}</button>}>
          {(close) => <>{([["", "Any time"], ["late", "Overdue"], ["week", "Due this week"], ["none", "No date"]] as const).map(([v, l]) => <button key={v} onClick={() => { setDue(v); close(); }}>{due === v ? "✓ " : ""}{l}</button>)}</>}
        </Menu>
        {filtered && <button className="bd-clear" onClick={() => { setSearch(""); setWho([]); setLbls([]); setDue(""); setOnlyMine(false); }}>Clear</button>}
        <span className="grow" />
        {!d.board.personal && <div className="seg" role="group" aria-label="Show">
          <button className={!onlyMine ? "on" : ""} onClick={() => setOnlyMine(false)}>Everyone</button>
          <button className={onlyMine ? "on" : ""} onClick={() => setOnlyMine(true)}>Only mine</button>
        </div>}
        <button className={`bd-chip${showArchived ? " on" : ""}`} onClick={() => setShowArchived((v) => !v)}><Archive size={15} />{showArchived ? "Showing archived" : "Archived"}</button>
      </div>

      {view === "table" ? <TableView d={d} cards={shown} onOpen={openCard} />
        : view === "calendar" ? <CalendarView d={d} cards={shown} onOpen={openCard} />
        : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => { setActive(null); if (q.data) setCards(q.data.cards); }}>
            <div className="bd-lists">
              {d.lists.map((l) => (
                <ListColumn key={l.id} list={l} cards={inList(l.id)} labels={d.labels} lead={lead} onOpen={openCard} onAdd={() => setAdding(l.id)}
                  onRename={() => { setRenaming(l); setNewName(l.name); }} onDelete={() => setRemoving(l)} />
              ))}
              {lead && !showArchived && (addingList ? (
                <form className="bd-list bd-newlist-form" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) addList.mutate(); }}>
                  <input className="input" autoFocus value={newName} placeholder="List name" aria-label="List name" onChange={(e) => setNewName(e.target.value)} />
                  <div className="row"><Button size="sm" type="submit" loading={addList.isPending} disabled={!newName.trim()}>Add list</Button>
                    <button type="button" className="bd-ic" aria-label="Cancel" onClick={() => { setAddingList(false); setNewName(""); }}><X size={16} /></button></div>
                </form>
              ) : <button className="bd-newlist" onClick={() => { setAddingList(true); setNewName(""); }}><Plus size={15} />Add another list</button>)}
            </div>
            <DragOverlay>{active ? <CardFace c={active} labels={d.labels} dragging /> : null}</DragOverlay>
          </DndContext>
        )}

      {adding && <NewCard d={d} listId={adding} onClose={() => setAdding(null)} />}
      {cardId && <CardWindow id={cardId} d={d} onClose={() => openCard(null)} />}
      {renaming && (
        <Overlay onClose={() => setRenaming(null)} label="Rename list" narrow>
          <div className="bdm-head"><div className="grow"><h3>Rename list</h3></div></div>
          <div className="bdm-form"><input className="input" autoFocus aria-label="List name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) rename.mutate(); }} /></div>
          <div className="bdm-foot"><span className="grow" /><Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button><Button loading={rename.isPending} disabled={!newName.trim()} onClick={() => rename.mutate()}>Save</Button></div>
        </Overlay>
      )}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} danger title={`Remove ${removing?.name}?`} confirmLabel="Remove list"
        onConfirm={async () => { const l = removing!; setRemoving(null); try { await api.del(`/api/boards/lists/${l.id}`); refresh(); } catch (e) { failed(toast)(e); } }}>
        Its cards move to To do, so nothing is lost.
      </ConfirmDialog>
    </div>
  );
}
