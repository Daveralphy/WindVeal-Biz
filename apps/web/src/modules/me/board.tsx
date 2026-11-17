import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, Clock, MessageCircle, MoreHorizontal, Plus, Tag, X } from "lucide-react";
import { Avatar, Button, ConfirmDialog, EmptyState, Loading, Menu, Modal, useToast } from "@windveal/ui";
import { api, ApiError } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { TaskDrawer, useTaskRefresh, type TaskView } from "../workflows/tasks";
import "./board.css";

type Person = { id: string; name: string; avatarFileId?: string | null };
type List = { id: string; name: string; kind: "start" | "todo" | "doing" | "done" | "custom"; position: number };
type Card = TaskView & { listId: string; position: number; labels: string[]; members: Person[]; canMove: boolean };
type BoardData = { board: { id: string; name: string; personal: boolean }; role: "lead" | "member"; me: string; lists: List[]; cards: Card[]; people: Person[]; leads: string[] };

export const LABELS: { key: string; color: string; name: string }[] = [
  { key: "red", color: "#e5484d", name: "Urgent" }, { key: "orange", color: "#f08c3a", name: "Orange" }, { key: "yellow", color: "#f4b740", name: "Yellow" },
  { key: "green", color: "#2bb37e", name: "Green" }, { key: "blue", color: "#486fe4", name: "Blue" }, { key: "purple", color: "#8e5cd9", name: "Purple" },
];
const labelColor = (k: string) => LABELS.find((l) => l.key === k)?.color ?? "#999";
const fail = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast(e instanceof ApiError ? e.message : "That didn't work. Try again.", "error");

function dueText(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso), today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  return { text: diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : fmtDate(iso, { day: "numeric", month: "short" }), late: diff < 0 };
}

/** One card's face: labels, title, due date, checklist and comments, and the people on it. */
function CardFace({ c, dragging }: { c: Card; dragging?: boolean }) {
  const due = c.status === "done" ? null : dueText(c.dueAt);
  const people = [c.assignee, ...c.members].filter((p, i, a): p is Person => !!p && a.findIndex((x) => x?.id === p.id) === i);
  return (
    <div className={`bd-card${dragging ? " dragging" : ""}${c.status === "done" ? " done" : ""}`}>
      {!!c.labels.length && <div className="bd-lbls">{c.labels.map((l) => <i key={l} style={{ background: labelColor(l) }} />)}</div>}
      <b>{c.title}</b>
      <div className="bd-meta">
        {due && <span className={due.late ? "late" : ""}><Clock size={12} />{due.text}</span>}
        {!!c.counts.items && <span><CheckSquare size={12} />{c.counts.itemsDone}/{c.counts.items}</span>}
        {!!c.counts.comments && <span><MessageCircle size={12} />{c.counts.comments}</span>}
        <span className="grow" />
        <span className="bd-avs">{people.slice(0, 3).map((p) => <Avatar key={p.id} name={p.name} size={22} />)}</span>
      </div>
    </div>
  );
}

function SortableCard({ c, onOpen, onEdit }: { c: Card; onOpen: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, data: { type: "card", listId: c.listId }, disabled: !c.canMove });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="bd-card-wrap" {...attributes} {...listeners} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); listeners?.onKeyDown?.(e); }} aria-label={c.title}>
      <CardFace c={c} />
      {c.canMove && <button className="bd-edit" aria-label={`Labels and people for ${c.title}`} onClick={(e) => { e.stopPropagation(); onEdit(); }} onPointerDown={(e) => e.stopPropagation()}><Tag size={13} /></button>}
    </div>
  );
}

function ListColumn({ list, cards, lead, board, people, me, onOpen, onEdit, onRename, onDelete }: {
  list: List; cards: Card[]; lead: boolean; board: string; people: Person[]; me: string;
  onOpen: (id: string) => void; onEdit: (c: Card) => void; onRename: () => void; onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${list.id}`, data: { type: "list", listId: list.id } });
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(me);
  const add = useMutation({
    mutationFn: () => api.post(`/api/boards/${board}/cards`, { title: title.trim(), listId: list.id, assigneeUserId: assignee || null }),
    onSuccess: () => { setTitle(""); void qc.invalidateQueries({ queryKey: ["board", board] }); },
    onError: fail(toast),
  });
  const fixed = list.kind === "todo" || list.kind === "doing" || list.kind === "done";
  return (
    <section className={`bd-list${isOver ? " over" : ""}`} aria-label={list.name}>
      <header>
        <h3>{list.name}</h3><span className="n">{cards.length}</span>
        {lead && <Menu trigger={(t) => <button className="bd-ic" aria-label={`${list.name} options`} onClick={t}><MoreHorizontal size={16} /></button>}>
          {(close) => <>
            <button onClick={() => { close(); onRename(); }}>Rename list</button>
            {!fixed && <button className="danger" onClick={() => { close(); onDelete(); }}>Remove list</button>}
          </>}
        </Menu>}
      </header>
      <div ref={setNodeRef} className="bd-cards">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => <SortableCard key={c.id} c={c} onOpen={() => onOpen(c.id)} onEdit={() => onEdit(c)} />)}
        </SortableContext>
      </div>
      {adding ? (
        <form className="bd-add-form" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(); }}>
          <textarea autoFocus rows={2} value={title} placeholder="What needs doing?" aria-label="Card title" onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (title.trim()) add.mutate(); } if (e.key === "Escape") setAdding(false); }} />
          {lead && people.length > 1 && (
            <select className="select" aria-label="Give it to" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.id === me ? "Me" : p.name}</option>)}
            </select>
          )}
          <div className="row"><Button size="sm" type="submit" loading={add.isPending} disabled={!title.trim()}>Add card</Button>
            <button type="button" className="bd-ic" aria-label="Cancel" onClick={() => setAdding(false)}><X size={16} /></button></div>
        </form>
      ) : <button className="bd-add" onClick={() => setAdding(true)}><Plus size={15} />Add a card</button>}
    </section>
  );
}

/** Labels and the people on a card; the lead also chooses who it's for. */
function EditCard({ card, board, lead, people, onClose }: { card: Card; board: BoardData; lead: boolean; people: Person[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [labels, setLabels] = useState(card.labels);
  const [members, setMembers] = useState(card.members.map((m) => m.id));
  const [assignee, setAssignee] = useState(card.assignee?.id ?? "");
  const save = useMutation({
    mutationFn: () => api.patch(`/api/boards/cards/${card.id}`, { labels, memberUserIds: members.filter((m) => m !== assignee), ...(lead ? { assigneeUserId: assignee || null } : {}) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["board", board.board.id] }); onClose(); },
    onError: fail(toast),
  });
  return (
    <Modal open onClose={onClose} title={card.title} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="bd-edit-sec"><b>Labels</b>
        <div className="bd-lbl-pick">{LABELS.map((l) => (
          <button key={l.key} type="button" aria-pressed={labels.includes(l.key)} aria-label={l.key} style={{ background: l.color }}
            onClick={() => setLabels((x) => (x.includes(l.key) ? x.filter((y) => y !== l.key) : [...x, l.key]))}>{labels.includes(l.key) ? "✓" : ""}</button>
        ))}</div>
      </div>
      {lead && <div className="bd-edit-sec"><b>For</b>
        <select className="select" aria-label="Who it's for" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">No one yet</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.id === board.me ? "Me" : p.name}</option>)}
        </select></div>}
      <div className="bd-edit-sec"><b>Also on this card</b>
        {people.filter((p) => p.id !== assignee).map((p) => (
          <label key={p.id} className="bd-person"><input type="checkbox" checked={members.includes(p.id)}
            onChange={(e) => setMembers((x) => (e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))} /><Avatar name={p.name} size={24} />{p.id === board.me ? "Me" : p.name}</label>
        ))}
      </div>
    </Modal>
  );
}

/**
 * The team board (like Trello): lists of cards you drag from one to another. Everyone on the team sees every card;
 * people add and move their own, and the team lead gives out cards and moves anyone's. A new person's first
 * tasks sit in Getting started.
 */
export function Board() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const refreshTasks = useTaskRefresh();
  const boards = useQuery({ queryKey: ["boards"], queryFn: () => api.get<{ boards: { id: string; name: string; lead: boolean; personal: boolean }[] }>("/api/boards") });
  const boardId = params.get("board") ?? boards.data?.boards[0]?.id ?? null;
  const q = useQuery({ queryKey: ["board", boardId], enabled: !!boardId, queryFn: () => api.get<BoardData>(`/api/boards/${boardId}`) });
  const [onlyMine, setOnlyMine] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [active, setActive] = useState<Card | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);
  const [renaming, setRenaming] = useState<List | null>(null);
  const [newName, setNewName] = useState("");
  const [removing, setRemoving] = useState<List | null>(null);
  const [addingList, setAddingList] = useState(false);
  const from = useRef<string | null>(null);
  useEffect(() => { if (q.data) setCards(q.data.cards); }, [q.data]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const d = q.data;
  const lead = d?.role === "lead";
  const shown = useMemo(() => (onlyMine && d ? cards.filter((c) => c.assignee?.id === d.me || c.members.some((m) => m.id === d.me)) : cards), [cards, onlyMine, d]);
  const inList = (listId: string) => shown.filter((c) => c.listId === listId).sort((a, b) => a.position - b.position);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["board", boardId] }); refreshTasks(); };
  const openCard = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("task", id); else p.delete("task"); setParams(p, { replace: true }); };
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
    setCards((cs) => {
      const c = cs.find((x) => x.id === id);
      if (!c || !to || c.listId === to) return cs;
      return cs.map((x) => (x.id === id ? { ...x, listId: to } : x));
    });
  };
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
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
    api.post(`/api/boards/cards/${id}/move`, { listId: to, position }).then(refresh).catch((err) => { fail(toast)(err); refresh(); });
  };

  const addList = useMutation({
    mutationFn: () => api.post(`/api/boards/${boardId}/lists`, { name: newName.trim() }),
    onSuccess: () => { setNewName(""); setAddingList(false); refresh(); }, onError: fail(toast),
  });
  const rename = useMutation({
    mutationFn: () => api.patch(`/api/boards/lists/${renaming!.id}`, { name: newName.trim() }),
    onSuccess: () => { setRenaming(null); setNewName(""); refresh(); }, onError: fail(toast),
  });

  if (boards.isLoading || (boardId && q.isLoading)) return <Loading />;
  if (!d) return <EmptyState title="Your board couldn't be opened">Try again in a moment.</EmptyState>;
  const leadNames = d.people.filter((p) => d.leads.includes(p.id)).map((p) => p.name);
  return (
    <div className="bd">
      <div className="bd-top">
        {(boards.data?.boards.length ?? 0) > 1
          ? <select className="select bd-pick" aria-label="Board" value={d.board.id} onChange={(e) => pickBoard(e.target.value)}>
              {boards.data!.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          : <b className="bd-name">{d.board.name}</b>}
        {!d.board.personal && <span className="bd-team" title={d.people.map((p) => p.name).join(", ")}>{d.people.slice(0, 6).map((p) => <Avatar key={p.id} name={p.name} size={28} />)}</span>}
        {!d.board.personal && <span className="muted bd-led">{leadNames.length ? `Led by ${leadNames.join(", ")}` : "No team lead set"}</span>}
        <span className="grow" />
        {!d.board.personal && <div className="seg" role="group" aria-label="Show">
          <button className={!onlyMine ? "on" : ""} onClick={() => setOnlyMine(false)}>Everyone</button>
          <button className={onlyMine ? "on" : ""} onClick={() => setOnlyMine(true)}>Only mine</button>
        </div>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => { setActive(null); if (q.data) setCards(q.data.cards); }}>
        <div className="bd-lists">
          {d.lists.map((l) => (
            <ListColumn key={l.id} list={l} cards={inList(l.id)} lead={lead} board={d.board.id} people={d.people} me={d.me}
              onOpen={openCard} onEdit={setEditing} onRename={() => { setRenaming(l); setNewName(l.name); }} onDelete={() => setRemoving(l)} />
          ))}
          {lead && (addingList ? (
            <form className="bd-list bd-newlist-form" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) addList.mutate(); }}>
              <input className="input" autoFocus value={newName} placeholder="List name" aria-label="List name" onChange={(e) => setNewName(e.target.value)} />
              <div className="row"><Button size="sm" type="submit" loading={addList.isPending} disabled={!newName.trim()}>Add list</Button>
                <button type="button" className="bd-ic" aria-label="Cancel" onClick={() => { setAddingList(false); setNewName(""); }}><X size={16} /></button></div>
            </form>
          ) : <button className="bd-newlist" onClick={() => { setAddingList(true); setNewName(""); }}><Plus size={15} />Add another list</button>)}
        </div>
        <DragOverlay>{active ? <CardFace c={active} dragging /> : null}</DragOverlay>
      </DndContext>
      {editing && <EditCard card={editing} board={d} lead={lead} people={d.people} onClose={() => setEditing(null)} />}
      {renaming && (
        <Modal open onClose={() => setRenaming(null)} title="Rename list" footer={<><Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button><Button loading={rename.isPending} disabled={!newName.trim()} onClick={() => rename.mutate()}>Save</Button></>}>
          <input className="input" autoFocus aria-label="List name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </Modal>
      )}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} danger title={`Remove ${removing?.name}?`} confirmLabel="Remove list"
        onConfirm={async () => { const l = removing!; setRemoving(null); try { await api.del(`/api/boards/lists/${l.id}`); refresh(); } catch (e) { fail(toast)(e); } }}>
        Its cards move to To do, so nothing is lost.
      </ConfirmDialog>
      <TaskDrawer id={params.get("task")} onClose={() => { openCard(null); refresh(); }} />
    </div>
  );
}
