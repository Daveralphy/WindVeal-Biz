import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, inArray, isNull, or, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { boardLabels, boardLists, fileLinks, files, taskComments, taskItems, tasks, users } from "../../db/schema";
import { needPersonal, requireOrg, type OrgContext } from "../../lib/context";
import { badRequest, conflict, forbidden, notFound, parse } from "../../lib/http";
import { notify } from "../../lib/audit";
import { createTask } from "../../lib/tasks";
import { boardPeople, boardRole, gatherCards, listsOf, loadBoard, myBoards, type Board, type BoardRole } from "../../lib/boards";
import { completeTask, taskViews } from "../workflows/routes";

const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "grey"] as const;
const DEFAULT_LABELS = [
  { name: "Urgent", color: "red" }, { name: "Client", color: "blue" }, { name: "Report", color: "yellow" },
  { name: "Proposal", color: "green" }, { name: "Onboarding", color: "purple" },
] as const;
const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
type Task = typeof tasks.$inferSelect;
type Entry = Task["history"][number];

async function openBoard(ctx: OrgContext, id: string): Promise<{ board: Board; role: BoardRole }> {
  if (!uuid.safeParse(id).success) throw notFound("That board");
  const board = await loadBoard(ctx.org.id, id);
  const role = board ? await boardRole(ctx, board) : null;
  if (!board || !role) throw notFound("That board");
  return { board, role };
}

async function loadCard(ctx: OrgContext, id: string) {
  if (!uuid.safeParse(id).success) throw notFound("That card");
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.orgId, ctx.org.id), isNull(tasks.deletedAt))).limit(1);
  if (!t?.boardId) throw notFound("That card");
  const { board, role } = await openBoard(ctx, t.boardId);
  return { t, board, role };
}

/** Whose card it is: its assignee, the people on it, or whoever made it. They (and the lead) can change and move it. */
const isMine = (ctx: OrgContext, t: Task) => t.assigneeUserId === ctx.user.id || t.createdBy === ctx.user.id || (t.memberUserIds ?? []).includes(ctx.user.id);
const entry = (ctx: OrgContext, text: string): Entry => ({ at: new Date().toISOString(), by: ctx.user.id, byName: ctx.user.name, text });
const dueOf = (d: string | null | undefined) => (d ? new Date(`${d}T17:00:00`) : null);

async function nextPosition(boardId: string, listId: string) {
  const [r] = await db.select({ p: dsql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks)
    .where(and(eq(tasks.boardId, boardId), eq(tasks.listId, listId), isNull(tasks.deletedAt)));
  return Number(r?.p ?? 0) + 1;
}

/** The board's labels, made with a useful starting set the first time. Old cards' colour-only labels become these. */
async function labelsOf(board: Board) {
  let rows = await db.select().from(boardLabels).where(and(eq(boardLabels.boardId, board.id), isNull(boardLabels.deletedAt))).orderBy(asc(boardLabels.position));
  if (!rows.length) {
    await db.insert(boardLabels).values(DEFAULT_LABELS.map((l, i) => ({ orgId: board.orgId, boardId: board.id, name: l.name, color: l.color, position: i })));
    rows = await db.select().from(boardLabels).where(and(eq(boardLabels.boardId, board.id), isNull(boardLabels.deletedAt))).orderBy(asc(boardLabels.position));
  }
  return rows;
}
function labelIds(t: Task, labels: (typeof boardLabels.$inferSelect)[]) {
  return (t.labels ?? []).map((l) => labels.find((x) => x.id === l)?.id ?? labels.find((x) => x.color === l)?.id).filter((x): x is string => !!x);
}

async function people(ids: string[]) {
  const list = [...new Set(ids)];
  if (!list.length) return new Map<string, { id: string; name: string; avatarFileId: string | null }>();
  return new Map((await db.select({ id: users.id, name: users.name, avatarFileId: users.avatarFileId }).from(users).where(inArray(users.id, list))).map((u) => [u.id, u]));
}

async function cardViews(ctx: OrgContext, role: BoardRole, rows: Task[], labels: (typeof boardLabels.$inferSelect)[]) {
  const views = await taskViews(rows);
  const names = await people(rows.flatMap((t) => t.memberUserIds ?? []));
  return rows.map((t, i) => ({
    ...views[i]!, listId: t.listId, position: t.position, labels: labelIds(t, labels), archived: !!t.archivedAt,
    members: (t.memberUserIds ?? []).map((id) => names.get(id)).filter(Boolean),
    canMove: role === "lead" || isMine(ctx, t),
  }));
}

export default async function boardRoutes(app: FastifyInstance) {
  /** The boards someone can open: their team's (or a personal one), and any they lead. */
  app.get("/api/boards", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const list = await myBoards(ctx);
    return { boards: list.map(({ board, role }) => ({ id: board.id, name: board.name, lead: role === "lead", personal: !board.departmentId })) };
  });

  /** A board: its lists, labels, cards, and the people on it (with how many open cards each has). */
  app.get<{ Params: { id: string }; Querystring: { archived?: string } }>("/api/boards/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { board, role } = await openBoard(ctx, req.params.id);
    const team = await boardPeople(board);
    await gatherCards(board, team.staff);
    const [lists, labels] = await Promise.all([listsOf(board.id), labelsOf(board)]);
    const doneList = lists.find((l) => l.kind === "done");
    const archived = req.query.archived === "1";
    // Done long ago drops off the board (it's still in the person's task history).
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await db.select().from(tasks).where(and(eq(tasks.boardId, board.id), isNull(tasks.deletedAt),
      archived ? dsql`${tasks.archivedAt} is not null` : isNull(tasks.archivedAt),
      or(dsql`${tasks.status} <> 'done'`, gte(tasks.completedAt, since)))).orderBy(asc(tasks.position));
    // Finished or reopened elsewhere (from a task page or the chat): keep the card in the right list.
    for (const t of rows) {
      const l = lists.find((x) => x.id === t.listId);
      const fix = t.status === "done" && l?.kind !== "done" && doneList ? doneList
        : t.status !== "done" && l?.kind === "done" ? lists.find((x) => x.kind === "todo") ?? lists[0] : !l ? lists[0] : null;
      if (fix) { await db.update(tasks).set({ listId: fix.id }).where(eq(tasks.id, t.id)); t.listId = fix.id; }
    }
    const shown = rows.filter((t) => lists.some((l) => l.id === t.listId));
    const names = await people(team.members);
    const open = await db.select({ who: tasks.assigneeUserId, n: dsql<number>`count(*)::int` }).from(tasks)
      .where(and(eq(tasks.orgId, ctx.org.id), isNull(tasks.deletedAt), dsql`${tasks.status} <> 'done'`, inArray(tasks.assigneeUserId, team.members.length ? team.members : [ctx.user.id])))
      .groupBy(tasks.assigneeUserId);
    return {
      board: { id: board.id, name: board.name, personal: !board.departmentId },
      role, me: ctx.user.id,
      lists: lists.map((l) => ({ id: l.id, name: l.name, kind: l.kind, position: l.position })),
      labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      cards: await cardViews(ctx, role, shown, labels),
      people: team.members.map((id) => names.get(id)).filter(Boolean).map((p) => ({ ...p!, openCards: open.find((o) => o.who === p!.id)?.n ?? 0 })),
      leads: team.leads,
    };
  });

  /** One card, everything on it: details, checklist, comments, files and what happened to it. */
  app.get<{ Params: { id: string } }>("/api/boards/cards/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { t, board, role } = await loadCard(ctx, req.params.id);
    const labels = await labelsOf(board);
    const [items, comments, linked, [view]] = await Promise.all([
      db.select().from(taskItems).where(and(eq(taskItems.taskId, t.id), isNull(taskItems.deletedAt))).orderBy(asc(taskItems.position), asc(taskItems.createdAt)),
      db.select({ c: taskComments, name: users.name }).from(taskComments).innerJoin(users, eq(users.id, taskComments.authorUserId))
        .where(and(eq(taskComments.taskId, t.id), isNull(taskComments.deletedAt))).orderBy(asc(taskComments.createdAt)),
      db.select({ f: files }).from(fileLinks).innerJoin(files, eq(files.id, fileLinks.fileId))
        .where(and(eq(fileLinks.orgId, ctx.org.id), eq(fileLinks.linkType, "task"), eq(fileLinks.linkId, t.id), isNull(files.deletedAt))),
      cardViews(ctx, role, [t], labels),
    ]);
    const canEdit = role === "lead" || isMine(ctx, t);
    return {
      card: { ...view!, history: t.history ?? [] },
      items: items.map((i) => ({ id: i.id, label: i.label, done: i.done, position: i.position })),
      comments: comments.map(({ c, name }) => ({ id: c.id, body: c.body, author: { id: c.authorUserId, name }, createdAt: c.createdAt })),
      files: linked.map(({ f }) => ({ id: f.id, name: f.name, size: f.size, mime: f.mime, createdAt: f.createdAt })),
      canEdit, canDelete: role === "lead" || t.createdBy === ctx.user.id, lead: role === "lead",
    };
  });

  /** A new card. Anyone on the board can add their own; the lead can give it to anyone on the board. */
  app.post<{ Params: { id: string } }>("/api/boards/:id/cards", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { board, role } = await openBoard(ctx, req.params.id);
    const input = parse(z.object({
      title: z.string().trim().min(1, "Give the card a title").max(200), listId: uuid,
      description: z.string().trim().max(8000).optional(), assigneeUserId: uuid.nullable().optional(), dueDate: day.nullable().optional(),
      labelIds: z.array(uuid).max(10).optional(), items: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
    }), req.body);
    const list = (await listsOf(board.id)).find((l) => l.id === input.listId);
    if (!list) throw badRequest("Choose a list on this board.");
    const team = await boardPeople(board);
    const assignee = input.assigneeUserId === undefined ? ctx.user.id : input.assigneeUserId;
    if (assignee && assignee !== ctx.user.id) {
      if (role !== "lead") throw forbidden("Only the team lead can give cards to other people. Add it for yourself.");
      if (!team.members.includes(assignee)) throw badRequest("Choose someone on this board.");
    }
    const labels = await labelsOf(board);
    const t = await createTask({
      orgId: ctx.org.id, title: input.title, description: input.description || null, workspace: "workflows",
      assigneeUserId: assignee ?? null, createdBy: ctx.user.id, dueAt: dueOf(input.dueDate),
    });
    const [card] = await db.update(tasks).set({
      boardId: board.id, listId: list.id, position: await nextPosition(board.id, list.id),
      labels: (input.labelIds ?? []).filter((id) => labels.some((l) => l.id === id)), history: [entry(ctx, `added this card to ${list.name}`)],
      ...(list.kind === "done" ? { status: "done" as const, completedAt: new Date(), completedBy: ctx.user.id } : list.kind === "doing" ? { status: "in_progress" as const } : {}),
    }).where(eq(tasks.id, t.id)).returning();
    if (input.items?.length) await db.insert(taskItems).values(input.items.map((label, i) => ({ orgId: ctx.org.id, taskId: t.id, label, position: i + 1 })));
    return { card: (await cardViews(ctx, role, [card!], labels))[0] };
  });

  /** Drag and drop (or Move): a card to another place in its list, or to another list. Done completes it; out of Done reopens it. */
  app.post<{ Params: { id: string } }>("/api/boards/cards/:id/move", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { t, board, role } = await loadCard(ctx, req.params.id);
    if (role !== "lead" && !isMine(ctx, t)) throw forbidden("Only the team lead can move other people's cards.");
    const input = parse(z.object({ listId: uuid, position: z.number().finite().optional() }), req.body);
    const lists = await listsOf(board.id);
    const list = lists.find((l) => l.id === input.listId);
    if (!list) throw badRequest("Choose a list on this board.");
    const from = lists.find((l) => l.id === t.listId);
    await db.update(tasks).set({
      listId: list.id, position: input.position ?? await nextPosition(board.id, list.id), version: dsql`${tasks.version} + 1`,
      ...(from?.id !== list.id ? { history: [...(t.history ?? []), entry(ctx, `moved this card from ${from?.name ?? "another list"} to ${list.name}`)] } : {}),
      ...(list.kind === "doing" && t.status === "todo" ? { status: "in_progress" as const } : {}),
      ...(list.kind === "todo" && t.status === "in_progress" ? { status: "todo" as const } : {}),
    }).where(eq(tasks.id, t.id));
    if (list.kind === "done" && t.status !== "done") await completeTask(ctx, { ...t, listId: list.id });
    if (list.kind !== "done" && t.status === "done") {
      await db.update(tasks).set({ status: list.kind === "doing" ? "in_progress" : "todo", completedAt: null, completedBy: null }).where(eq(tasks.id, t.id));
    }
    return { ok: true };
  });

  /** Changes to a card: its title, description, due date, labels, people, and (for the lead) who it's for; archive it or bring it back. */
  app.patch<{ Params: { id: string } }>("/api/boards/cards/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { t, board, role } = await loadCard(ctx, req.params.id);
    if (role !== "lead" && !isMine(ctx, t)) throw forbidden("Only the team lead can change other people's cards.");
    const input = parse(z.object({
      title: z.string().trim().min(1, "Give the card a title").max(200).optional(), description: z.string().trim().max(8000).nullable().optional(),
      dueDate: day.nullable().optional(), labelIds: z.array(uuid).max(10).optional(), labels: z.array(z.string()).max(10).optional(),
      memberUserIds: z.array(uuid).max(10).optional(), assigneeUserId: uuid.nullable().optional(), archived: z.boolean().optional(),
    }), req.body);
    const team = await boardPeople(board);
    const log: Entry[] = [];
    const names = await people([input.assigneeUserId, ...(input.memberUserIds ?? [])].filter((x): x is string => !!x));
    if (input.memberUserIds?.some((u) => !team.members.includes(u))) throw badRequest("Choose people on this board.");
    if (input.assigneeUserId !== undefined && input.assigneeUserId !== t.assigneeUserId) {
      if (role !== "lead" && input.assigneeUserId !== ctx.user.id) throw forbidden("Only the team lead can give cards to other people.");
      if (input.assigneeUserId && !team.members.includes(input.assigneeUserId)) throw badRequest("Choose someone on this board.");
      if (input.assigneeUserId && input.assigneeUserId !== ctx.user.id) {
        await notify(ctx.org.id, input.assigneeUserId, `${ctx.user.name} gave you a card: ${t.title}`, board.name, `/me/tasks?card=${t.id}`);
      }
      log.push(entry(ctx, input.assigneeUserId ? `assigned this card to ${input.assigneeUserId === ctx.user.id ? "themself" : names.get(input.assigneeUserId)?.name ?? "someone"}` : "unassigned this card"));
    }
    const added = (input.memberUserIds ?? []).filter((u) => !(t.memberUserIds ?? []).includes(u) && u !== ctx.user.id);
    for (const u of added) await notify(ctx.org.id, u, `${ctx.user.name} added you to a card: ${t.title}`, board.name, `/me/tasks?card=${t.id}`);
    const labels = input.labelIds ? (await labelsOf(board)).filter((l) => input.labelIds!.includes(l.id)).map((l) => l.id) : input.labels;
    if (input.dueDate !== undefined) log.push(entry(ctx, input.dueDate ? `set the due date to ${new Date(`${input.dueDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "removed the due date"));
    if (input.archived !== undefined && input.archived !== !!t.archivedAt) log.push(entry(ctx, input.archived ? "archived this card" : "brought this card back"));
    await db.update(tasks).set({
      ...(input.title !== undefined ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.dueDate !== undefined ? { dueAt: dueOf(input.dueDate) } : {}), ...(labels ? { labels } : {}),
      ...(input.memberUserIds ? { memberUserIds: input.memberUserIds } : {}), ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      ...(log.length ? { history: [...(t.history ?? []), ...log] } : {}), version: dsql`${tasks.version} + 1`,
    }).where(eq(tasks.id, t.id));
    return { ok: true };
  });

  /** A copy of the card (with its checklist), in the same list or another. */
  app.post<{ Params: { id: string } }>("/api/boards/cards/:id/copy", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { t, board } = await loadCard(ctx, req.params.id);
    const { listId, title } = parse(z.object({ listId: uuid.optional(), title: z.string().trim().min(1).max(200).optional() }), req.body);
    const list = (await listsOf(board.id)).find((l) => l.id === (listId ?? t.listId));
    if (!list) throw badRequest("Choose a list on this board.");
    const c = await createTask({ orgId: ctx.org.id, title: title ?? `${t.title} (copy)`, description: t.description, workspace: "workflows", assigneeUserId: ctx.user.id, createdBy: ctx.user.id, dueAt: t.dueAt });
    await db.update(tasks).set({ boardId: board.id, listId: list.id, position: await nextPosition(board.id, list.id), labels: t.labels, history: [entry(ctx, `copied this card from "${t.title}"`)] }).where(eq(tasks.id, c.id));
    const items = await db.select().from(taskItems).where(and(eq(taskItems.taskId, t.id), isNull(taskItems.deletedAt)));
    if (items.length) await db.insert(taskItems).values(items.map((i) => ({ orgId: ctx.org.id, taskId: c.id, label: i.label, position: i.position })));
    return { id: c.id };
  });

  /** Deleting a card: the lead, or whoever made it. */
  app.delete<{ Params: { id: string } }>("/api/boards/cards/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { t, role } = await loadCard(ctx, req.params.id);
    if (role !== "lead" && t.createdBy !== ctx.user.id) throw forbidden("Only the team lead or whoever made this card can delete it.");
    await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, t.id));
    return { ok: true };
  });

  // ---------------- labels ----------------

  app.post<{ Params: { id: string } }>("/api/boards/:id/labels", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { board } = await openBoard(ctx, req.params.id);
    const input = parse(z.object({ name: z.string().trim().min(1, "Name the label").max(40), color: z.enum(COLORS) }), req.body);
    const existing = await labelsOf(board);
    if (existing.some((l) => l.name.toLowerCase() === input.name.toLowerCase())) throw conflict("There's already a label with that name.");
    const [l] = await db.insert(boardLabels).values({ orgId: ctx.org.id, boardId: board.id, ...input, position: existing.length }).returning();
    return { label: { id: l!.id, name: l!.name, color: l!.color } };
  });

  /** Renaming, recolouring or removing a label is the lead's. */
  app.patch<{ Params: { id: string } }>("/api/boards/labels/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    if (!uuid.safeParse(req.params.id).success) throw notFound("That label");
    const [l] = await db.select().from(boardLabels).where(and(eq(boardLabels.id, req.params.id), eq(boardLabels.orgId, ctx.org.id), isNull(boardLabels.deletedAt))).limit(1);
    if (!l) throw notFound("That label");
    if ((await openBoard(ctx, l.boardId)).role !== "lead") throw forbidden("Only the team lead can change labels.");
    const input = parse(z.object({ name: z.string().trim().min(1).max(40).optional(), color: z.enum(COLORS).optional(), remove: z.boolean().optional() }), req.body);
    await db.update(boardLabels).set(input.remove ? { deletedAt: new Date() } : { ...(input.name ? { name: input.name } : {}), ...(input.color ? { color: input.color } : {}) }).where(eq(boardLabels.id, l.id));
    return { ok: true };
  });

  // ---------------- lists (the lead's) ----------------

  const leadOnly = async (ctx: OrgContext, boardId: string) => {
    const b = await openBoard(ctx, boardId);
    if (b.role !== "lead") throw forbidden("Only the team lead can change the lists.");
    return b;
  };

  app.post<{ Params: { id: string } }>("/api/boards/:id/lists", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    const { board } = await leadOnly(ctx, req.params.id);
    const { name } = parse(z.object({ name: z.string().trim().min(1, "Give the list a name").max(60) }), req.body);
    const lists = await listsOf(board.id);
    const done = lists.find((l) => l.kind === "done");
    // New lists go before Done, so Done stays last.
    const position = done ? done.position - 0.5 : (lists.at(-1)?.position ?? 0) + 1;
    const [l] = await db.insert(boardLists).values({ orgId: ctx.org.id, boardId: board.id, name, kind: "custom", position }).returning();
    return { list: { id: l!.id, name: l!.name, kind: l!.kind, position: l!.position } };
  });

  app.patch<{ Params: { id: string } }>("/api/boards/lists/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    if (!uuid.safeParse(req.params.id).success) throw notFound("That list");
    const [l] = await db.select().from(boardLists).where(and(eq(boardLists.id, req.params.id), eq(boardLists.orgId, ctx.org.id), isNull(boardLists.deletedAt))).limit(1);
    if (!l) throw notFound("That list");
    await leadOnly(ctx, l.boardId);
    const input = parse(z.object({ name: z.string().trim().min(1).max(60).optional(), position: z.number().finite().optional() }), req.body);
    await db.update(boardLists).set({ ...input, version: dsql`${boardLists.version} + 1` }).where(eq(boardLists.id, l.id));
    return { ok: true };
  });

  /** A list goes; its cards move to To do, so nothing is lost. To do, In progress and Done stay. */
  app.delete<{ Params: { id: string } }>("/api/boards/lists/:id", async (req) => {
    const ctx = await requireOrg(req);
    needPersonal(ctx, "tasks");
    if (!uuid.safeParse(req.params.id).success) throw notFound("That list");
    const [l] = await db.select().from(boardLists).where(and(eq(boardLists.id, req.params.id), eq(boardLists.orgId, ctx.org.id), isNull(boardLists.deletedAt))).limit(1);
    if (!l) throw notFound("That list");
    const { board } = await leadOnly(ctx, l.boardId);
    if (l.kind === "todo" || l.kind === "doing" || l.kind === "done") throw conflict(`${l.name} can be renamed but not removed: the board needs it.`);
    const to = (await listsOf(board.id)).find((x) => x.kind === "todo")!;
    await db.update(tasks).set({ listId: to.id }).where(and(eq(tasks.listId, l.id), isNull(tasks.deletedAt)));
    await db.update(boardLists).set({ deletedAt: new Date() }).where(eq(boardLists.id, l.id));
    return { ok: true };
  });
}
