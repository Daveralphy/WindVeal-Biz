import { useEffect } from "react";
import { COUNTRIES, PLAN_PRICES } from "@windveal/shared";

export const APP_URL: string = (import.meta.env.VITE_APP_URL as string | undefined) ?? "http://localhost:5173";
export const SIGN_IN_URL = `${APP_URL}/sign-in`;
export const GET_STARTED_URL = `${APP_URL}/create-account`;
const env = import.meta.env as Record<string, string | undefined>;
/** Settings come from apps/site/.env (see .env.example), not from the code. */
export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL ?? "hello@windveal.com";
/** The organisation whose careers page the "Careers at WindVeal" links open (its slug in the app). */
export const COMPANY_CAREERS_SLUG = env.VITE_COMPANY_CAREERS_SLUG ?? "windveal";
export const COMPANY_CAREERS_PATH = `/careers/${COMPANY_CAREERS_SLUG}`;

/** Sets the document title for the current page. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** Picks a pricing currency from the visitor's locale region, e.g. "en-NG" → NGN. */
export function detectCurrency(): string {
  const langs = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const lang of langs) {
    if (!lang) continue;
    let region: string | undefined;
    try {
      region = new Intl.Locale(lang).region;
    } catch {
      region = lang.split(/[-_]/)[1];
    }
    if (!region) continue;
    const country = COUNTRIES.find((c) => c.code === region.toUpperCase());
    if (country && PLAN_PRICES[country.currency]) return country.currency;
  }
  return "USD";
}
