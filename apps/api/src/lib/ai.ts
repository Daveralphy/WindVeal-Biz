import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

/**
 * Veal (WindVeal AI) talks to whichever model is set in apps/api/.env. Nothing in the app names a provider:
 *
 * - AI_FORMAT=openai (the default) is the standard "chat completions" format with tools. OpenAI, xAI (Grok),
 *   Groq, Together, OpenRouter, Ollama, vLLM, llama.cpp and most self-hosted models speak it, so a model you
 *   host yourself later plugs in by changing AI_BASE_URL, AI_MODEL and AI_API_KEY.
 * - AI_FORMAT=anthropic uses Anthropic's own Messages API (Claude), through its official SDK.
 *
 * The rest of WindVeal always sees the same thing: messages in the chat-completions shape, tools, and replies
 * with text or tool calls. Until a model is set, Veal reports that it isn't connected and everything else works.
 */
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
    role: "assistant"; content: string | null; tool_calls?: ToolCall[];
    /** The reply exactly as the model sent it (Anthropic format), so it goes back unchanged on the next turn. */
    raw?: unknown[];
  }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type Completion = { content: string | null; toolCalls: ToolCall[]; raw?: unknown[] };

export const aiFormat = (): "openai" | "anthropic" =>
  env.aiFormat === "anthropic" || (!env.aiFormat && /anthropic\.com/i.test(env.aiBaseUrl)) ? "anthropic" : "openai";

/** A model is set, and somewhere to reach it (Anthropic's API needs no base URL). */
export const aiConnected = () => !!env.aiModel && (!!env.aiBaseUrl || aiFormat() === "anthropic");

export class AiUnavailable extends Error {}

export async function chatCompletion(messages: ChatMessage[], tools: ToolSpec[]): Promise<Completion> {
  if (!aiConnected()) throw new AiUnavailable("Veal isn't connected yet.");
  return aiFormat() === "anthropic" ? anthropicCompletion(messages, tools) : openAiCompletion(messages, tools);
}

// ---------------- the standard chat-completions format ----------------

async function openAiCompletion(messages: ChatMessage[], tools: ToolSpec[]): Promise<Completion> {
  let res: Response;
  try {
    res = await fetch(`${env.aiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(env.aiApiKey ? { Authorization: `Bearer ${env.aiApiKey}` } : {}) },
      // Only the standard fields; anything a provider needs extra (temperature, reasoning settings) goes in AI_EXTRA_BODY.
      body: JSON.stringify({
        model: env.aiModel, messages: messages.map(({ raw: _raw, ...m }: ChatMessage & { raw?: unknown }) => m),
        ...(tools.length ? { tools, tool_choice: "auto" } : {}), stream: false, ...env.aiExtraBody,
      }),
      signal: AbortSignal.timeout(env.aiTimeoutMs),
    });
  } catch {
    throw new AiUnavailable("Veal isn't answering right now. Try again in a moment.");
  }
  if (!res.ok) throw unavailable(res.status, await res.text().catch(() => ""));
  const body = await res.json() as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
  const m = body.choices?.[0]?.message;
  return { content: m?.content ?? null, toolCalls: (m?.tool_calls ?? []).map((t, i) => ({ ...t, id: t.id || `call_${i}`, type: "function" })) };
}

// ---------------- Anthropic's Messages API (Claude) ----------------

let client: Anthropic | null = null;
let clientKey = "";
function anthropic() {
  const key = `${env.aiApiKey}|${env.aiBaseUrl}`;
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: env.aiApiKey || undefined, baseURL: env.aiBaseUrl || undefined, timeout: env.aiTimeoutMs, maxRetries: 1 });
    clientKey = key;
  }
  return client;
}

/** The conversation in Anthropic's shape: system text apart, tool calls as tool_use, tool answers as tool_result. */
function toAnthropic(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content as string).join("\n\n");
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") { out.push({ role: "user", content: m.content }); continue; }
    if (m.role === "assistant") {
      // The model's own reply goes back exactly as it came (thinking blocks included).
      if (m.raw?.length) { out.push({ role: "assistant", content: m.raw as Anthropic.Beta.BetaContentBlockParam[] }); continue; }
      const content: Anthropic.Beta.BetaContentBlockParam[] = [
        ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
        ...(m.tool_calls ?? []).map((t) => ({ type: "tool_use" as const, id: t.id, name: t.function.name, input: parseArgs(t.function.arguments) })),
      ];
      if (content.length) out.push({ role: "assistant", content });
      continue;
    }
    if (m.role !== "tool") continue;
    // Answers to tool calls: one user turn holding every result in a row.
    const result: Anthropic.Beta.BetaToolResultBlockParam = { type: "tool_result", tool_use_id: m.tool_call_id, content: m.content };
    const last = out[out.length - 1];
    if (last?.role === "user" && Array.isArray(last.content) && last.content.every((b) => b.type === "tool_result")) last.content.push(result);
    else out.push({ role: "user", content: [result] });
  }
  return { system, messages: out };
}

function parseArgs(raw: string) { try { return JSON.parse(raw || "{}") as Record<string, unknown>; } catch { return {}; } }

async function anthropicCompletion(messages: ChatMessage[], tools: ToolSpec[]): Promise<Completion> {
  const { system, messages: msgs } = toAnthropic(messages);
  const params = {
    model: env.aiModel, max_tokens: env.aiMaxTokens, messages: msgs,
    ...(system ? { system } : {}),
    ...(tools.length ? { tools: tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters as Anthropic.Beta.BetaTool.InputSchema })) } : {}),
    ...env.aiExtraBody,
  } as Anthropic.Beta.MessageCreateParamsNonStreaming;
  // If the model declines on safety grounds, the API re-runs the request on a suitable model ("default" routing).
  // Turn off with AI_FALLBACKS=off; models without it get the request again without fallbacks.
  const withFallbacks = env.aiFallbacks && !("fallbacks" in env.aiExtraBody)
    ? { ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : params;
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await anthropic().beta.messages.create(withFallbacks);
  } catch (e) {
    if (withFallbacks !== params && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
      try { res = await anthropic().beta.messages.create(params); } catch (e2) { throw fromAnthropicError(e2); }
    } else throw fromAnthropicError(e);
  }
  if (res.stop_reason === "refusal") return { content: "Sorry, I can't help with that one.", toolCalls: [] };
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  const toolCalls: ToolCall[] = res.content.flatMap((b) => (b.type === "tool_use"
    ? [{ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }] : []));
  return { content: text || null, toolCalls, raw: res.content as unknown[] };
}

function fromAnthropicError(e: unknown): AiUnavailable {
  if (e instanceof Anthropic.APIConnectionError) return new AiUnavailable("Veal isn't answering right now. Try again in a moment.");
  if (e instanceof Anthropic.APIError) return unavailable(e.status ?? 0, e.message);
  return new AiUnavailable("Veal couldn't answer. Try again in a moment.");
}

/** A plain message for the person; the provider's own wording goes to the server log for whoever set it up. */
function unavailable(status: number, detail: string): AiUnavailable {
  if (detail) console.error(`[Veal] model answered ${status}: ${detail.slice(0, 500)}`);
  if (status === 401 || status === 403) return new AiUnavailable("Veal can't sign in to its AI service. Check AI_API_KEY in the server settings.");
  if (status === 404) return new AiUnavailable("Veal's AI model wasn't found. Check AI_MODEL in the server settings.");
  if (status === 429) return new AiUnavailable("Veal is busy right now. Try again in a minute.");
  return new AiUnavailable(`Veal couldn't answer (${status}). Try again in a moment.`);
}
