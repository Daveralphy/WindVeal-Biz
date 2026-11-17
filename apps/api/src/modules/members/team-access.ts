import type { FastifyInstance } from "fastify";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { ACCESS_LEVELS, AREAS, isPersonal, type AccessLevel, type Area } from "@windveal/shared";
import { db } from "../../db/client";
import { departments, employees, memberships, users } from "../../db/schema";
import { computeAccess, requireOrg, roleAccess, type OrgContext } from "../../lib/context";
import { badRequest, forbidden, notFound, parse } from "../../lib/http";
import { audit, notify } from "../../lib/audit";
import { loadRole } from "../../lib/roles";

/**
 * Settings › Team access: a department's leader gives (or takes away) platforms for the people in their
 * department, up to their own level: a Sales lead with CRM Edit can give CRM View or Edit, never Manage, and
 * only platforms they have themselves. Admins give anything to anyone from Members and Roles.
 */
const rank = (l: AccessLevel) => ACCESS_LEVELS.indexOf(l);

async function ledDepartments(ctx: OrgContext) {
  const [me] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.orgId, ctx.org.id), eq(employees.userId, ctx.user.id), isNull(employees.deletedAt))).limit(1);
  if (!me) return [];
  return db.select({ id: departments.id, name: departments.name }).from(departments)
    .where(and(eq(departments.orgId, ctx.org.id), eq(departments.headEmployeeId, me.id), isNull(departments.deletedAt)));
}

/** The people a leader can give access to: their departments' staff who use WindVeal (not admins, not themself). */
async function myTeam(ctx: OrgContext) {
  const depts = await ledDepartments(ctx);
  if (!depts.length) return { depts, people: [] };
  const staff = await db.select({ userId: employees.userId, deptId: employees.departmentId, jobTitle: employees.jobTitle }).from(employees)
    .where(and(eq(employees.orgId, ctx.org.id), inArray(employees.departmentId, depts.map((d) => d.id)), isNull(employees.deletedAt), ne(employees.status, "left")));
  const ids = staff.map((s) => s.userId).filter((u): u is string => !!u && u !== ctx.user.id);
  if (!ids.length) return { depts, people: [] };
  const rows = await db.select({ m: memberships, name: users.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, ctx.org.id), inArray(memberships.userId, ids), isNull(memberships.deletedAt), ne(memberships.role, "admin")));
  const people = [];
  for (const { m, name } of rows) {
    const role = await loadRole(ctx.org.id, m.roleId);
    const s = staff.find((x) => x.userId === m.userId);
    people.push({ m, role, name, jobTitle: s?.jobTitle ?? null, department: depts.find((d) => d.id === s?.deptId)?.name ?? null });
  }
  return { depts, people };
}

export default async function teamAccessRoutes(app: FastifyInstance) {
  app.get("/api/team-access", async (req) => {
    const ctx = await requireOrg(req);
    const { depts, people } = await myTeam(ctx);
    if (!depts.length) throw forbidden("Only team leads can give access to their team.");
    return {
      departments: depts.map((d) => d.name),
      // What the lead can give: each platform they have, up to their own level.
      mine: ctx.access,
      people: people.map((p) => ({
        id: p.m.id, name: p.name, jobTitle: p.jobTitle, department: p.department, roleName: p.role?.name ?? null,
        access: computeAccess(ctx.org, p.m, p.role),
      })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  app.patch<{ Params: { id: string } }>("/api/team-access/:id", async (req) => {
    const ctx = await requireOrg(req);
    const { access } = parse(z.object({ access: z.record(z.enum(AREAS), z.enum(ACCESS_LEVELS)) }), req.body);
    const { depts, people } = await myTeam(ctx);
    if (!depts.length) throw forbidden("Only team leads can give access to their team.");
    const p = people.find((x) => x.m.id === req.params.id);
    if (!p) throw notFound("That person isn't in your team");
    const now = computeAccess(ctx.org, p.m, p.role);
    const base = roleAccess(ctx.org, p.m, p.role);
    const next = { ...(p.m.workspaceAccess as Partial<Record<Area, AccessLevel>>) };
    const changed: string[] = [];
    for (const [area, level] of Object.entries(access) as [Area, AccessLevel][]) {
      if (level === now[area]) continue;
      const mine = ctx.access[area];
      const top = isPersonal(area) ? "view" : mine;
      if (mine === "none") throw forbidden("You can only give platforms you have yourself.");
      if (rank(level) > rank(top) || rank(now[area]) > rank(top)) throw forbidden("You can only give access up to your own level. Ask an admin for more.");
      if (isPersonal(area) && level !== "none" && level !== "view") throw badRequest("My Workspace platforms are on or off.");
      // Back to what their role gives: no longer something changed for them alone.
      if (level === base[area]) delete next[area]; else next[area] = level;
      changed.push(area);
    }
    if (!changed.length) return { ok: true };
    await db.update(memberships).set({ workspaceAccess: next }).where(eq(memberships.id, p.m.id));
    await audit(ctx, { action: "member.access_changed", category: "access", summary: `${ctx.user.name} changed ${p.name}'s access (${changed.join(", ")})` });
    await notify(ctx.org.id, p.m.userId, `${ctx.user.name} changed what you can open`, undefined, "/");
    return { ok: true };
  });
}
