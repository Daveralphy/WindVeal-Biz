import { and, asc, eq, inArray, isNull, ne, sql as dsql } from "drizzle-orm";
import { db } from "../db/client";
import { boardLists, boards, checklists, departments, employees, memberships, tasks } from "../db/schema";
import type { OrgContext } from "./context";

/**
 * Task boards (like Trello). Each department has one board: everyone in the department is on it, and its
 * head leads it (gives out cards, assigns anyone, moves any card, changes the lists). People without a
 * department have a personal board. Admins can open and lead every board. Cards are ordinary tasks.
 */
export type Board = typeof boards.$inferSelect;
export type BoardRole = "lead" | "member";

const DEFAULT_LISTS = [
  { name: "To do", kind: "todo" as const },
  { name: "In progress", kind: "doing" as const },
  { name: "Done", kind: "done" as const },
];

async function myEmployee(ctx: OrgContext) {
  const [e] = await db.select().from(employees)
    .where(and(eq(employees.orgId, ctx.org.id), eq(employees.userId, ctx.user.id), isNull(employees.deletedAt))).limit(1);
  return e ?? null;
}

/** Everyone on a board (their user ids), and who leads it. */
export async function boardPeople(board: Board): Promise<{ members: string[]; leads: string[]; staff: string[] }> {
  if (!board.departmentId) { const o = board.ownerUserId ? [board.ownerUserId] : []; return { members: o, leads: o, staff: o }; }
  const staff = await db.select({ userId: employees.userId }).from(employees)
    .where(and(eq(employees.orgId, board.orgId), eq(employees.departmentId, board.departmentId), isNull(employees.deletedAt), ne(employees.status, "left")));
  const [dept] = await db.select({ head: departments.headEmployeeId }).from(departments).where(eq(departments.id, board.departmentId)).limit(1);
  const [head] = dept?.head ? await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, dept.head)).limit(1) : [];
  const leads = head?.userId ? [head.userId] : [];
  const own = staff.map((s) => s.userId).filter((u): u is string => !!u);
  const members = [...new Set([...own, ...leads])];
  /** staff: the department's own people (whose work belongs on this board); members also include its head. */
  return { members, leads, staff: own };
}

/** This person's place on a board: lead, member, or none. Admins lead every board. */
export async function boardRole(ctx: OrgContext, board: Board): Promise<BoardRole | null> {
  if (board.orgId !== ctx.org.id || board.deletedAt) return null;
  if (ctx.membership.role === "admin") return "lead";
  const { members, leads } = await boardPeople(board);
  if (leads.includes(ctx.user.id)) return "lead";
  return members.includes(ctx.user.id) ? "member" : null;
}

export async function loadBoard(orgId: string, id: string): Promise<Board | null> {
  const [b] = await db.select().from(boards).where(and(eq(boards.id, id), eq(boards.orgId, orgId), isNull(boards.deletedAt))).limit(1);
  return b ?? null;
}

async function createBoard(orgId: string, values: { departmentId?: string; ownerUserId?: string; name: string }): Promise<Board> {
  return db.transaction(async (tx) => {
    await tx.execute(dsql`select pg_advisory_xact_lock(hashtext(${`${orgId}:board:${values.departmentId ?? values.ownerUserId}`}))`);
    const [hit] = await tx.select().from(boards).where(and(eq(boards.orgId, orgId), isNull(boards.deletedAt),
      values.departmentId ? eq(boards.departmentId, values.departmentId) : and(isNull(boards.departmentId), eq(boards.ownerUserId, values.ownerUserId!)))).limit(1);
    if (hit) return hit;
    const [b] = await tx.insert(boards).values({ orgId, ...values }).returning();
    await tx.insert(boardLists).values(DEFAULT_LISTS.map((l, i) => ({ orgId, boardId: b!.id, name: l.name, kind: l.kind, position: i + 1 })));
    return b!;
  });
}

/** The person's own board: their department's, or a personal one. */
export async function homeBoard(ctx: OrgContext): Promise<Board> {
  const me = await myEmployee(ctx);
  if (me?.departmentId) {
    const [d] = await db.select().from(departments).where(and(eq(departments.id, me.departmentId), isNull(departments.deletedAt))).limit(1);
    if (d) return createBoard(ctx.org.id, { departmentId: d.id, name: `${d.name} team` });
  }
  return createBoard(ctx.org.id, { ownerUserId: ctx.user.id, name: "My board" });
}

/** Every board the person can open: their own, the departments they lead, and (admins) every department's. */
export async function myBoards(ctx: OrgContext): Promise<{ board: Board; role: BoardRole }[]> {
  const own = await homeBoard(ctx);
  const me = await myEmployee(ctx);
  const depts = await db.select().from(departments).where(and(eq(departments.orgId, ctx.org.id), isNull(departments.deletedAt)));
  const led = ctx.membership.role === "admin" ? depts : depts.filter((d) => me && d.headEmployeeId === me.id);
  const out = [own];
  for (const d of led) if (d.id !== own.departmentId) out.push(await createBoard(ctx.org.id, { departmentId: d.id, name: `${d.name} team` }));
  const withRoles = await Promise.all(out.map(async (b) => ({ board: b, role: await boardRole(ctx, b) })));
  return withRoles.filter((x): x is { board: Board; role: BoardRole } => !!x.role);
}

export async function listsOf(boardId: string) {
  return db.select().from(boardLists).where(and(eq(boardLists.boardId, boardId), isNull(boardLists.deletedAt))).orderBy(asc(boardLists.position));
}

/**
 * Puts the team's open work on the board: tasks given to people on it from anywhere in WindVeal (CRM follow-ups,
 * hiring steps...) go to To do or In progress, and a new person's onboarding steps go to Getting started.
 */
export async function gatherCards(board: Board, members: string[]) {
  if (!members.length) return;
  const loose = await db.select().from(tasks).where(and(eq(tasks.orgId, board.orgId), isNull(tasks.deletedAt), isNull(tasks.boardId),
    inArray(tasks.assigneeUserId, members), ne(tasks.status, "done")));
  if (!loose.length) return;
  let lists = await listsOf(board.id);
  const onboarding = new Set((await db.select({ id: checklists.id }).from(checklists)
    .where(and(eq(checklists.orgId, board.orgId), eq(checklists.kind, "onboarding"), isNull(checklists.deletedAt)))).map((c) => c.id));
  const needsStart = loose.some((t) => t.checklistId && onboarding.has(t.checklistId));
  if (needsStart && !lists.some((l) => l.kind === "start")) {
    await db.insert(boardLists).values({ orgId: board.orgId, boardId: board.id, name: "Getting started", kind: "start", position: (lists[0]?.position ?? 1) - 1 });
    lists = await listsOf(board.id);
  }
  const listFor = (t: typeof loose[number]) => (t.checklistId && onboarding.has(t.checklistId) ? lists.find((l) => l.kind === "start")
    : t.status === "in_progress" ? lists.find((l) => l.kind === "doing") : lists.find((l) => l.kind === "todo")) ?? lists[0];
  const [top] = await db.select({ p: dsql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks).where(eq(tasks.boardId, board.id));
  let pos = Number(top?.p ?? 0);
  for (const t of loose) {
    const l = listFor(t);
    if (!l) continue;
    await db.update(tasks).set({ boardId: board.id, listId: l.id, position: ++pos }).where(and(eq(tasks.id, t.id), isNull(tasks.boardId)));
  }
}

/** Whether someone can see a card through its board (a teammate's card), and whether they lead that board. */
export async function boardAccessToTask(ctx: OrgContext, t: { boardId: string | null }): Promise<BoardRole | null> {
  if (!t.boardId) return null;
  const b = await loadBoard(ctx.org.id, t.boardId);
  return b ? boardRole(ctx, b) : null;
}

/** Active members of the organisation, for names on cards. */
export async function activeMemberIds(orgId: string) {
  return (await db.select({ id: memberships.userId }).from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.status, "active"), isNull(memberships.deletedAt)))).map((m) => m.id);
}
