import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { env } from "../env";

/**
 * Pricing, plan limits and supported countries come from data/pricing.json, not from the code.
 * The file is re-read whenever it changes, so edits apply without restarting the API.
 */
const plan = z.object({
  key: z.enum(["free", "growth", "pro", "enterprise"]),
  name: z.string(),
  description: z.string(),
  cta: z.string(),
  popular: z.boolean().optional(),
  custom: z.boolean().optional(),
  storageGB: z.number().nonnegative(),
  aiRequestsPerMonth: z.number().int().nonnegative(),
  prices: z.record(z.string(), z.number().nonnegative()),
  features: z.array(z.string()),
});
export const pricingSchema = z.object({
  defaultCurrency: z.string().length(3),
  yearlyMonthsFree: z.number().int().min(0).max(11),
  countries: z.array(z.object({ code: z.string().length(2), name: z.string(), currency: z.string().length(3), timeZones: z.array(z.string()) })).min(1),
  plans: z.array(plan).min(1),
  compare: z.array(z.object({ label: z.string(), values: z.record(z.string(), z.union([z.boolean(), z.string()])) })),
});
export type Pricing = z.infer<typeof pricingSchema>;

const file = () => path.join(env.dataDir, "pricing.json");
let cache: { mtime: number; data: Pricing } | null = null;

export function loadPricing(): Pricing {
  const f = file();
  const stat = fs.statSync(f, { throwIfNoEntry: false });
  if (!stat) throw new Error(`Pricing file not found at ${f}.`);
  if (cache && cache.mtime === stat.mtimeMs) return cache.data;
  const data = pricingSchema.parse(JSON.parse(fs.readFileSync(f, "utf8")));
  cache = { mtime: stat.mtimeMs, data };
  return data;
}

export function planStorageBytes(key: string): number {
  const p = loadPricing().plans.find((x) => x.key === key);
  return Math.round((p?.storageGB ?? 0) * 1024 ** 3);
}

export function currencyForCountry(code: string): string | null {
  return loadPricing().countries.find((c) => c.code === code)?.currency ?? null;
}
