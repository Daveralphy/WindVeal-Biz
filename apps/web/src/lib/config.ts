const env = import.meta.env as Record<string, string | undefined>;

/** App settings come from apps/web/.env (see .env.example), not from the code. */
export const SITE_URL = env.VITE_SITE_URL ?? "http://localhost:5174";
export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL ?? "hello@windveal.com";
export const SUPPORT_EMAIL = env.VITE_SUPPORT_EMAIL ?? "support@windveal.com";
