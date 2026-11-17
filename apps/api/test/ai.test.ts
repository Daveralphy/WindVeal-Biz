import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { aiChats, organisations } from "../src/db/schema";
import { env } from "../src/env";
import { addMember, getApp, signUpWithOrg } from "./helpers";

/** A stand-in for a model server: answers each request with the next scripted reply, and remembers what it was sent. */
const script: unknown[] = [];
const seen: any[] = [];
/** Where each request went and its headers. */
const seenReq: { url: string; headers: http.IncomingHttpHeaders }[] = [];
/** A scripted reply that's an error instead: the HTTP status and body to send. */
const fail = (status: number, body: unknown) => ({ __status: status, body });
let server: http.Server;
const say = (content: string) => ({ choices: [{ message: { role: "assistant", content } }] });
const useTool = (name: string, args: unknown) => ({
  choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: `call_${name}_${seen.length}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }],
});

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen.push(JSON.parse(body));
      seenReq.push({ url: req.url ?? "", headers: req.headers });
      res.setHeader("Content-Type", "application/json");
      const next: any = script.shift() ?? say("(no more scripted replies)");
      if (next?.__status) { res.statusCode = next.__status; res.end(JSON.stringify(next.body)); return; }
      res.end(JSON.stringify(next));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
});
afterAll(() => { server.close(); env.aiBaseUrl = ""; env.aiModel = ""; env.aiFormat = ""; env.aiApiKey = ""; });

const connect = () => { env.aiFormat = ""; env.aiBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`; env.aiModel = "test-model"; };
/** The same stand-in, answering in Anthropic's Messages format. */
const connectAnthropic = () => {
  env.aiFormat = "anthropic"; env.aiBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; env.aiModel = "claude-test"; env.aiApiKey = "test-key";
};
const claude = (content: unknown[], stop_reason = "end_turn") => ({
  id: `msg_${seen.length}`, type: "message", role: "assistant", model: "claude-test", content, stop_reason, stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
});
const growth = (orgId: string) => db.update(organisations).set({ plan: "growth" }).where(eq(organisations.id, orgId));

describe("WindVeal AI", () => {
  it("shows as not connected until a model is set up", async () => {
    const app = await getApp();
    const { c } = await signUpWithOrg(app);
    env.aiBaseUrl = ""; env.aiModel = "";
    expect((await c.get("/api/ai/status")).body).toMatchObject({ connected: false, used: 0, limit: 0 });
    expect((await c.post("/api/ai/chat", { messages: [{ role: "user", content: "hi" }] })).status).toBe(503);
  });

  it("comes with Growth: Free has no AI", async () => {
    const app = await getApp();
    const { c } = await signUpWithOrg(app);
    connect();
    const r = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "hi" }] });
    expect(r.status).toBe(402);
  });

  it("looks things up with the person's own access, and answers", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connect();
    script.push(useTool("my_leave", {}), say("You have 20 days of annual leave left."));
    const r = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "How much leave do I have?" }] });
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe("You have 20 days of annual leave left.");
    // A button to where the answer lives, from what it looked at.
    expect(r.body.links).toEqual([{ label: "Open My leave", to: "/me/leave" }]);
    // The tool's answer went back to the model; the tools were offered in the standard format.
    expect(r.body.messages.some((m: any) => m.role === "tool")).toBe(true);
    expect(seen.at(-1).tools.map((t: any) => t.function.name)).toContain("request_leave");
    expect((await c.get("/api/ai/status")).body).toMatchObject({ connected: true, used: 1, limit: 200 });
  });

  it("proposes a change, does it only once confirmed, and can be cancelled", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connect();
    script.push(useTool("create_task", { title: "Call Apex Bakery", dueDate: "2026-12-01", priority: "high" }));
    const r = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "Remind me to call Apex Bakery on 1 Dec, it's urgent" }] });
    expect(r.body.proposal).toMatchObject({ tool: "create_task" });
    expect(r.body.proposal.summary).toContain("Call Apex Bakery");
    // Nothing yet.
    const before = (await c.get("/api/workflows/tasks?scope=mine")).body.groups.flatMap((g: any) => g.tasks);
    expect(before.some((t: any) => t.title === "Call Apex Bakery")).toBe(false);
    script.push(say("Done: I've added it, due 1 Dec."));
    const ok = await c.post("/api/ai/confirm", { messages: r.body.messages, toolCallId: r.body.proposal.toolCallId, confirm: true });
    expect(ok.body).toMatchObject({ done: true, reply: "Done: I've added it, due 1 Dec." });
    const after = (await c.get("/api/workflows/tasks?scope=mine")).body.groups.flatMap((g: any) => g.tasks);
    expect(after.some((t: any) => t.title === "Call Apex Bakery")).toBe(true);
    // The same change can't be answered twice.
    expect((await c.post("/api/ai/confirm", { messages: ok.body.messages, toolCallId: r.body.proposal.toolCallId, confirm: true })).status).toBe(400);

    script.push(useTool("add_company", { name: "Zeta Foods" }));
    const p = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "Add Zeta Foods as a company" }] });
    script.push(say("Okay, I've left it."));
    const no = await c.post("/api/ai/confirm", { messages: p.body.messages, toolCallId: p.body.proposal.toolCallId, confirm: false });
    expect(no.body.done).toBe(false);
    expect(JSON.stringify((await c.get("/api/crm/companies")).body)).not.toContain("Zeta Foods");
  });

  it("offers only the tools a question is about, so a small model answers faster", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connect();
    const offered = async (messages: unknown[]) => {
      script.push(say("ok"));
      await c.post("/api/ai/chat", { messages });
      return seen.at(-1).tools?.map((t: any) => t.function.name) ?? [];
    };
    const crm = await offered([{ role: "user", content: "Add Apex Bakery as a new lead" }]);
    expect(crm).toEqual(expect.arrayContaining(["search", "add_lead", "leads"]));
    expect(crm).not.toContain("request_leave");
    // A short follow-up carries on with the earlier topic.
    const followUp = await offered([
      { role: "user", content: "I want to take annual leave" }, { role: "assistant", content: "Which days?" }, { role: "user", content: "1 to 3 Dec" },
    ]);
    expect(followUp).toContain("request_leave");
    expect(followUp).not.toContain("add_deal");
    // Nothing recognisable: everything they can use.
    expect((await offered([{ role: "user", content: "hello" }])).length).toBeGreaterThan(15);
  });

  it("can't do anything the person couldn't do themself", async () => {
    const app = await getApp();
    const { c: admin, org } = await signUpWithOrg(app);
    await growth(org.id);
    const { c: member } = await addMember(app, admin, "member", "Plain Member");
    connect();
    script.push(useTool("team_today", {}), say("You can't see the team's attendance."));
    const r = await member.post("/api/ai/chat", { messages: [{ role: "user", content: "Who's in today?" }] });
    const tool = r.body.messages.find((m: any) => m.role === "tool");
    expect(JSON.parse(tool.content).error).toBeTruthy();
  });

  it("reads a sheet's values to say what each column really is, keeping only what WindVeal can use", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connect();
    const csv = "Name,Col B,Remark\nAda Obi,ada@example.com,0803 111 2222\nTunde Ade,tunde@example.com,0805 333 4444\n";
    const up = await app.inject({
      method: "POST", url: "/api/imports/upload",
      headers: { cookie: Object.entries(c.cookies).map(([k, v]) => `${k}=${v}`).join("; "), "content-type": "multipart/form-data; boundary=X" },
      payload: `--X\r\nContent-Disposition: form-data; name="file"; filename="staff.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--X--\r\n`,
    });
    const job = up.json().job;
    const sheet = job.sheets[0].name;
    script.push(say(`Here you go: {"destination": "people.employees", "mapping": {"Name": "fullName", "Col B": "email", "Remark": "phone", "Extra": "madeUpField"}, "notes": ["Col B holds email addresses.", "Remark holds phone numbers."]}`));
    const r = await c.post(`/api/ai/imports/${job.id}/check`, { sheet });
    expect(r.status).toBe(200);
    expect(r.body.destination).toBe("people.employees");
    expect(r.body.mapping).toMatchObject({ "Col B": "email", Remark: "phone" });
    expect(Object.keys(r.body.mapping)).not.toContain("Extra");
    expect(r.body.notes).toContain("Col B holds email addresses.");
    // The model was shown sample values, not just headers.
    expect(seen.at(-1).messages[0].content).toContain("ada@example.com");
    expect(seen.at(-1).tools).toBeUndefined();
  });

  it("keeps a person's chats for 15 days, for them only", async () => {
    const app = await getApp();
    const { c: admin, org } = await signUpWithOrg(app);
    await growth(org.id);
    const { c: member } = await addMember(app, admin, "member", "Chat Member");
    connect();
    const chatId = randomUUID();
    script.push(say("Hello! How can I help?"));
    await admin.post("/api/ai/chat", { chatId, area: "crm", messages: [{ role: "user", content: "Hi Veal" }] });
    const list = (await admin.get("/api/ai/chats?area=crm")).body;
    expect(list.chats).toMatchObject([{ id: chatId, title: "Hi Veal", area: "crm" }]);
    expect(list.keepDays).toBe(15);
    const got = (await admin.get(`/api/ai/chats/${chatId}`)).body;
    expect(got.messages.at(-1).content).toBe("Hello! How can I help?");
    // Nobody else can read it, or write over it.
    expect((await member.get(`/api/ai/chats/${chatId}`)).status).toBe(404);
    script.push(say("Hijacked"));
    await member.post("/api/ai/chat", { chatId, area: "crm", messages: [{ role: "user", content: "mine now" }] });
    expect((await admin.get(`/api/ai/chats/${chatId}`)).body.messages.at(-1).content).toBe("Hello! How can I help?");
    expect((await member.get("/api/ai/chats")).body.chats).toEqual([]);
    // Not used for 15 days: cleared.
    await db.update(aiChats).set({ updatedAt: new Date(Date.now() - 16 * 86_400_000) }).where(eq(aiChats.id, chatId));
    expect((await admin.get("/api/ai/chats")).body.chats).toEqual([]);
    expect((await admin.get(`/api/ai/chats/${chatId}`)).status).toBe(404);
  });

  it("says what it sees in a file added in the chat, with a button to check it in Import data", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connect();
    const csv = "Name,Col B\nAda Obi,ada@example.com\n";
    const up = await app.inject({
      method: "POST", url: "/api/imports/upload",
      headers: { cookie: Object.entries(c.cookies).map(([k, v]) => `${k}=${v}`).join("; "), "content-type": "multipart/form-data; boundary=X" },
      payload: `--X\r\nContent-Disposition: form-data; name="file"; filename="team.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--X--\r\n`,
    });
    const jobId = up.json().job.id;
    script.push(say("- **team** is your staff list. It belongs in **People & HR**.\n- Col B holds email addresses."));
    const chatId = randomUUID();
    const r = await c.post("/api/ai/files", { jobId, chatId, area: "home", messages: [] });
    expect(r.status).toBe(200);
    expect(r.body.reply).toContain("People & HR");
    expect(r.body.links).toEqual([{ label: "Review in Import data", to: `/import/${jobId}/sheets` }]);
    expect(seen.at(-1).messages[0].content).toContain("ada@example.com");
    // Saved with the file, titled by it.
    expect((await c.get("/api/ai/chats")).body.chats[0]).toMatchObject({ id: chatId, title: "team.csv" });
    // The extras (file, buttons) never reach the model on the next turn.
    script.push(say("Sure."));
    await c.post("/api/ai/chat", { chatId, messages: [...r.body.messages, { role: "user", content: "thanks" }] });
    expect(JSON.stringify(seen.at(-1).messages)).not.toContain("jobId");
    expect(JSON.stringify(seen.at(-1).messages)).not.toContain("Review in Import data");
  });

  it("never looks at an area by itself: only when asked, and the last look is kept", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connect();
    const calls = seen.length;
    // Opening the page: nothing yet, and Veal isn't run.
    expect((await c.get("/api/ai/briefing/crm")).body).toEqual({ briefing: null, today: false });
    expect(seen.length).toBe(calls);
    expect((await c.get("/api/ai/status")).body.used).toBe(0);

    script.push(say(`{"summary": "Nothing is overdue.", "items": [{"tone": "warn", "title": "No follow-ups booked", "detail": "Book one so leads don't go cold.", "page": "/crm/follow-ups"}, {"tone": "info", "title": "Made-up page", "detail": "x", "page": "/crm/secret"}]}`));
    const look = await c.post("/api/ai/briefing/crm/refresh", {});
    expect(look.status).toBe(200);
    expect(look.body.briefing.summary).toBe("Nothing is overdue.");
    expect(look.body.briefing.items[0]).toMatchObject({ tone: "warn", link: { to: "/crm/follow-ups" } });
    // Only real pages get a button.
    expect(look.body.briefing.items[1].link).toBeUndefined();
    expect(seen.length).toBe(calls + 1);
    // Coming back shows that look, without running Veal again.
    expect((await c.get("/api/ai/briefing/crm")).body).toMatchObject({ today: true, briefing: { summary: "Nothing is overdue." } });
    expect(seen.length).toBe(calls + 1);
    expect((await c.get("/api/ai/status")).body.used).toBe(1);
    expect((await c.get("/api/ai/briefing/nowhere")).status).toBe(404);
  });

  it("works the same with Anthropic's format: tools, the model's own reply sent back unchanged, fallbacks and refusals", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connectAnthropic();
    try {
      const thinking = { type: "thinking", thinking: "", signature: "sig-123" };
      script.push(
        claude([thinking, { type: "tool_use", id: "toolu_1", name: "my_leave", input: {} }], "tool_use"),
        claude([{ type: "text", text: "You have 20 days of annual leave left." }]),
      );
      const r = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "How much leave do I have?" }] });
      expect(r.status).toBe(200);
      expect(r.body.reply).toBe("You have 20 days of annual leave left.");
      expect(r.body.links).toEqual([{ label: "Open My leave", to: "/me/leave" }]);
      const first = seen.at(-2), second = seen.at(-1);
      // Anthropic's shape: system apart, tools with input_schema, the key in its own header, fallbacks asked for.
      expect(seenReq.at(-1)!.url).toBe("/v1/messages");
      const h = seenReq.at(-1)!.headers;
      expect(`${h["x-api-key"] ?? ""} ${h.authorization ?? ""}`).toContain("test-key");
      expect(String(seenReq.at(-1)!.headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
      expect(first.fallbacks).toBe("default");
      expect(first.system).toContain("You are Veal");
      expect(first.max_tokens).toBe(16000);
      expect(first.tools.find((t: any) => t.name === "my_leave").input_schema).toBeTruthy();
      expect(first.messages).toEqual([{ role: "user", content: "How much leave do I have?" }]);
      // The model's own turn (thinking included) went back exactly as it came, then the tool's answer.
      expect(second.messages[1]).toEqual({ role: "assistant", content: [thinking, { type: "tool_use", id: "toolu_1", name: "my_leave", input: {} }] });
      expect(second.messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1" });

      // The next turn sends the saved conversation back the same way.
      script.push(claude([{ type: "text", text: "Sure." }]));
      await c.post("/api/ai/chat", { messages: [...r.body.messages, { role: "user", content: "thanks" }] });
      expect(seen.at(-1).messages[1].content[0]).toEqual(thinking);
      expect(seen.at(-1).messages.at(-1)).toEqual({ role: "user", content: "thanks" });

      // A model without fallbacks: asked again without them.
      script.push(fail(400, { type: "error", error: { type: "invalid_request_error", message: "fallbacks are not supported for this model" } }), claude([{ type: "text", text: "Hello." }]));
      const plain = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "hi" }] });
      expect(plain.body.reply).toBe("Hello.");
      expect(seen.at(-1).fallbacks).toBeUndefined();

      // A refusal reads as a polite no, not an error.
      script.push(claude([], "refusal"));
      const no = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "something it won't do" }] });
      expect(no.body.reply).toBe("Sorry, I can't help with that one.");

      // A wrong key reads as a settings problem, in plain words.
      script.push(fail(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
      const bad = await c.post("/api/ai/chat", { messages: [{ role: "user", content: "hi" }] });
      expect(bad.status).toBe(503);
      expect(bad.body.error.message).toContain("AI_API_KEY");
    } finally { connect(); }
  });

  it("sends only standard fields in the chat-completions format (anything else comes from AI_EXTRA_BODY)", async () => {
    const app = await getApp();
    const { c, org } = await signUpWithOrg(app);
    await growth(org.id);
    connect();
    script.push(say("Hi."));
    await c.post("/api/ai/chat", { messages: [{ role: "user", content: "hi" }] });
    expect(seen.at(-1).temperature).toBeUndefined();
    expect(seenReq.at(-1)!.url).toBe("/v1/chat/completions");
    env.aiExtraBody = { temperature: 0.2 };
    try {
      script.push(say("Hi."));
      await c.post("/api/ai/chat", { messages: [{ role: "user", content: "hi" }] });
      expect(seen.at(-1).temperature).toBe(0.2);
    } finally { env.aiExtraBody = {}; }
  });
});
