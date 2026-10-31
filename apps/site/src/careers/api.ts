import { useEffect, useState } from "react";
import { COUNTRIES } from "@windveal/shared";

export interface CareersOrg {
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  brandColor: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  teamSize: string | null;
  website: string | null;
  perks: string[] | null;
}

export interface JobSummary {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  postedAt: string | null;
  isNew: boolean;
}

export type QuestionType = "text" | "choice" | "yesno" | "number";
export interface JobQuestion {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
}

export interface JobDetail extends Omit<JobSummary, "isNew"> {
  description: string | null;
  salary: { min: number | null; max: number | null; period: string | null; currency: string } | null;
  applyBy: string | null;
  questions: JobQuestion[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: Record<string, string> } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? "Something went wrong. Please try again.", err?.details ?? {});
  }
  return body as T;
}

const enc = encodeURIComponent;

export const careersApi = {
  company: (slug: string) => fetch(`/api/careers/${enc(slug)}`).then((r) => parse<{ org: CareersOrg; jobs: JobSummary[] }>(r)),
  job: (slug: string, jobSlug: string) => fetch(`/api/careers/${enc(slug)}/jobs/${enc(jobSlug)}`).then((r) => parse<{ org: CareersOrg; job: JobDetail }>(r)),
  apply: (slug: string, jobSlug: string, data: FormData) =>
    fetch(`/api/careers/${enc(slug)}/jobs/${enc(jobSlug)}/apply`, { method: "POST", body: data }).then((r) => parse<{ ok: true }>(r)),
};

export type Load<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: ApiError };

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fn().then(
      (data) => alive && setState({ status: "ok", data }),
      (e: unknown) => alive && setState({ status: "error", error: e instanceof ApiError ? e : new ApiError(0, "network", "We couldn't reach the server. Check your connection and try again.") }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/* ---------- formatting ---------- */
export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 14) return "Posted 1 week ago";
  if (days < 31) return `Posted ${Math.floor(days / 7)} weeks ago`;
  if (days < 61) return "Posted 1 month ago";
  return `Posted ${Math.floor(days / 30)} months ago`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  "full-time": "Full-time",
  fulltime: "Full-time",
  part_time: "Part-time",
  "part-time": "Part-time",
  parttime: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
  volunteer: "Volunteer",
};
export function employmentLabel(t: string | null): string {
  if (!t) return "";
  return TYPE_LABELS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
}

export function countryName(c: string | null): string | null {
  if (!c) return null;
  return COUNTRIES.find((x) => x.code === c.toUpperCase())?.name ?? c;
}

export function orgPlace(org: CareersOrg): string {
  return [org.city, countryName(org.country)].filter(Boolean).join(", ");
}

export function websiteHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
export function websiteHref(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

/** Normalise a brand colour to a safe 6-digit hex value. */
export function safeColor(c: string | null | undefined): string {
  const v = c?.trim() ?? "";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return "#263f91";
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** CSS variables for a company's brand: the colour, readable text on it, and a readable text shade of it on white. */
export function brandVars(color: string | null | undefined): Record<string, string> {
  const brand = safeColor(color);
  const lum = luminance(brand);
  return {
    "--brand": brand,
    "--brand-on": lum > 0.45 ? "#111614" : "#ffffff",
    "--brand-text": lum > 0.2 ? `color-mix(in srgb, ${brand} 55%, #000)` : brand,
  };
}
