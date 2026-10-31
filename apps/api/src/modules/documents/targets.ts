import { and, eq, ilike, inArray, isNull, or, sql as dsql } from "drizzle-orm";
import { db } from "../../db/client";
import { applications, candidates, companies, deals, employees, jobs, leads, tasks } from "../../db/schema";

export const LINK_TYPES = ["company", "deal", "lead", "employee", "task", "application", "job"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const LINK_TYPE_LABELS: Record<string, string> = {
  company: "CRM · company", deal: "CRM · deal", lead: "CRM · lead", employee: "People & HR", task: "Workflows · task",
  application: "Recruitment · application", job: "Recruitment · job",
};

export type ResolvedTarget = { type: string; id: string; label: string; sub: string };

/**
 * Resolves human labels for (linkType, linkId) pairs within one organisation.
 * Targets that don't exist (or belong to another organisation) are omitted from the result map.
 */
export async function resolveTargets(orgId: string, refs: { linkType: string; linkId: string }[]): Promise<Map<string, ResolvedTarget>> {
  const out = new Map<string, ResolvedTarget>();
  const ids = (t: string) => Array.from(new Set(refs.filter((r) => r.linkType === t).map((r) => r.linkId)));
  const key = (t: string, id: string) => `${t}:${id}`;

  const companyIds = ids("company");
  if (companyIds.length) {
    const rows = await db.select({ id: companies.id, name: companies.name }).from(companies)
      .where(and(eq(companies.orgId, orgId), inArray(companies.id, companyIds), isNull(companies.deletedAt)));
    for (const r of rows) out.set(key("company", r.id), { type: "company", id: r.id, label: r.name, sub: "CRM · company" });
  }
  const dealIds = ids("deal");
  if (dealIds.length) {
    const rows = await db.select({ id: deals.id, name: deals.name, company: companies.name }).from(deals)
      .leftJoin(companies, eq(companies.id, deals.companyId))
      .where(and(eq(deals.orgId, orgId), inArray(deals.id, dealIds), isNull(deals.deletedAt)));
    for (const r of rows) out.set(key("deal", r.id), { type: "deal", id: r.id, label: r.company ?? r.name, sub: `CRM · ${r.name} deal` });
  }
  const leadIds = ids("lead");
  if (leadIds.length) {
    const rows = await db.select({ id: leads.id, name: leads.companyName }).from(leads)
      .where(and(eq(leads.orgId, orgId), inArray(leads.id, leadIds), isNull(leads.deletedAt)));
    for (const r of rows) out.set(key("lead", r.id), { type: "lead", id: r.id, label: r.name, sub: "CRM · lead" });
  }
  const empIds = ids("employee");
  if (empIds.length) {
    const rows = await db.select({ id: employees.id, f: employees.firstName, l: employees.lastName, job: employees.jobTitle }).from(employees)
      .where(and(eq(employees.orgId, orgId), inArray(employees.id, empIds), isNull(employees.deletedAt)));
    for (const r of rows) out.set(key("employee", r.id), { type: "employee", id: r.id, label: `${r.f} ${r.l}`, sub: `People & HR${r.job ? ` · ${r.job}` : ""}` });
  }
  const taskIds = ids("task");
  if (taskIds.length) {
    const rows = await db.select({ id: tasks.id, title: tasks.title }).from(tasks)
      .where(and(eq(tasks.orgId, orgId), inArray(tasks.id, taskIds), isNull(tasks.deletedAt)));
    for (const r of rows) out.set(key("task", r.id), { type: "task", id: r.id, label: r.title, sub: "Workflows · task" });
  }
  const appIds = ids("application");
  if (appIds.length) {
    const rows = await db.select({ id: applications.id, f: candidates.firstName, l: candidates.lastName, job: jobs.title }).from(applications)
      .innerJoin(candidates, eq(candidates.id, applications.candidateId)).innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(and(eq(applications.orgId, orgId), inArray(applications.id, appIds), isNull(applications.deletedAt)));
    for (const r of rows) out.set(key("application", r.id), { type: "application", id: r.id, label: `${r.f} ${r.l}`, sub: `Recruitment · ${r.job}` });
  }
  const jobIds = ids("job");
  if (jobIds.length) {
    const rows = await db.select({ id: jobs.id, title: jobs.title }).from(jobs)
      .where(and(eq(jobs.orgId, orgId), inArray(jobs.id, jobIds), isNull(jobs.deletedAt)));
    for (const r of rows) out.set(key("job", r.id), { type: "job", id: r.id, label: r.title, sub: "Recruitment · job" });
  }
  return out;
}

export async function resolveTarget(orgId: string, linkType: string, linkId: string): Promise<ResolvedTarget | null> {
  return (await resolveTargets(orgId, [{ linkType, linkId }])).get(`${linkType}:${linkId}`) ?? null;
}

/** Name search across records that files and tasks can be linked to. */
export async function searchTargets(orgId: string, q: string, limit = 5): Promise<ResolvedTarget[]> {
  const term = `%${q.trim().replace(/[%_]/g, "")}%`;
  const out: ResolvedTarget[] = [];
  const [cs, ds, es, ts] = await Promise.all([
    db.select({ id: companies.id, name: companies.name }).from(companies)
      .where(and(eq(companies.orgId, orgId), isNull(companies.deletedAt), ilike(companies.name, term))).limit(limit),
    db.select({ id: deals.id, name: deals.name, company: companies.name }).from(deals).leftJoin(companies, eq(companies.id, deals.companyId))
      .where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), or(ilike(deals.name, term), ilike(companies.name, term)))).limit(limit),
    db.select({ id: employees.id, f: employees.firstName, l: employees.lastName, job: employees.jobTitle }).from(employees)
      .where(and(eq(employees.orgId, orgId), isNull(employees.deletedAt),
        ilike(dsql`${employees.firstName} || ' ' || ${employees.lastName}`, term))).limit(limit),
    db.select({ id: tasks.id, title: tasks.title }).from(tasks)
      .where(and(eq(tasks.orgId, orgId), isNull(tasks.deletedAt), ilike(tasks.title, term))).limit(limit),
  ]);
  for (const r of cs) out.push({ type: "company", id: r.id, label: r.name, sub: "CRM · company" });
  for (const r of ds) out.push({ type: "deal", id: r.id, label: r.company ? `${r.company} · ${r.name}` : r.name, sub: "CRM · deal" });
  for (const r of es) out.push({ type: "employee", id: r.id, label: `${r.f} ${r.l}`, sub: `People & HR${r.job ? ` · ${r.job}` : ""}` });
  for (const r of ts) out.push({ type: "task", id: r.id, label: r.title, sub: "Workflows · task" });
  return out;
}
