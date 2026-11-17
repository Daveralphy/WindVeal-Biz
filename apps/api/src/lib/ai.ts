import { env } from "../env";

/**
 * Veal (WindVeal AI) talks to whichever model is set in apps/api/.env, through the standard "chat completions"
 * format with tools. OpenAI, xAI (Grok), Groq, DeepSeek, OpenRouter, Together, Ollama, vLLM and most self-hosted
 * models speak it, so changing model (or moving to your own later) means changing AI_BASE_URL, AI_MODEL and
 * AI_API_KEY, never the code. Until a model is set, Veal reports that it isn't connected and everything else works.
 */
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type Completion = { content: string | null; toolCalls: ToolCall[] };

/** A model is set, and where to reach it. */
export const aiConnected = () => !!env.aiBaseUrl && !!env.aiModel;

export class AiUnavailable extends Error {}

export async function chatCompletion(messages: ChatMessage[], tools: ToolSpec[]): Promise<Completion> {
  if (!aiConnected()) throw new AiUnavailable("Veal isn't connected yet.");
  let res: Response;
  try {
    res = await fetch(`${env.aiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(env.aiApiKey ? { Authorization: `Bearer ${env.aiApiKey}` } : {}) },
      // Only the standard fields; anything a provider needs extra (temperature, reasoning settings) goes in AI_EXTRA_BODY.
      body: JSON.stringify({
        model: env.aiModel, messages,
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

/** A plain message for the person; the provider's own wording goes to the server log for whoever set it up. */
function unavailable(status: number, detail: string): AiUnavailable {
  if (detail) console.error(`[Veal] model answered ${status}: ${detail.slice(0, 500)}`);
  if (status === 401 || status === 403) return new AiUnavailable("Veal can't sign in to its AI service. Check AI_API_KEY in the server settings.");
  if (status === 404) return new AiUnavailable("Veal's AI model wasn't found. Check AI_MODEL in the server settings.");
  if (status === 429) return new AiUnavailable("Veal is busy right now. Try again in a minute.");
  return new AiUnavailable(`Veal couldn't answer (${status}). Try again in a moment.`);
}
