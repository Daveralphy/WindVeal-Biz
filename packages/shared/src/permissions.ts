import { ACCESS_LEVELS, AREAS, PERSONAL_AREAS, type AccessLevel, type Area, type Role, WORKSPACES } from "./constants";

export type WorkspaceAccess = Partial<Record<Area, AccessLevel>>;

/** Everyone's own platforms start on. */
const PERSONAL_ON = Object.fromEntries(PERSONAL_AREAS.map((p) => [p, "view"])) as Record<(typeof PERSONAL_AREAS)[number], AccessLevel>;

export const DEFAULT_ACCESS: Record<Role, Record<Area, AccessLevel>> = {
  admin: { recruitment: "manage", people: "manage", crm: "manage", workflows: "manage", documents: "manage", insights: "manage", ...PERSONAL_ON },
  manager: { recruitment: "edit", people: "view", crm: "edit", workflows: "edit", documents: "edit", insights: "view", ...PERSONAL_ON },
  // Everyone has My Workspace for their own things; anything more is given by an admin or their team lead.
  member: { recruitment: "none", people: "none", crm: "none", workflows: "none", documents: "none", insights: "none", ...PERSONAL_ON },
};

export function accessFor(role: Role, overrides: WorkspaceAccess | null | undefined, ws: Area): AccessLevel {
  if (role === "admin") return "manage";
  return overrides?.[ws] ?? DEFAULT_ACCESS[role][ws];
}

export function hasAccess(level: AccessLevel, needed: AccessLevel): boolean {
  return ACCESS_LEVELS.indexOf(level) >= ACCESS_LEVELS.indexOf(needed);
}

export function effectiveAccess(role: Role, overrides: WorkspaceAccess | null | undefined): Record<Area, AccessLevel> {
  return Object.fromEntries(AREAS.map((w) => [w, accessFor(role, overrides, w)])) as Record<Area, AccessLevel>;
}

export const SPECIAL_PERMISSIONS = ["approve_leave", "see_pay", "export_data", "import_data", "manage_members", "manage_billing"] as const;
export type SpecialPermission = (typeof SPECIAL_PERMISSIONS)[number];

/** How each extra permission is described wherever roles and access are shown. */
export const SPECIAL_LABELS: Record<SpecialPermission, { name: string; what: string }> = {
  approve_leave: { name: "Approve leave", what: "Leave requests from the people they manage" },
  see_pay: { name: "See pay", what: "Salaries and bank details in People & HR" },
  export_data: { name: "Export data", what: "Download lists and reports" },
  import_data: { name: "Import data", what: "Bring in records from spreadsheets" },
  manage_members: { name: "Invite and manage members", what: "Add people and change their roles" },
  manage_billing: { name: "Billing", what: "Change the plan and payment details" },
};

export const DEFAULT_SPECIAL: Record<Role, SpecialPermission[]> = {
  admin: [...SPECIAL_PERMISSIONS],
  manager: ["approve_leave", "export_data"],
  member: [],
};

export function hasSpecial(role: Role, extra: SpecialPermission[] | null | undefined, p: SpecialPermission): boolean {
  return DEFAULT_SPECIAL[role].includes(p) || (extra ?? []).includes(p);
}

/** Plans in order. Custom roles come with Growth and up; Free has Admin and Manager. */
const PLAN_ORDER = ["free", "growth", "pro", "enterprise"] as const;
export function planAtLeast(plan: string, needed: (typeof PLAN_ORDER)[number]): boolean {
  return PLAN_ORDER.indexOf(plan as (typeof PLAN_ORDER)[number]) >= PLAN_ORDER.indexOf(needed);
}

/** On Free, this many roles (not counting Admin) can open more than My Workspace. Growth and up: no limit. */
export const FREE_ROLES_WITH_ACCESS = 3;

/** Whether a role opens anything beyond My Workspace. */
/** Only the team workspaces count: the personal platforms are everyone's by default. */
export const opensMore = (r: { access: Partial<Record<Area, AccessLevel>>; special: readonly string[] }) =>
  WORKSPACES.some((w) => { const v = r.access[w]; return !!v && v !== "none"; }) || r.special.length > 0;
