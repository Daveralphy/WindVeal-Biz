import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pk, tracked } from "./_common";
import { organisations, users } from "./core";

export type ImportSheet = {
  name: string;
  columns: string[];
  rowCount: number;
  include: boolean;
  /** Suggested / chosen destination, e.g. "people.employees", "crm.companies", "crm.leads", "recruitment.jobs" */
  destination: string | null;
  confidence: number; // 0..1
  /** column name -> destination field key (or null = don't import) */
  mapping: Record<string, string | null>;
  dateFormat?: "dmy" | "mdy" | "ymd";
};

export const importJobs = pgTable("import_jobs", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  fileName: text("file_name").notNull(),
  fileId: uuid("file_id"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  status: text("status").$type<"uploaded" | "mapping" | "reviewing" | "committed" | "cancelled" | "failed" | "undone">().notNull().default("uploaded"),
  sheets: jsonb("sheets").$type<ImportSheet[]>().notNull().default([]),
  summary: jsonb("summary").$type<Record<string, number>>().notNull().default({}),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  undoUntil: timestamp("undo_until", { withTimezone: true }),
  ...tracked(),
}, (t) => [index("import_jobs_org_idx").on(t.orgId)]);

export const importRows = pgTable("import_rows", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  jobId: uuid("job_id").notNull().references(() => importJobs.id),
  sheet: text("sheet").notNull(),
  rowNumber: integer("row_number").notNull(),
  data: jsonb("data").$type<Record<string, string>>().notNull(),
  /** Values after mapping/edits, keyed by destination field. */
  values: jsonb("values").$type<Record<string, string>>().notNull().default({}),
  status: text("status").$type<"ready" | "duplicate" | "invalid" | "excluded" | "imported" | "failed">().notNull().default("ready"),
  issues: jsonb("issues").$type<{ field?: string; message: string }[]>().notNull().default([]),
  /** For duplicates: skip | update | create */
  decision: text("decision").$type<"skip" | "update" | "create">(),
  duplicateOfId: uuid("duplicate_of_id"),
  resultEntityType: text("result_entity_type"),
  resultEntityId: uuid("result_entity_id"),
  error: text("error"),
  ...tracked(),
}, (t) => [index("import_rows_job_idx").on(t.jobId, t.sheet)]);
