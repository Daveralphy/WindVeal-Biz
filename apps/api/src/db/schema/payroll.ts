import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pk, tracked } from "./_common";
import { organisations, users } from "./core";
import { employees } from "./people";

export type PayRunStatus = "prepared" | "checked" | "approved" | "paid";
/** Amounts HR typed in themselves; WindVeal works out the rest around them. */
export type PayOverrides = Partial<Record<"basic" | "housing" | "transport" | "otherAllowances" | "bonus" | "pension" | "nhf" | "paye" | "otherDeductions", string>>;

/** One month's payroll: prepared by HR, checked, approved by an admin, then paid. */
export const payRuns = pgTable("pay_runs", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  period: text("period").notNull(), // "2026-11"
  status: text("status").$type<PayRunStatus>().notNull().default("prepared"),
  currency: text("currency").notNull(),
  preparedBy: uuid("prepared_by").references(() => users.id),
  checkedBy: uuid("checked_by").references(() => users.id),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidBy: uuid("paid_by").references(() => users.id),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  note: text("note"),
  ...tracked(),
}, (t) => [index("pay_runs_org_idx").on(t.orgId, t.period)]);

/** One person's pay for a run. Money is kept to two decimal places. */
export const payslips = pgTable("payslips", {
  id: pk(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  runId: uuid("run_id").notNull().references(() => payRuns.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  name: text("name").notNull(),
  jobTitle: text("job_title"),
  basic: numeric("basic", { precision: 14, scale: 2 }).notNull().default("0"),
  housing: numeric("housing", { precision: 14, scale: 2 }).notNull().default("0"),
  transport: numeric("transport", { precision: 14, scale: 2 }).notNull().default("0"),
  otherAllowances: numeric("other_allowances", { precision: 14, scale: 2 }).notNull().default("0"),
  bonus: numeric("bonus", { precision: 14, scale: 2 }).notNull().default("0"),
  gross: numeric("gross", { precision: 14, scale: 2 }).notNull().default("0"),
  pension: numeric("pension", { precision: 14, scale: 2 }).notNull().default("0"),
  nhf: numeric("nhf", { precision: 14, scale: 2 }).notNull().default("0"),
  paye: numeric("paye", { precision: 14, scale: 2 }).notNull().default("0"),
  otherDeductions: numeric("other_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
  net: numeric("net", { precision: 14, scale: 2 }).notNull().default("0"),
  overrides: jsonb("overrides").$type<PayOverrides>().notNull().default({}),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  note: text("note"),
  ...tracked(),
}, (t) => [index("payslips_run_idx").on(t.runId), index("payslips_emp_idx").on(t.employeeId)]);
