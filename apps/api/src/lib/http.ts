import type { ZodSchema } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

export const badRequest = (message: string, details?: Record<string, string>) => new AppError(400, "bad_request", message, details);
export const unauthorized = (message = "Please sign in to continue.") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "You don't have permission to do that.") => new AppError(403, "forbidden", message);
export const notFound = (what = "That item") => new AppError(404, "not_found", `${what} wasn't found.`);
export const conflict = (message: string, details?: Record<string, string>) => new AppError(409, "conflict", message, details);

/** Validate input against a Zod schema; throws a 400 with per-field messages. */
export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const details: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!details[key]) details[key] = issue.message;
  }
  throw badRequest("Some details need fixing.", details);
}

export function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return typeof d === "string" ? d : d.toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
