import { db, type Tx } from "../db/client";
import { auditEvents, notifications } from "../db/schema";
import type { OrgContext } from "./context";

type AuditInput = {
  action: string;
  summary: string;
  category?: "access" | "data" | "sync" | "settings" | "general";
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
};

/** Records an immutable audit event. Audit history cannot be edited or deleted. */
export async function audit(ctx: Pick<OrgContext, "org" | "user" | "deviceLabel">, input: AuditInput, tx: Tx = db) {
  await tx.insert(auditEvents).values({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    action: input.action,
    category: input.category ?? "general",
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    meta: input.meta ?? {},
    deviceLabel: ctx.deviceLabel,
  });
}

export async function notify(orgId: string, userId: string, title: string, body?: string, link?: string, tx: Tx = db) {
  await tx.insert(notifications).values({ orgId, userId, title, body, link });
}
