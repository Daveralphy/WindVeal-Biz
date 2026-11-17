import { boolean, doublePrecision, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pk, tracked } from "./_common";
import { organisations, users } from "./core";

/**
 * Shared task engine used by every workspace. A task can point at any record via
 * (linkType, linkId) without copying that record. Workspace = where the task came from.
 */
export const tasks = pgTable("tasks", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").$type<"todo" | "in_progress" | "done">().notNull().default("todo"),
  priority: text("priority").$type<"low" | "medium" | "high">().notNull().default("medium"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  assigneeUserId: uuid("assignee_user_id").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  workspace: text("workspace").notNull().default("workflows"), // recruitment | people | crm | workflows | documents
  linkType: text("link_type"), // employee | company | deal | lead | application | file | job
  linkId: uuid("link_id"),
  linkLabel: text("link_label"),
  checklistId: uuid("checklist_id"),
  checklistGroup: text("checklist_group"), // "Before day one", "First week"...
  repeatRule: text("repeat_rule"), // "monthly" | "weekly" | null
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: uuid("completed_by").references(() => users.id),
  /** On a team board: which board and list it sits in, and where in the list. */
  boardId: uuid("board_id"),
  listId: uuid("list_id"),
  position: doublePrecision("position"),
  /** Coloured labels on the card (colour names). */
  labels: jsonb("labels").$type<string[]>().notNull().default([]),
  /** Other people on the card, beside the assignee. */
  memberUserIds: jsonb("member_user_ids").$type<string[]>().notNull().default([]),
  /** Put away from the board, but kept (it can be brought back). */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  /** What happened to the card: created, moved, assigned, due date set... */
  history: jsonb("history").$type<{ at: string; by: string; byName: string; text: string }[]>().notNull().default([]),
  ...tracked(),
}, (t) => [
  index("tasks_org_assignee_idx").on(t.orgId, t.assigneeUserId),
  index("tasks_board_idx").on(t.boardId, t.listId),
  index("tasks_link_idx").on(t.linkType, t.linkId),
  index("tasks_checklist_idx").on(t.checklistId),
]);

export const taskItems = pgTable("task_items", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  label: text("label").notNull(),
  done: boolean("done").notNull().default(false),
  position: integer("position").notNull().default(0),
  ...tracked(),
});

export const taskComments = pgTable("task_comments", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  ...tracked(),
});

export type TemplateItem = { title: string; group?: string; assigneeRole: "hr" | "manager" | "employee" | "creator" | "admin"; offsetDays: number };

export const taskTemplates = pgTable("task_templates", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  name: text("name").notNull(),
  kind: text("kind").$type<"onboarding" | "offboarding" | "general">().notNull().default("general"),
  /** Automatic start, e.g. { event: "employee_joined", departmentId } */
  trigger: jsonb("trigger").$type<{ event: string; departmentId?: string } | null>(),
  items: jsonb("items").$type<TemplateItem[]>().notNull().default([]),
  timesUsed: integer("times_used").notNull().default(0),
  ...tracked(),
});

export const approvals = pgTable("approvals", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  kind: text("kind").$type<"leave" | "purchase" | "document" | "offer" | "other">().notNull(),
  title: text("title").notNull(),
  details: text("details"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  requestedBy: uuid("requested_by").notNull().references(() => users.id),
  status: text("status").$type<"pending" | "approved" | "declined">().notNull().default("pending"),
  linkType: text("link_type"),
  linkId: uuid("link_id"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...tracked(),
}, (t) => [index("approvals_org_idx").on(t.orgId, t.status)]);

export const approvalSteps = pgTable("approval_steps", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  approvalId: uuid("approval_id").notNull().references(() => approvals.id),
  position: integer("position").notNull(),
  approverUserId: uuid("approver_user_id").notNull().references(() => users.id),
  label: text("label"),
  status: text("status").$type<"waiting" | "pending" | "approved" | "declined" | "skipped">().notNull().default("waiting"),
  comment: text("comment"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

/** Admin-defined approval rules, e.g. purchases over an amount also need Finance. */
export const approvalRules = pgTable("approval_rules", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  kind: text("kind").notNull(),
  minAmount: numeric("min_amount", { precision: 14, scale: 2 }),
  approverUserId: uuid("approver_user_id").notNull().references(() => users.id),
  label: text("label"),
  position: integer("position").notNull().default(0),
  ...tracked(),
});

/**
 * A team's task board (like Trello): one per department, led by its head, or a personal one for someone
 * without a department. Cards are tasks; lists are the board's columns.
 */
export const boards = pgTable("boards", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  departmentId: uuid("department_id"),
  ownerUserId: uuid("owner_user_id"),
  name: text("name").notNull(),
  ...tracked(),
}, (t) => [index("boards_org_idx").on(t.orgId, t.departmentId)]);

export const boardLists = pgTable("board_lists", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  boardId: uuid("board_id").notNull(),
  name: text("name").notNull(),
  /** start = Getting started (new people's first tasks), todo, doing, done, or custom. Moving a card into done completes it. */
  kind: text("kind").$type<"start" | "todo" | "doing" | "done" | "custom">().notNull().default("custom"),
  position: doublePrecision("position").notNull(),
  ...tracked(),
}, (t) => [index("board_lists_board_idx").on(t.boardId)]);

/** A board's named labels (e.g. "Urgent", red). Cards list the ids of theirs. */
export const boardLabels = pgTable("board_labels", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  boardId: uuid("board_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  position: integer("position").notNull().default(0),
  ...tracked(),
}, (t) => [index("board_labels_board_idx").on(t.boardId)]);
