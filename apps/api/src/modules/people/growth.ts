import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { employees, goals, reviews, trainings, users } from "../../db/schema";
import { requireOrg, type OrgContext } from "../../lib/context";
import { badRequest, conflict, forbidden, notFound, parse } from "../../lib/http";
import { notify } from "../../lib/audit";

/**
 * My Workspace › Growth: goals, reviews and training. Each person keeps their own; their manager (anyone
 * they report to in People & HR) sees and adds to theirs, and runs their reviews. Admins can act for anyone.
 */
const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** The people who report to this person (their user ids). */
async function reportsOf(ctx: OrgContext): Promise<{ id: string; name: string }[]> {
  const [me] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.orgId, ctx.org.id), eq(employees.userId, ctx.user.id), isNull(employees.deletedAt))).limit(1);
  if (!me) return [];
  const rows = await db.select({ userId: employees.userId, first: employees.firstName, last: employees.lastName }).from(employees)
    .where(and(eq(employees.managerId, me.id), isNull(employees.deletedAt)));
  return rows.filter((r): r is typeof r & { userId: string } => !!r.userId).map((r) => ({ id: r.userId, name: `${r.first} ${r.last}`.trim() }));
}

/** Whose growth this person may see and add to: their own, their reports', and (admins) anyone's. */
async function canSee(ctx: OrgContext, userId: string) {
  if (userId === ctx.user.id || ctx.membership.role === "admin") return true;
  return (await reportsOf(ctx)).some((r) => r.id === userId);
}
async function whose(ctx: OrgContext, raw: string | undefined) {
  const id = raw && uuid.safeParse(raw).success ? raw : ctx.user.id;
  if (!(await canSee(ctx, id))) throw forbidden("You can only see your own growth, or the people who report to you.");
  return id;
}
async function nameMap(ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  return new Map(list.length ? (await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, list))).map((u) => [u.id, u.name]) : []);
}

export default async function growthRoutes(app: FastifyInstance) {
  /** Whose growth the person can look at: themself, then the people who report to them. */
  app.get("/api/growth/people", async (req) => {
    const ctx = await requireOrg(req);
    return { people: [{ id: ctx.user.id, name: "Me" }, ...(await reportsOf(ctx))] };
  });

  // ---------------- goals ----------------

  app.get<{ Querystring: { for?: string } }>("/api/growth/goals", async (req) => {
    const ctx = await requireOrg(req);
    const userId = await whose(ctx, req.query.for);
    const rows = await db.select().from(goals).where(and(eq(goals.orgId, ctx.org.id), eq(goals.userId, userId), isNull(goals.deletedAt)))
      .orderBy(asc(goals.status), desc(goals.createdAt));
    const n = await nameMap(rows.map((g) => g.setByUserId));
    return { goals: rows.map((g) => ({ ...g, setBy: g.setByUserId && g.setByUserId !== g.userId ? n.get(g.setByUserId) ?? null : null })) };
  });

  app.post("/api/growth/goals", async (req) => {
    const ctx = await requireOrg(req);
    const input = parse(z.object({ for: uuid.optional(), title: z.string().trim().min(1, "Say what the goal is").max(200), details: z.string().trim().max(2000).optional(), dueOn: day.optional() }), req.body);
    const userId = await whose(ctx, input.for);
    const [g] = await db.insert(goals).values({ orgId: ctx.org.id, userId, title: input.title, details: input.details || null, dueOn: input.dueOn ?? null, setByUserId: ctx.user.id }).returning();
    if (userId !== ctx.user.id) await notify(ctx.org.id, userId, `${ctx.user.name} set you a goal: ${input.title}`, undefined, "/me/growth");
    return { goal: g };
  });

  app.patch<{ Params: { id: string } }>("/api/growth/goals/:id", async (req) => {
    const ctx = await requireOrg(req);
    if (!uuid.safeParse(req.params.id).success) throw notFound("That goal");
    const [g] = await db.select().from(goals).where(and(eq(goals.id, req.params.id), eq(goals.orgId, ctx.org.id), isNull(goals.deletedAt))).limit(1);
    if (!g || !(await canSee(ctx, g.userId))) throw notFound("That goal");
    const input = parse(z.object({
      title: z.string().trim().min(1).max(200).optional(), details: z.string().trim().max(2000).nullable().optional(),
      progress: z.number().int().min(0).max(100).optional(), dueOn: day.nullable().optional(), status: z.enum(["active", "done", "dropped"]).optional(),
    }), req.body);
    const done = input.status === "done" || input.progress === 100;
    const [u] = await db.update(goals).set({ ...input, ...(done ? { status: "done" as const, progress: 100 } : {}) }).where(eq(goals.id, g.id)).returning();
    return { goal: u };
  });

  app.delete<{ Params: { id: string } }>("/api/growth/goals/:id", async (req) => {
    const ctx = await requireOrg(req);
    if (!uuid.safeParse(req.params.id).success) throw notFound("That goal");
    const [g] = await db.select().from(goals).where(and(eq(goals.id, req.params.id), eq(goals.orgId, ctx.org.id), isNull(goals.deletedAt))).limit(1);
    if (!g || !(await canSee(ctx, g.userId))) throw notFound("That goal");
    if (g.setByUserId && g.setByUserId !== ctx.user.id && g.userId === ctx.user.id && ctx.membership.role !== "admin") throw forbidden("Your manager set this goal, so ask them to remove it.");
    await db.update(goals).set({ deletedAt: new Date() }).where(eq(goals.id, g.id));
    return { ok: true };
  });

  // ---------------- reviews ----------------

  /** Reviews of me, and the ones I give. */
  app.get("/api/growth/reviews", async (req) => {
    const ctx = await requireOrg(req);
    const rows = await db.select().from(reviews).where(and(eq(reviews.orgId, ctx.org.id), isNull(reviews.deletedAt),
      or(eq(reviews.userId, ctx.user.id), eq(reviews.reviewerUserId, ctx.user.id)))).orderBy(desc(reviews.createdAt));
    const n = await nameMap(rows.flatMap((r) => [r.userId, r.reviewerUserId]));
    // The manager's words stay hidden from the person until the review is finished.
    return {
      reviews: rows.map((r) => {
        const mine = r.userId === ctx.user.id;
        return { ...r, person: n.get(r.userId) ?? "Someone", reviewer: n.get(r.reviewerUserId) ?? "Someone", mine,
          managerReview: mine && r.status !== "done" ? null : r.managerReview, rating: mine && r.status !== "done" ? null : r.rating };
      }),
    };
  });

  /** A manager starts a review for someone who reports to them; that person writes theirs first. */
  app.post("/api/growth/reviews", async (req) => {
    const ctx = await requireOrg(req);
    const input = parse(z.object({ for: uuid, title: z.string().trim().min(1, "Name the review").max(120), dueOn: day.optional() }), req.body);
    if (input.for === ctx.user.id) throw badRequest("Your manager starts your reviews.");
    if (!(await canSee(ctx, input.for))) throw forbidden("You can only review the people who report to you.");
    const [r] = await db.insert(reviews).values({ orgId: ctx.org.id, userId: input.for, reviewerUserId: ctx.user.id, title: input.title, dueOn: input.dueOn ?? null }).returning();
    await notify(ctx.org.id, input.for, `${ctx.user.name} started your ${input.title}`, "Write your self-review first.", "/me/growth/reviews");
    return { review: r };
  });

  /** The person sends their self-review; then the manager writes theirs and finishes it. */
  app.post<{ Params: { id: string } }>("/api/growth/reviews/:id", async (req) => {
    const ctx = await requireOrg(req);
    if (!uuid.safeParse(req.params.id).success) throw notFound("That review");
    const [r] = await db.select().from(reviews).where(and(eq(reviews.id, req.params.id), eq(reviews.orgId, ctx.org.id), isNull(reviews.deletedAt))).limit(1);
    if (!r || (r.userId !== ctx.user.id && r.reviewerUserId !== ctx.user.id)) throw notFound("That review");
    const input = parse(z.object({ text: z.string().trim().min(1, "Write something first").max(8000), rating: z.number().int().min(1).max(5).optional() }), req.body);
    if (r.userId === ctx.user.id) {
      if (r.status !== "self") throw conflict("Your self-review has already been sent.");
      await db.update(reviews).set({ selfReview: input.text, status: "manager" }).where(eq(reviews.id, r.id));
      await notify(ctx.org.id, r.reviewerUserId, `${ctx.user.name} sent their self-review`, r.title, "/me/growth/reviews");
    } else {
      if (r.status !== "manager") throw conflict(r.status === "self" ? "Wait for their self-review first." : "This review is finished.");
      await db.update(reviews).set({ managerReview: input.text, rating: input.rating ?? null, status: "done", completedAt: new Date() }).where(eq(reviews.id, r.id));
      await notify(ctx.org.id, r.userId, `${ctx.user.name} finished your ${r.title}`, undefined, "/me/growth/reviews");
    }
    return { ok: true };
  });

  // ---------------- training ----------------

  app.get<{ Querystring: { for?: string } }>("/api/growth/training", async (req) => {
    const ctx = await requireOrg(req);
    const userId = await whose(ctx, req.query.for);
    const rows = await db.select().from(trainings).where(and(eq(trainings.orgId, ctx.org.id), eq(trainings.userId, userId), isNull(trainings.deletedAt)))
      .orderBy(asc(trainings.status), desc(trainings.createdAt));
    return { training: rows };
  });

  app.post("/api/growth/training", async (req) => {
    const ctx = await requireOrg(req);
    const input = parse(z.object({
      for: uuid.optional(), title: z.string().trim().min(1, "Name the course or certificate").max(200), provider: z.string().trim().max(120).optional(),
      status: z.enum(["planned", "in_progress", "done"]).optional(), dueOn: day.optional(), completedOn: day.optional(), certificateExpiresOn: day.optional(),
    }), req.body);
    const userId = await whose(ctx, input.for);
    const { for: _f, ...rest } = input;
    const [t] = await db.insert(trainings).values({ orgId: ctx.org.id, userId, ...rest, provider: rest.provider || null, addedByUserId: ctx.user.id }).returning();
    if (userId !== ctx.user.id) await notify(ctx.org.id, userId, `${ctx.user.name} added training for you: ${input.title}`, undefined, "/me/growth/training");
    return { training: t };
  });

  app.patch<{ Params: { id: string } }>("/api/growth/training/:id", async (req) => {
    const ctx = await requireOrg(req);
    if (!uuid.safeParse(req.params.id).success) throw notFound("That training");
    const [t] = await db.select().from(trainings).where(and(eq(trainings.id, req.params.id), eq(trainings.orgId, ctx.org.id), isNull(trainings.deletedAt))).limit(1);
    if (!t || !(await canSee(ctx, t.userId))) throw notFound("That training");
    const input = parse(z.object({
      status: z.enum(["planned", "in_progress", "done"]).optional(), completedOn: day.nullable().optional(), certificateExpiresOn: day.nullable().optional(), dueOn: day.nullable().optional(),
    }), req.body);
    const completedOn = input.status === "done" && !input.completedOn && !t.completedOn ? new Date().toISOString().slice(0, 10) : input.completedOn;
    const [u] = await db.update(trainings).set({ ...input, ...(completedOn !== undefined ? { completedOn } : {}) }).where(eq(trainings.id, t.id)).returning();
    return { training: u };
  });

  app.delete<{ Params: { id: string } }>("/api/growth/training/:id", async (req) => {
    const ctx = await requireOrg(req);
    if (!uuid.safeParse(req.params.id).success) throw notFound("That training");
    const [t] = await db.select().from(trainings).where(and(eq(trainings.id, req.params.id), eq(trainings.orgId, ctx.org.id), isNull(trainings.deletedAt))).limit(1);
    if (!t || !(await canSee(ctx, t.userId))) throw notFound("That training");
    await db.update(trainings).set({ deletedAt: new Date() }).where(eq(trainings.id, t.id));
    return { ok: true };
  });
}
