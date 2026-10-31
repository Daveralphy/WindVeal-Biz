import { ACCESS_LEVELS, type AccessLevel, type Role, type Workspace, WORKSPACES } from "./constants";

export type WorkspaceAccess = Partial<Record<Workspace, AccessLevel>>;

export const DEFAULT_ACCESS: Record<Role, Record<Workspace, AccessLevel>> = {
  admin: { recruitment: "manage", people: "manage", crm: "manage", workflows: "manage", documents: "manage", insights: "manage" },
  manager: { recruitment: "edit", people: "view", crm: "edit", workflows: "edit", documents: "edit", insights: "view" },
  member: { recruitment: "none", people: "view", crm: "edit", workflows: "edit", documents: "view", insights: "none" },
};

export function accessFor(role: Role, overrides: WorkspaceAccess | null | undefined, ws: Workspace): AccessLevel {
  if (role === "admin") return "manage";
  return overrides?.[ws] ?? DEFAULT_ACCESS[role][ws];
}

export function hasAccess(level: AccessLevel, needed: AccessLevel): boolean {
  return ACCESS_LEVELS.indexOf(level) >= ACCESS_LEVELS.indexOf(needed);
}

export function effectiveAccess(role: Role, overrides: WorkspaceAccess | null | undefined): Record<Workspace, AccessLevel> {
  return Object.fromEntries(WORKSPACES.map((w) => [w, accessFor(role, overrides, w)])) as Record<Workspace, AccessLevel>;
}

export const SPECIAL_PERMISSIONS = ["approve_leave", "see_pay", "export_data", "manage_billing"] as const;
export type SpecialPermission = (typeof SPECIAL_PERMISSIONS)[number];

export const DEFAULT_SPECIAL: Record<Role, SpecialPermission[]> = {
  admin: ["approve_leave", "see_pay", "export_data", "manage_billing"],
  manager: ["approve_leave", "export_data"],
  member: [],
};

export function hasSpecial(role: Role, extra: SpecialPermission[] | null | undefined, p: SpecialPermission): boolean {
  return DEFAULT_SPECIAL[role].includes(p) || (extra ?? []).includes(p);
}
