import { DEFAULT_DEAL_STAGES, DEFAULT_LEAD_STAGES } from "@windveal/shared";
import type { Tx } from "../../db/client";
import { folders, leaveTypes, taskTemplates } from "../../db/schema";

/** Sensible starting data for a new organisation. Everything here can be changed later. */
export async function seedOrgDefaults(tx: Tx, orgId: string, userId: string) {
  await tx.insert(folders).values([
    { orgId, name: "Contracts", createdBy: userId },
    { orgId, name: "HR policies", createdBy: userId },
    { orgId, name: "Employee files", createdBy: userId, restricted: true, accessRoles: ["admin"] },
    { orgId, name: "Invoices", createdBy: userId },
    { orgId, name: "Proposals", createdBy: userId },
    { orgId, name: "CVs and applications", createdBy: userId, system: true, restricted: true, accessRoles: ["admin", "manager"] },
  ]);
  await tx.insert(leaveTypes).values([
    { orgId, name: "Annual leave", daysPerYear: "20" },
    { orgId, name: "Sick leave", daysPerYear: "10", requiresNote: true },
    { orgId, name: "Maternity leave", daysPerYear: "84" },
    { orgId, name: "Unpaid leave", daysPerYear: null, paid: false },
  ]);
  await tx.insert(taskTemplates).values([
    {
      orgId, name: "Starter onboarding", kind: "onboarding", trigger: { event: "employee_joined" },
      items: [
        { title: "Send offer letter and contract", group: "Before day one", assigneeRole: "hr", offsetDays: -5 },
        { title: "Set up work email", group: "Before day one", assigneeRole: "hr", offsetDays: -3 },
        { title: "Prepare equipment", group: "Before day one", assigneeRole: "hr", offsetDays: -3 },
        { title: "Welcome meeting with the team", group: "First week", assigneeRole: "manager", offsetDays: 0 },
        { title: "Collect ID and bank details", group: "First week", assigneeRole: "hr", offsetDays: 4 },
        { title: "Role training", group: "First week", assigneeRole: "manager", offsetDays: 6 },
        { title: "30-day check-in", group: "First month", assigneeRole: "manager", offsetDays: 30 },
      ],
    },
    {
      orgId, name: "Offboarding", kind: "offboarding", trigger: { event: "employee_leaving" },
      items: [
        { title: "Confirm last working day in writing", group: "Before leaving", assigneeRole: "hr", offsetDays: -14 },
        { title: "Hand over work and documents", group: "Before leaving", assigneeRole: "manager", offsetDays: -7 },
        { title: "Collect equipment", group: "Last day", assigneeRole: "hr", offsetDays: 0 },
        { title: "Remove app access", group: "Last day", assigneeRole: "hr", offsetDays: 0 },
        { title: "Final pay and documents", group: "After leaving", assigneeRole: "hr", offsetDays: 7 },
      ],
    },
  ]);
  return { leadStages: DEFAULT_LEAD_STAGES, dealStages: DEFAULT_DEAL_STAGES };
}
