/**
 * Staff requests (My Workspace › Requests) and expense claims (My Workspace › Finance). Each goes to the right
 * person: by default the requester's manager; an admin can choose who handles each kind in Settings. Expense
 * claims go to the manager to approve, then to whoever pays them (finance).
 */
export const REQUEST_KINDS = ["equipment", "purchase", "it", "hr_letter", "hr_question", "other", "expense"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_LABELS: Record<RequestKind, { name: string; hint: string }> = {
  equipment: { name: "Equipment", hint: "A laptop, phone, chair or tools" },
  purchase: { name: "Purchase", hint: "Buy something for work" },
  it: { name: "IT help", hint: "Something isn't working" },
  hr_letter: { name: "Letter from HR", hint: "An employment or reference letter" },
  hr_question: { name: "HR question", hint: "Policies, pay or your contract" },
  other: { name: "Something else", hint: "Anything not listed" },
  expense: { name: "Expense claim", hint: "Money you spent for work" },
};

/** waiting: not started · in_progress: being handled · approved: expense approved, waiting to be paid · done / paid / declined / cancelled: closed. */
export type RequestStatus = "waiting" | "in_progress" | "approved" | "done" | "paid" | "declined" | "cancelled";
export const OPEN_REQUEST: RequestStatus[] = ["waiting", "in_progress", "approved"];

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  waiting: "Waiting", in_progress: "Being handled", approved: "Approved, to be paid", done: "Done", paid: "Paid", declined: "Not approved", cancelled: "Cancelled",
};
