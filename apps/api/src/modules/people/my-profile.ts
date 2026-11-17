import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { departments, employees, fileLinks, files, users } from "../../db/schema";
import { requireOrg, type OrgContext } from "../../lib/context";
import { badRequest, forbidden, notFound, parse } from "../../lib/http";
import { audit } from "../../lib/audit";
import { readObject } from "../../lib/storage";
import { handleUpload } from "../files/routes";
import { myEmployee } from "./shared";

/**
 * My Workspace › Profile & documents: the person's own record in People & HR (HR sees the same) and the papers
 * on it (contract, ID, certificates). They can change their contact details and add their own documents.
 */
async function me(ctx: OrgContext) {
  const e = await myEmployee(ctx);
  if (!e) throw notFound("Your record");
  return e;
}

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v === "" ? null : v));

async function myFile(ctx: OrgContext, employeeId: string, fileId: string) {
  if (!z.string().uuid().safeParse(fileId).success) throw notFound("That document");
  const [row] = await db.select({ f: files }).from(fileLinks).innerJoin(files, eq(files.id, fileLinks.fileId))
    .where(and(eq(fileLinks.orgId, ctx.org.id), eq(fileLinks.linkType, "employee"), eq(fileLinks.linkId, employeeId), eq(files.id, fileId), isNull(files.deletedAt))).limit(1);
  if (!row) throw notFound("That document");
  return row.f;
}

export default async function myProfileRoutes(app: FastifyInstance) {
  app.get("/api/my/details", async (req) => {
    const ctx = await requireOrg(req);
    const e = await me(ctx);
    const [dept] = e.departmentId ? await db.select({ name: departments.name }).from(departments).where(eq(departments.id, e.departmentId)).limit(1) : [];
    const [mgr] = e.managerId ? await db.select({ firstName: employees.firstName, lastName: employees.lastName }).from(employees).where(eq(employees.id, e.managerId)).limit(1) : [];
    return {
      details: {
        name: `${e.firstName} ${e.lastName}`.trim(), jobTitle: e.jobTitle, department: dept?.name ?? null, manager: mgr ? `${mgr.firstName} ${mgr.lastName}`.trim() : null,
        startDate: e.startDate, employmentType: e.employmentType, location: e.location, email: e.email, phone: e.phone,
        homeAddress: e.homeAddress, emergencyContact: e.emergencyContact, dateOfBirth: e.dateOfBirth, employeeCode: e.employeeCode,
      },
    };
  });

  /** The details that are theirs to keep up to date. Job, team and pay stay with HR. */
  app.patch("/api/my/details", async (req) => {
    const ctx = await requireOrg(req);
    const e = await me(ctx);
    const input = parse(z.object({ phone: optText(40), homeAddress: optText(300), emergencyContact: optText(200) }), req.body);
    const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (Object.keys(set).length) await db.update(employees).set(set).where(eq(employees.id, e.id));
    return { ok: true };
  });

  app.get("/api/my/documents", async (req) => {
    const ctx = await requireOrg(req);
    const e = await me(ctx);
    const rows = await db.select({ f: files }).from(fileLinks).innerJoin(files, eq(files.id, fileLinks.fileId))
      .where(and(eq(fileLinks.orgId, ctx.org.id), eq(fileLinks.linkType, "employee"), eq(fileLinks.linkId, e.id), isNull(files.deletedAt)))
      .orderBy(desc(files.createdAt));
    const by = new Map((rows.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...new Set(rows.map((r) => r.f.uploadedBy).filter((x): x is string => !!x))].concat(ctx.user.id))) : []).map((u) => [u.id, u.name]));
    return {
      documents: rows.map(({ f }) => ({
        id: f.id, name: f.name, category: f.category, expiresOn: f.expiresOn, size: f.size, mime: f.mime, createdAt: f.createdAt,
        addedBy: f.uploadedBy === ctx.user.id ? "You" : by.get(f.uploadedBy ?? "") ?? "HR", mine: f.uploadedBy === ctx.user.id,
      })),
    };
  });

  /** Adds a document to their own record (e.g. a renewed ID). It's private: them, HR and admins. */
  app.post<{ Querystring: { category?: string; expiresOn?: string } }>("/api/my/documents", async (req) => {
    const ctx = await requireOrg(req);
    const e = await me(ctx);
    const category = req.query.category?.trim().slice(0, 60) || null;
    const expiresOn = req.query.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(req.query.expiresOn) ? req.query.expiresOn : null;
    (req as unknown as { query: Record<string, string> }).query = { kind: "system" };
    const r = await handleUpload(req as never, ctx);
    if (!r.file) throw badRequest("That file couldn't be added.");
    await db.update(files).set({ category, expiresOn }).where(eq(files.id, r.file.id));
    await db.insert(fileLinks).values({ orgId: ctx.org.id, fileId: r.file.id, linkType: "employee", linkId: e.id, label: category });
    await audit(ctx, { action: "employee.document_added", category: "data", entityType: "employee", entityId: e.id, summary: `${ctx.user.name} added ${r.file.name} to their record` });
    return { ok: true, id: r.file.id };
  });

  app.get<{ Params: { id: string } }>("/api/my/documents/:id/content", async (req, reply) => {
    const ctx = await requireOrg(req);
    const f = await myFile(ctx, (await me(ctx)).id, req.params.id);
    reply.header("Content-Type", f.mime || "application/octet-stream");
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(f.name)}"`);
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(readObject(f.storageKey));
  });

  /** Only documents they added themselves; HR's stay. */
  app.delete<{ Params: { id: string } }>("/api/my/documents/:id", async (req) => {
    const ctx = await requireOrg(req);
    const f = await myFile(ctx, (await me(ctx)).id, req.params.id);
    if (f.uploadedBy !== ctx.user.id) throw forbidden("HR added this one, so only HR can remove it.");
    await db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, f.id));
    return { ok: true };
  });
}
