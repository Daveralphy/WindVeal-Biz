import path from "node:path";

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing environment variable ${name}. Copy apps/api/.env.example to apps/api/.env.`);
  return v;
}

export const env = {
  databaseUrl: req("DATABASE_URL", "postgres://windveal:windveal@localhost:5433/windveal"),
  sessionSecret: req("SESSION_SECRET", "dev-only-secret"),
  appUrl: req("APP_URL", "http://localhost:5173"),
  siteUrl: req("SITE_URL", "http://localhost:5174"),
  port: Number(process.env.API_PORT ?? 4000),
  storageDir: path.resolve(process.env.STORAGE_DIR ?? "./storage"),
  isProd: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test" || process.env.VITEST === "true",
};
