import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app";
import { recentMail } from "../src/lib/mailer";

let appPromise: Promise<FastifyInstance> | null = null;
export function getApp() {
  appPromise ??= buildApp();
  return appPromise;
}

/** A tiny cookie-keeping client around app.inject. */
export class Client {
  cookies: Record<string, string> = {};
  constructor(private app: FastifyInstance) {}
  async req(method: string, url: string, payload?: unknown) {
    const res = await this.app.inject({
      method: method as "GET",
      url,
      payload: payload as object | undefined,
      headers: { cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    for (const c of res.cookies) {
      if (c.value === "" || (c.maxAge !== undefined && c.maxAge <= 0)) delete this.cookies[c.name];
      else this.cookies[c.name] = c.value;
    }
    let body: any = null;
    try { body = res.json(); } catch { body = res.body; }
    return { status: res.statusCode, body };
  }
  get = (u: string) => this.req("GET", u);
  post = (u: string, p?: unknown) => this.req("POST", u, p ?? {});
  patch = (u: string, p?: unknown) => this.req("PATCH", u, p ?? {});
  put = (u: string, p?: unknown) => this.req("PUT", u, p ?? {});
  del = (u: string) => this.req("DELETE", u);
}

export const PASSWORD = "Sunrise#2026x";

export async function signUp(app: FastifyInstance, name = "Test Person") {
  const c = new Client(app);
  const email = `t-${randomUUID().slice(0, 8)}@example.com`;
  const r = await c.post("/api/auth/register", { name, email, password: PASSWORD, acceptTerms: true });
  if (r.status !== 200) throw new Error(`register failed: ${JSON.stringify(r.body)}`);
  const code = recentMail(email)[0]!.code!;
  const v = await c.post("/api/auth/verify-email", { code });
  if (v.status !== 200) throw new Error(`verify failed: ${JSON.stringify(v.body)}`);
  return { c, email };
}

export async function signUpWithOrg(app: FastifyInstance, orgName = `Sunrise ${randomUUID().slice(0, 6)}`) {
  const { c, email } = await signUp(app, "Amaka Okafor");
  const r = await c.post("/api/org", {
    legalName: `${orgName} Limited`, tradingName: orgName, industry: "Retail", teamSize: "11 to 50 people",
    country: "NG", city: "Lagos", address: "14 Creek Road, Apapa",
  });
  if (r.status !== 200) throw new Error(`org failed: ${JSON.stringify(r.body)}`);
  return { c, email, org: r.body.org };
}

/** Invites someone into the admin's org and returns a signed-in client for them. */
export async function addMember(app: FastifyInstance, admin: Client, role: "admin" | "manager" | "member", name = "Team Member") {
  const { c, email } = await signUp(app, name);
  await admin.post("/api/invitations", { invites: [{ email, role }] });
  const link = recentMail(email).find((m) => m.link?.includes("/invite/"))!.link!;
  const token = link.split("/invite/")[1]!;
  const r = await c.post(`/api/invite/${token}/accept`);
  if (r.status !== 200) throw new Error(`accept failed: ${JSON.stringify(r.body)}`);
  return { c, email };
}
