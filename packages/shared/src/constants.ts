export const WORKSPACES = ["recruitment", "people", "crm", "workflows", "documents", "insights"] as const;
export type Workspace = (typeof WORKSPACES)[number];

export const WORKSPACE_LABELS: Record<Workspace, string> = {
  recruitment: "Recruitment",
  people: "People & HR",
  crm: "CRM",
  workflows: "Workflows",
  documents: "Documents",
  insights: "Insights",
};

export const ACCESS_LEVELS = ["none", "view", "edit", "manage"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ROLES = ["admin", "manager", "member"] as const;
export type Role = (typeof ROLES)[number];

export const PLANS = ["free", "growth", "pro", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LIMITS: Record<Plan, { storageBytes: number; aiRequests: number; customRoles: boolean }> = {
  free: { storageBytes: 5 * 1024 ** 3, aiRequests: 0, customRoles: false },
  growth: { storageBytes: 50 * 1024 ** 3, aiRequests: 200, customRoles: true },
  pro: { storageBytes: 100 * 1024 ** 3, aiRequests: 1000, customRoles: true },
  enterprise: { storageBytes: 1024 ** 4, aiRequests: 10000, customRoles: true },
};

export const VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Country → currency used for pricing and money display. */
export const COUNTRIES: { code: string; name: string; currency: string }[] = [
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
];

export function currencyForCountry(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? "USD";
}

export const TEAM_SIZES = ["1 to 10 people", "11 to 50 people", "51 to 200 people", "201 to 500 people", "More than 500 people"];

export const INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Financial services", "Food and beverage distribution",
  "Healthcare", "Hospitality", "Logistics", "Manufacturing", "Professional services", "Retail", "Technology", "Other",
];

export const DEFAULT_RECRUITMENT_STAGES = ["Applied", "Screening", "Interview", "Offer", "Hired"];
export const DEFAULT_LEAD_STAGES = ["To contact", "Contacted", "Interested", "Qualified"];
export const DEFAULT_DEAL_STAGES = ["Qualified", "Proposal", "Negotiation"];

/** Monthly prices per plan in each currency (placeholders until pricing is finalised). */
export const PLAN_PRICES: Record<string, Record<"growth" | "pro", number>> = {
  NGN: { growth: 39000, pro: 79000 },
  GHS: { growth: 450, pro: 900 },
  KES: { growth: 4900, pro: 9900 },
  ZAR: { growth: 690, pro: 1390 },
  USD: { growth: 49, pro: 99 },
  GBP: { growth: 39, pro: 79 },
};
