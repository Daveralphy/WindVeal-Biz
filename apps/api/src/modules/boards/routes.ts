import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, inArray, isNull, or, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { boardLists, tasks, users } from "../../db/schema";
import { requireOrg, type OrgContext } from "../../lib/context";
import { badRequest, conflict, forbidden, notFound, parse } from "../../lib/http";
import { notify } from "../../lib/audit";
import { createTask } from "../../lib/tasks";
import { boardPeople, boardRole, gatherCards, listsOf, loadBoard, myBoards, type Board, type BoardRole } from "../../lib/boards";
import { completeTask, taskViews } from "../workflows/routes";

const LABELS = ["red", "orange", "yellow", "green", "blue", "purple"] as const;
const uuid = z.string().uuid();
const dueInput = z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional();

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

/** Whose card it is: its assignee, the people on it, or whoever made it. They (and the lead) can move and change it. */
const isMine = (ctx: OrgContext, t: typeof tasks.$inferSelect) =>
  t.assigneeUserId === ctx.user.id || t.createdBy === ctx.user.id || (t.memberUserIds ?? []).includes(ctx.user.id);

async function nextPosition(boardId: string, listId: string) {
  const [r] = await db.select({ p: dsql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks)
    .where(and(eq(tasks.boardId, boardId), eq(tasks.listId, listId), isNull(tasks.deletedAt)));
  return Number(r?.p ?? 0) + 1;
}

export default async function boardRoutes(app: FastifyInstance) {
  /** The boards someone can open: their team's (or a personal one), and any they lead. */
  app.get("/api/boards", async (req) => {
    const ctx = await requireOrg(req);
    const list = await myBoards(ctx);
    return { boards: list.map(({ board, role }) => ({ id: board.id, name: board.name, lead: role === "lead", personal: !board.departmentId })) };
  });

  /** A board: its lists, its cards, and the people on it. */
  app.get<{ Params: { id: string } }>("/api/boards/:id", async (req) => {
    const ctx = await requireOrg(req);
    const { board, role } = await openBoard(ctx, req.params.id);
    const people = await boardPeople(board);
    await gatherCards(board, people.staff);
    const lists = await listsOf(board.id);
    const doneList = lists.find((l) => l.kind === "done");
    // Done long ago drops off the board (it's still in the person's task history).
    const since = new Date(Date.now() - 30 * 86_400_000);
    let rows = await db.select().from(tasks).where(and(eq(tasks.boardId, board.id), isNull(tasks.deletedAt),
      or(dsql`${tasks.status} <> 'done'`, gte(tasks.completedAt, since)))).orderBy(asc(tasks.position));
    // Finished or reopened elsewhere (from a task page or the chat): keep the card in the right list.
    for (const t of rows) {
      const l = lists.find((x) => x.id === t.listId);
      const fix = t.status === "done" && l?.kind !== "done" && doneList ? doneList
        : t.status !== "done" && l?.kind === "done" ? lists.find((x) => x.kind === "todo") ?? lists[0] : !l ? lists[0] : null;
      if (fix) { await db.update(tasks).set({ listId: fix.id }).where(eq(tasks.id, t.id)); t.listId = fix.id; }
    }
    rows = rows.filter((t) => lists.some((l) => l.id === t.listId));
    const views = await taskViews(rows);
    const extra = [...new Set(rows.flatMap((t) => t.memberUserIds ?? []))];
    const names = new Map((await db.select({ id: users.id, name: users.name, avatarFileId: users.avatarFileId }).from(users)
      .where(inArray(users.id, [...new Set([...people.members, ...extra])].length ? [...new Set([...people.members, ...extra])] : [ctx.user.id]))).map((u) => [u.id, u]));
    return {
      board: { id: board.id, name: board.name, personal: !board.departmentId },
      role, me: ctx.user.id,
      lists: lists.map((l) => ({ id: l.id, name: l.name, kind: l.kind, position: l.position })),
      cards: rows.map((t, i) => ({
        ...views[i]!, listId: t.listId, position: t.position, labels: t.labels ?? [],
        members: (t.memberUserIds ?? []).map((id) => names.get(id)).filter(Boolean),
        canMove: role === "lead" || isMine(ctx, t),
      })),
      people: people.members.map((id) => names.get(id)).filter(Boolean),
      leads: people.leads,
    };
  });

  /** A new card. Anyone on the board can add their own; the lead can give it to anyone on the board. */
  app.post<{ Params: { id: string } }>("/api/boards/:id/cards", async (req) => {
    const ctx = await requireOrg(req);
    const { board, role } = await openBoard(ctx, req.params.id);
    const input = parse(z.object({
      title: z.string().trim().min(1, "Give the card a title").max(200), listId: uuid,
      assigneeUserId: uuid.nullable().optional(), dueDate: dueInput, labels: z.array(z.enum(LABELS)).max(6).optional(),
      description: z.string().max(4000).optional(),
    }), req.body);
    const lists = await listsOf(board.id);
    const list = lists.find((l) => l.id === input.listId);
    if (!list) throw badRequest("Choose a list on this board.");
    const people = await boardPeople(board);
    let assignee = input.assigneeUserId === undefined ? ctx.user.id : input.assigneeUserId;
    if (assignee && assignee !== ctx.user.id) {
      if (role !== "lead") throw forbidden("Only the team lead can give cards to other people. Add it for yourself.");
      if (!people.members.includes(assignee)) throw badRequest("Choose someone on this board.");
    }
    const t = await createTask({
      orgId: ctx.org.id, title: input.title, description: input.description ?? null, workspace: "workflows",
      assigneeUserId: assignee ?? null, createdBy: ctx.user.id, dueAt: input.dueDate ? new Date(`${input.dueDate.slice(0, 10)}T17:00:00`) : null,
    });
    const [card] = await db.update(tasks).set({
      boardId: board.id, listId: list.id, position: await nextPosition(board.id, list.id), labels: input.labels ?? [],
      ...(list.kind === "done" ? { status: "done" as const, completedAt: new Date(), completedBy: ctx.user.id } : list.kind === "doing" ? { status: "in_progress" as const } : {}),
    }).where(eq(tasks.id, t.id)).returning();
    return { card: (await taskViews([card!]))[0] };
  });

  /** Drag and drop: a card to another place in its list, or to another list. Done completes it; out of Done reopens it. */
  app.post<{ Params: { id: string } }>("/api/boards/cards/:id/move", async (req) => {
    const ctx = await requireOrg(req);
    const { t, board, role } = await loadCard(ctx, req.params.id);
    if (role !== "lead" && !isMine(ctx, t)) throw forbidden("Only the team lead can move other people's cards.");
    const input = parse(z.object({ listId: uuid, position: z.number().finite() }), req.body);
    const list = (await listsOf(board.id)).find((l) => l.id === input.listId);
    if (!list) throw badRequest("Choose a list on this board.");
    await db.update(tasks).set({ listId: list.id, position: input.position, version: dsql`${tasks.version} + 1`,
      ...(list.kind === "doing" && t.status === "todo" ? { status: "in_progress" as const } : {}),
      ...(list.kind === "todo" && t.status === "in_progress" ? { status: "todo" as const } : {}),
    }).where(eq(tasks.id, t.id));
    if (list.kind === "done" && t.status !== "done") await completeTask(ctx, { ...t, listId: list.id });
    if (list.kind !== "done" && t.status === "done") {
      await db.update(tasks).set({ status: list.kind === "doing" ? "in_progress" : "todo", completedAt: null, completedBy: null }).where(eq(tasks.id, t.id));
    }
    return { ok: true };
  });

  /** The card's own details on the board: labels, the people on it, and (for the lead) who it's for. */
  app.patch<{ Params: { id: string } }>("/api/boards/cards/:id", async (req) => {
    const ctx = await requireOrg(req);
    const { t, board, role } = await loadCard(ctx, req.params.id);
    if (role !== "lead" && !isMine(ctx, t)) throw forbidden("Only the team lead can change other people's cards.");
    const input = parse(z.object({
      labels: z.array(z.enum(LABELS)).max(6).optional(), memberUserIds: z.array(uuid).max(10).optional(), assigneeUserId: uuid.nullable().optional(),
    }), req.body);
    const people = await boardPeople(board);
    if (input.memberUserIds?.some((u) => !people.members.includes(u))) throw badRequest("Choose people on this board.");
    if (input.assigneeUserId !== undefined && input.assigneeUserId !== t.assigneeUserId) {
      if (role !== "lead" && input.assigneeUserId !== ctx.user.id) throw forbidden("Only the team lead can give cards to other people.");
      if (input.assigneeUserId && !people.members.includes(input.assigneeUserId)) throw badRequest("Choose someone on this board.");
      if (input.assigneeUserId && input.assigneeUserId !== ctx.user.id) {
        await notify(ctx.org.id, input.assigneeUserId, `${ctx.user.name} gave you a card: ${t.title}`, board.name, `/me/tasks?task=${t.id}`);
      }
    }
    const added = (input.memberUserIds ?? []).filter((u) => !(t.memberUserIds ?? []).includes(u) && u !== ctx.user.id);
    for (const u of added) await notify(ctx.org.id, u, `${ctx.user.name} added you to a card: ${t.title}`, board.name, `/me/tasks?task=${t.id}`);
    await db.update(tasks).set({
      ...(input.labels ? { labels: input.labels } : {}), ...(input.memberUserIds ? { memberUserIds: input.memberUserIds } : {}),
      ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}), version: dsql`${tasks.version} + 1`,
    }).where(eq(tasks.id, t.id));
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
    if (!uuid.safeParse(req.params.id).success) throw notFound("That list");
    const [l] = await db.select().from(boardLists).where(and(eq(boardLists.id, req.params.id), eq(boardLists.orgId, ctx.org.id), isNull(boardLists.deletedAt))).limit(1);
    if (!l) throw notFound("That list");
    await leadOnly(ctx, l.boardId);
    const input = parse(z.object({ name: z.string().trim().min(1).max(60).optional(), position: z.number().finite().optional() }), req.body);
    await db.update(boardLists).set({ ...input, version: dsql`${boardLists.version} + 1` }).where(eq(boardLists.id, l.id));
    return { ok: true };
  });

  /** A list goes; its cards move to the first list, so nothing is lost. To do, In progress and Done stay. */
  app.delete<{ Params: { id: string } }>("/api/boards/lists/:id", async (req) => {
    const ctx = await requireOrg(req);
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
