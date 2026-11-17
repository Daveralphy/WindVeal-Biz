import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { OPEN_REQUEST, REQUEST_KINDS, REQUEST_LABELS, REQUEST_STATUS_LABEL, type RequestKind, type RequestStatus } from "@windveal/shared";
import { db } from "../../db/client";
import { employees, files, memberships, organisations, staffRequests, users } from "../../db/schema";
import { requireAdmin, requireOrg, type OrgContext } from "../../lib/context";
import { badRequest, conflict, forbidden, notFound, parse } from "../../lib/http";
import { audit, notify } from "../../lib/audit";
import { readObject } from "../../lib/storage";
import { activeAdminUserId } from "../people/shared";

type Row = typeof staffRequests.$inferSelect;
const uuid = z.string().uuid();

/** The requester's manager (through People & HR), if they use WindVeal. */
async function managerOf(orgId: string, userId: string): Promise<string | null> {
  const [me] = await db.select({ managerId: employees.managerId }).from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.userId, userId), isNull(employees.deletedAt))).limit(1);
  if (!me?.managerId) return null;
  const [m] = await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, me.managerId)).limit(1);
  return m?.userId ?? null;
}

async function activeMember(orgId: string, userId: string | null | undefined) {
  if (!userId) return false;
  const [m] = await db.select({ id: memberships.id }).from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId), eq(memberships.status, "active"), isNull(memberships.deletedAt))).limit(1);
  return !!m;
}

/**
 * Who a request goes to. Expense claims: the manager first (stage "manager"), then whoever pays (stage
 * "finance"). Everything else: whoever the admin chose for that kind, or the manager. Never the requester
 * themself: it moves on to the next person (and in the end an admin).
 */
async function routeFor(ctx: OrgContext, requester: string, kind: RequestKind, stage: "manager" | "handler" | "finance") {
  const chosen = ctx.org.settings.requestHandlers ?? {};
  const admin = await activeAdminUserId(ctx.org.id, requester);
  const pick = async (...ids: (string | null | undefined)[]) => {
    for (const id of ids) if (id && id !== requester && (await activeMember(ctx.org.id, id))) return id;
    return admin;
  };
  if (kind === "expense") {
    if (stage === "manager") return { stage: "manager" as const, handler: await pick(await managerOf(ctx.org.id, requester)) };
    return { stage: "finance" as const, handler: await pick(chosen.expense) };
  }
  return { stage: "handler" as const, handler: await pick(chosen[kind], await managerOf(ctx.org.id, requester)) };
}

async function names(ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map<string, string>();
  return new Map((await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, list))).map((u) => [u.id, u.name]));
}

async function views(ctx: OrgContext, rows: Row[]) {
  const n = await names(rows.flatMap((r) => [r.requesterUserId, r.handlerUserId]));
  return rows.map((r) => ({
    id: r.id, kind: r.kind, kindName: REQUEST_LABELS[r.kind as RequestKind]?.name ?? r.kind, title: r.title, details: r.details,
    amount: r.amount, spentOn: r.spentOn, hasReceipt: !!r.receiptFileId, status: r.status, statusName: REQUEST_STATUS_LABEL[r.status as RequestStatus] ?? r.status,
    stage: r.stage, requester: { id: r.requesterUserId, name: n.get(r.requesterUserId) ?? "Someone" },
    with: r.handlerUserId && OPEN_REQUEST.includes(r.status as RequestStatus) ? { id: r.handlerUserId, name: n.get(r.handlerUserId) ?? "Someone" } : null,
    history: r.history, createdAt: r.createdAt, closedAt: r.closedAt,
    mine: r.requesterUserId === ctx.user.id, canAct: OPEN_REQUEST.includes(r.status as RequestStatus) && (r.handlerUserId === ctx.user.id || ctx.membership.role === "admin"),
  }));
}

async function load(ctx: OrgContext, id: string): Promise<Row> {
  if (!uuid.safeParse(id).success) throw notFound("That request");
  const [r] = await db.select().from(staffRequests).where(and(eq(staffRequests.id, id), eq(staffRequests.orgId, ctx.org.id), isNull(staffRequests.deletedAt))).limit(1);
  // The requester, anyone it has been with, and admins can see it.
  const involved = r && (r.requesterUserId === ctx.user.id || r.handlerUserId === ctx.user.id || ctx.membership.role === "admin"
    || r.history.some((h) => h.by === ctx.user.id));
  if (!r || !involved) throw notFound("That request");
  return r;
}

const step = (ctx: OrgContext, action: string, note?: string) => ({ at: new Date().toISOString(), by: ctx.user.id, byName: ctx.user.name, action, ...(note ? { note } : {}) });

export default async function requestRoutes(app: FastifyInstance) {
  /** The kinds of request, and who each one goes to for this person (so the form can say). */
  app.get("/api/requests/kinds", async (req) => {
    const ctx = await requireOrg(req);
    const out = [];
    for (const k of REQUEST_KINDS) {
      const to = await routeFor(ctx, ctx.user.id, k, k === "expense" ? "manager" : "handler");
      out.push({ kind: k, ...REQUEST_LABELS[k], goesTo: to.handler ? (await names([to.handler])).get(to.handler) ?? null : null });
    }
    return { kinds: out };
  });

  /** Mine (what I asked for), or the ones waiting for me to handle. */
  app.get<{ Querystring: { scope?: string; kind?: string } }>("/api/requests", async (req) => {
    const ctx = await requireOrg(req);
    const handle = req.query.scope === "handle";
    const kind = req.query.kind === "expense" ? eq(staffRequests.kind, "expense") : req.query.kind === "other" ? dsql`${staffRequests.kind} <> 'expense'` : undefined;
    const rows = await db.select().from(staffRequests).where(and(eq(staffRequests.orgId, ctx.org.id), isNull(staffRequests.deletedAt), kind,
      handle ? and(eq(staffRequests.handlerUserId, ctx.user.id), inArray(staffRequests.status, OPEN_REQUEST))
        : eq(staffRequests.requesterUserId, ctx.user.id))).orderBy(desc(staffRequests.createdAt)).limit(200);
    return { requests: await views(ctx, rows) };
  });

  app.get<{ Params: { id: string } }>("/api/requests/:id", async (req) => {
    const ctx = await requireOrg(req);
    return { request: (await views(ctx, [await load(ctx, req.params.id)]))[0] };
  });

  app.post("/api/requests", async (req) => {
    const ctx = await requireOrg(req);
    const input = parse(z.object({
      kind: z.enum(REQUEST_KINDS), title: z.string().trim().min(1, "Say what you need").max(200), details: z.string().trim().max(4000).optional(),
      amount: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Enter an amount").max(1e11).optional(),
      spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").optional(), receiptFileId: uuid.optional(),
    }), req.body);
    if (input.kind === "expense" && !input.amount) throw badRequest("Some details need fixing.", { amount: "Enter how much you spent" });
    if (input.receiptFileId) {
      const [f] = await db.select({ by: files.uploadedBy }).from(files).where(and(eq(files.id, input.receiptFileId), eq(files.orgId, ctx.org.id))).limit(1);
      if (!f || f.by !== ctx.user.id) throw badRequest("Add the receipt again.", { receiptFileId: "Upload the receipt again" });
    }
    const to = await routeFor(ctx, ctx.user.id, input.kind, input.kind === "expense" ? "manager" : "handler");
    const [r] = await db.insert(staffRequests).values({
      orgId: ctx.org.id, requesterUserId: ctx.user.id, kind: input.kind, title: input.title, details: input.details || null,
      amount: input.amount != null ? String(input.amount) : null, spentOn: input.spentOn ?? null, receiptFileId: input.receiptFileId ?? null,
      handlerUserId: to.handler, stage: to.stage, history: [step(ctx, "asked")],
    }).returning();
    if (to.handler) {
      await notify(ctx.org.id, to.handler, `${ctx.user.name} asked: ${input.title}`, REQUEST_LABELS[input.kind].name, "/me/requests/handle");
    }
    return { request: (await views(ctx, [r!]))[0] };
  });

  /**
   * Whoever it's with acts on it. Requests: start, done, decline. Expense claims: approve (it then goes to
   * whoever pays them), pay, decline. The requester is told each time.
   */
  app.post<{ Params: { id: string } }>("/api/requests/:id/act", async (req) => {
    const ctx = await requireOrg(req);
    const r = await load(ctx, req.params.id);
    const { action, note } = parse(z.object({ action: z.enum(["start", "done", "approve", "pay", "decline"]), note: z.string().trim().max(1000).optional() }), req.body);
    if (!OPEN_REQUEST.includes(r.status as RequestStatus)) throw conflict("This request is already closed.");
    if (r.handlerUserId !== ctx.user.id && ctx.membership.role !== "admin") throw forbidden("This request is with someone else.");
    if (r.requesterUserId === ctx.user.id && action !== "decline" && ctx.membership.role !== "admin") throw forbidden("Someone else needs to handle your own request.");
    const expense = r.kind === "expense";
    const ok = expense ? (action === "approve" && r.stage === "manager") || (action === "pay" && r.stage === "finance") || action === "decline"
      : action === "start" || action === "done" || action === "decline";
    if (!ok) throw badRequest("That can't be done at this step.");
    let set: Partial<Row> = {};
    let next: string | null = r.handlerUserId;
    if (action === "start") set = { status: "in_progress" };
    if (action === "done") set = { status: "done", closedAt: new Date() };
    if (action === "pay") set = { status: "paid", closedAt: new Date() };
    if (action === "decline") set = { status: "declined", closedAt: new Date() };
    if (action === "approve") {
      const to = await routeFor(ctx, r.requesterUserId, "expense", "finance");
      next = to.handler;
      set = { status: "approved", stage: "finance", handlerUserId: next };
    }
    const label = { start: "started on it", done: "marked it done", approve: "approved it", pay: "marked it paid", decline: "didn't approve it" }[action];
    const [u] = await db.update(staffRequests).set({ ...set, history: [...r.history, step(ctx, action, note)], version: dsql`${staffRequests.version} + 1` })
      .where(eq(staffRequests.id, r.id)).returning();
    if (r.requesterUserId !== ctx.user.id) {
      await notify(ctx.org.id, r.requesterUserId, `${ctx.user.name} ${label}: ${r.title}`, note, expense ? "/me/finance/expenses" : "/me/requests");
    }
    if (action === "approve" && next && next !== ctx.user.id) await notify(ctx.org.id, next, `Expense claim to pay: ${r.title}`, undefined, "/me/requests/handle");
    if (expense && (action === "pay" || action === "approve")) {
      await audit(ctx, { action: `expense.${action === "pay" ? "paid" : "approved"}`, category: "data", entityType: "request", entityId: r.id, summary: `${ctx.user.name} ${label}: ${r.title} (${r.amount})` });
    }
    return { request: (await views(ctx, [u!]))[0] };
  });

  /** The requester takes it back while nobody has started on it. */
  app.post<{ Params: { id: string } }>("/api/requests/:id/cancel", async (req) => {
    const ctx = await requireOrg(req);
    const r = await load(ctx, req.params.id);
    if (r.requesterUserId !== ctx.user.id) throw forbidden("Only the person who asked can cancel it.");
    if (r.status !== "waiting") throw conflict("Someone has already started on it. Ask them instead.");
    const [u] = await db.update(staffRequests).set({ status: "cancelled", closedAt: new Date(), history: [...r.history, step(ctx, "cancelled")] })
      .where(eq(staffRequests.id, r.id)).returning();
    return { request: (await views(ctx, [u!]))[0] };
  });

  /** The receipt on an expense claim: for the requester, whoever it has been with, and admins. */
  app.get<{ Params: { id: string } }>("/api/requests/:id/receipt", async (req, reply) => {
    const ctx = await requireOrg(req);
    const r = await load(ctx, req.params.id);
    if (!r.receiptFileId) throw notFound("The receipt");
    const [f] = await db.select().from(files).where(and(eq(files.id, r.receiptFileId), eq(files.orgId, ctx.org.id), isNull(files.deletedAt))).limit(1);
    if (!f) throw notFound("The receipt");
    reply.header("Content-Type", f.mime || "application/octet-stream");
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(f.name)}"`);
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(readObject(f.storageKey));
  });

  // ---------------- Settings › Requests (admins) ----------------

  app.get("/api/requests/handlers", async (req) => {
    const ctx = await requireAdmin(req);
    const chosen = ctx.org.settings.requestHandlers ?? {};
    return { handlers: Object.fromEntries(REQUEST_KINDS.map((k) => [k, chosen[k] ?? null])) };
  });

  app.put("/api/requests/handlers", async (req) => {
    const ctx = await requireAdmin(req);
    const { handlers } = parse(z.object({ handlers: z.record(z.enum(REQUEST_KINDS), uuid.nullable()) }), req.body);
    for (const id of Object.values(handlers)) if (id && !(await activeMember(ctx.org.id, id))) throw badRequest("Choose someone in your team.");
    const clean = Object.fromEntries(Object.entries(handlers).filter(([, v]) => !!v)) as Record<string, string>;
    await db.update(organisations).set({ settings: { ...ctx.org.settings, requestHandlers: clean } }).where(eq(organisations.id, ctx.org.id));
    await audit(ctx, { action: "settings.request_handlers", category: "settings", summary: `${ctx.user.name} changed who handles requests` });
    return { ok: true };
  });

  /** How many are waiting for this person to handle (for the sidebar count). */
  app.get("/api/requests/count", async (req) => {
    const ctx = await requireOrg(req);
    const [r] = await db.select({ n: dsql<number>`count(*)::int` }).from(staffRequests)
      .where(and(eq(staffRequests.orgId, ctx.org.id), eq(staffRequests.handlerUserId, ctx.user.id), inArray(staffRequests.status, OPEN_REQUEST), isNull(staffRequests.deletedAt)));
    return { waiting: r?.n ?? 0 };
  });
}
