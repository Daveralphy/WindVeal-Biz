import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Pricing, plan limits and supported countries — served by the API from data/pricing.json. */
export type PricingPlan = {
  key: "free" | "growth" | "pro" | "enterprise";
  name: string;
  description: string;
  cta: string;
  popular?: boolean;
  custom?: boolean;
  storageGB: number;
  aiRequestsPerMonth: number;
  prices: Record<string, number>;
  features: string[];
};
export type Pricing = {
  defaultCurrency: string;
  yearlyMonthsFree: number;
  countries: { code: string; name: string; currency: string; timeZones: string[] }[];
  plans: PricingPlan[];
  compare: { label: string; values: Record<string, boolean | string> }[];
};

export function usePricing() {
  return useQuery({ queryKey: ["pricing"], queryFn: () => api.get<Pricing>("/api/public/pricing"), staleTime: 300_000 });
}

/** Monthly price of a plan in a currency (falls back to the default currency). */
export function monthlyPrice(pricing: Pricing, plan: PricingPlan, currency: string): { amount: number; currency: string } {
  if (plan.prices[currency] !== undefined) return { amount: plan.prices[currency]!, currency };
  return { amount: plan.prices[pricing.defaultCurrency] ?? 0, currency: pricing.defaultCurrency };
}

export const yearlyTotal = (pricing: Pricing, monthly: number) => monthly * (12 - pricing.yearlyMonthsFree);
