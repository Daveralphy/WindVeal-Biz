import { LineChart, Briefcase, CheckSquare, FileText, UserPlus, Users, type LucideIcon } from "lucide-react";

export type WorkspaceKey = "recruitment" | "people-hr" | "crm" | "workflows" | "documents" | "insights";

export interface WorkspaceInfo {
  key: WorkspaceKey;
  name: string;
  icon: LucideIcon;
  /** One line used in menus and tiles. */
  line: string;
  /** Short line used in the product dropdown. */
  menuLine: string;
  path: string;
}

export const WORKSPACE_LIST: WorkspaceInfo[] = [
  { key: "recruitment", name: "Recruitment", icon: UserPlus, line: "Post jobs and hire the right people.", menuLine: "Post jobs and hire the right people.", path: "/product/recruitment" },
  { key: "people-hr", name: "People & HR", icon: Users, line: "Your team's records, leave and attendance, always up to date.", menuLine: "Records, leave and attendance in one place.", path: "/product/people-hr" },
  { key: "crm", name: "CRM", icon: Briefcase, line: "Every client, lead and deal, from first call to signed contract.", menuLine: "Every client, lead and deal, start to finish.", path: "/product/crm" },
  { key: "workflows", name: "Workflows", icon: CheckSquare, line: "Tasks and approvals that keep work moving.", menuLine: "Tasks and approvals that keep work moving.", path: "/product/workflows" },
  { key: "documents", name: "Documents", icon: FileText, line: "Every business file, safe and easy to find.", menuLine: "Every business file, safe and easy to find.", path: "/product/documents" },
  { key: "insights", name: "Insights", icon: LineChart, line: "Clear reports on how the business is doing.", menuLine: "Clear reports on how the business is doing.", path: "/product/insights" },
];

export const workspaceByKey = (k: WorkspaceKey) => WORKSPACE_LIST.find((w) => w.key === k)!;
