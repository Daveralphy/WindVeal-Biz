import { useEffect, useState } from "react";

/** Pricing data — served by the API from data/pricing.json (nothing about prices lives in the code). */
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

type State = { status: "loading" } | { status: "error" } | { status: "ok"; data: Pricing };

export function usePricing(): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetch("/api/public/pricing")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: Pricing) => alive && setState({ status: "ok", data }))
      .catch(() => alive && setState({ status: "error" }));
    return () => { alive = false; };
  }, []);
  return state;
}

/**
 * Works out the visitor's country without asking for permission: first from their device's
 * time zone (where they actually are), then from their language settings (e.g. "en-NG").
 * Returns the currency to show, or the default currency if their country isn't supported.
 */
export function detectCurrency(pricing: Pricing): { currency: string; country: string | null } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byZone = pricing.countries.find((c) => c.timeZones.includes(tz));
    if (byZone) return { currency: byZone.currency, country: byZone.name };
  } catch { /* ignore */ }
  const langs = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const lang of langs) {
    if (!lang) continue;
    let region: string | undefined;
    try { region = new Intl.Locale(lang).region; } catch { region = lang.split(/[-_]/)[1]; }
    const c = region ? pricing.countries.find((x) => x.code === region!.toUpperCase()) : undefined;
    if (c) return { currency: c.currency, country: c.name };
  }
  return { currency: pricing.defaultCurrency, country: null };
}

export function monthlyPrice(pricing: Pricing, plan: PricingPlan, currency: string): number {
  return plan.prices[currency] ?? plan.prices[pricing.defaultCurrency] ?? 0;
}
