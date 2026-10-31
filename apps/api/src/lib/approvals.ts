import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db, type Tx } from "../db/client";
import { approvalRules, approvalSteps, approvals } from "../db/schema";
import { notify } from "./audit";

type Approval = typeof approvals.$inferSelect;
export type ApprovalHandler = (approval: Approval, outcome: "approved" | "declined", actorUserId: string, tx: Tx) => Promise<void>;

/**
 * Workspaces register what should happen when an approval of their kind is finally decided,
 * e.g. People & HR marks the leave request approved/declined. Workflows owns the queue + decisions.
 */
const handlers = new Map<string, ApprovalHandler>();
export function onApprovalDecided(kind: string, handler: ApprovalHandler) {
  handlers.set(kind, handler);
}
export function approvalHandler(kind: string) {
  return handlers.get(kind);
}

/**
 * Creates an approval. `firstApproverUserId` decides first (e.g. the employee's manager);
 * organisation approval rules for this kind (e.g. purchases over an amount → Finance) add further steps.
 * Leave uses a single step: the manager's decision is final.
 */
export async function createApproval(opts: {
  orgId: string; kind: Approval["kind"]; title: string; details?: string | null; amount?: number | null;
  requestedBy: string; firstApproverUserId: string; firstLabel?: string; linkType?: string; linkId?: string; tx?: Tx;
}) {
  const tx = opts.tx ?? db;
  const [a] = await tx.insert(approvals).values({
    orgId: opts.orgId, kind: opts.kind, title: opts.title, details: opts.details ?? null,
    amount: opts.amount != null ? String(opts.amount) : null, requestedBy: opts.requestedBy,
    linkType: opts.linkType ?? null, linkId: opts.linkId ?? null,
  }).returning();
  const steps: { approverUserId: string; label: string | null }[] = [{ approverUserId: opts.firstApproverUserId, label: opts.firstLabel ?? null }];
  if (opts.kind !== "leave") {
    const amountCond = opts.amount != null
      ? or(isNull(approvalRules.minAmount), lte(approvalRules.minAmount, String(opts.amount)))
      : isNull(approvalRules.minAmount);
    const rules = await tx.select().from(approvalRules)
      .where(and(eq(approvalRules.orgId, opts.orgId), eq(approvalRules.kind, opts.kind), isNull(approvalRules.deletedAt), amountCond))
      .orderBy(asc(approvalRules.position));
    for (const r of rules) {
      if (!steps.some((s) => s.approverUserId === r.approverUserId)) steps.push({ approverUserId: r.approverUserId, label: r.label });
    }
  }
  await tx.insert(approvalSteps).values(steps.map((s, i) => ({
    orgId: opts.orgId, approvalId: a!.id, position: i, approverUserId: s.approverUserId, label: s.label, status: i === 0 ? "pending" as const : "waiting" as const,
  })));
  await notify(opts.orgId, opts.firstApproverUserId, `Approval needed: ${opts.title}`, undefined, `/workflows/approvals?id=${a!.id}`, tx);
  return a!;
}
