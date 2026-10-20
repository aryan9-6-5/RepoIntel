// One place for the Groq call: timeout, error classification, token usage and latency. No secrets are logged or returned.
export const MODEL = 'openai/gpt-oss-120b';
/** Used once when the primary model is rate limited (Groq free-tier limits are per model, so this has its own budget). */
export const FALLBACK_MODEL = 'openai/gpt-oss-20b';

export interface Usage { prompt: number; completion: number }

/** Groq free-tier budget as reported by its own rate-limit headers (non-secret). */
export interface Quota { remainingTokens?: number; limitTokens?: number; remainingRequests?: number; resetTokensSec?: number }

function parseDuration(v: string | null): number | undefined {
  // Groq sends durations like "7.66s", "2m59.56s", "1h2m3s"
  if (!v) return undefined;
  let t = 0, any = false;
  for (const m of v.matchAll(/([\d.]+)(h|ms|m|s)/g)) { any = true; const n = Number(m[1]); t += m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : m[2] === 'ms' ? n / 1000 : n; }
  return any ? Math.round(t * 10) / 10 : undefined;
}

export function readQuota(h: Headers): Quota | undefined {
  const num = (k: string) => { const v = h.get(k); return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined; };
  const q: Quota = {
    remainingTokens: num('x-ratelimit-remaining-tokens'), limitTokens: num('x-ratelimit-limit-tokens'),
    remainingRequests: num('x-ratelimit-remaining-requests'), resetTokensSec: parseDuration(h.get('x-ratelimit-reset-tokens')),
  };
  return Object.values(q).some((v) => v !== undefined) ? q : undefined;
}

export type ChatResult =
  | { ok: true; text: string; usage?: Usage; ms: number; model: string; fellBack?: boolean; quota?: Quota }
  | { ok: false; status: number; code?: string; ms: number; retryAfterSec?: number; quota?: Quota };

export interface ChatOptions {
  messages: { role: string; content: string }[];
  maxTokens: number;
  temperature?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  json?: boolean;
  timeoutMs?: number;
  /** model to retry once on HTTP 429; pass null to disable */
  fallbackModel?: string | null;
}

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Response>;

async function attempt(key: string, o: ChatOptions, model: string, doFetch: Fetcher): Promise<ChatResult> {
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    model, messages: o.messages, temperature: o.temperature ?? 0.2, max_tokens: o.maxTokens,
  };
  if (o.reasoningEffort) body.reasoning_effort = o.reasoningEffort;
  if (o.json) body.response_format = { type: 'json_object' };
  try {
    const r = await doFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(o.timeoutMs ?? 25_000),
    });
    const ms = Date.now() - t0;
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      const ra = Number(r.headers.get('retry-after'));
      return { ok: false, status: r.status, code: typeof e?.error?.code === 'string' ? e.error.code : undefined, ms, retryAfterSec: Number.isFinite(ra) && ra > 0 ? Math.ceil(ra) : undefined, quota: readQuota(r.headers) };
    }
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return { ok: false, status: 502, code: 'empty_response', ms };
    const u = j.usage;
    return { ok: true, text, ms, model, quota: readQuota(r.headers), usage: u && Number.isFinite(u.prompt_tokens) ? { prompt: u.prompt_tokens, completion: u.completion_tokens ?? 0 } : undefined };
  } catch {
    return { ok: false, status: 504, code: 'timeout_or_network', ms: Date.now() - t0 };
  }
}

/** One Groq call; on HTTP 429 retries once on the fallback model (separate free-tier budget) and reports which model answered. */
export async function groqChat(key: string, o: ChatOptions, doFetch: Fetcher = fetch): Promise<ChatResult> {
  let first = await attempt(key, o, MODEL, doFetch);
  // Strict JSON mode answers HTTP 400 `json_validate_failed` when the model's output is not valid JSON. Retry once in plain
  // mode on the same model; callers already extract the JSON object leniently and validate its fields.
  if (!first.ok && first.status === 400 && first.code === 'json_validate_failed' && o.json) first = await attempt(key, { ...o, json: false }, MODEL, doFetch);
  const fb = o.fallbackModel === undefined ? FALLBACK_MODEL : o.fallbackModel;
  if (first.ok || first.status !== 429 || !fb) return first;
  const second = await attempt(key, o, fb, doFetch);
  if (second.ok) return { ...second, fellBack: true };
  return { ...first, ms: first.ms + second.ms }; // report the primary's 429 (and its retry-after) if both fail
}

/** HTTP status + message to return to the client for a failed chat call (never forwards upstream bodies). */
export function chatError(r: Extract<ChatResult, { ok: false }>): { status: number; error: string } {
  if (r.status === 429) return { status: 429, error: r.retryAfterSec && r.retryAfterSec <= 3600 ? `AI rate limit reached. Try again in about ${r.retryAfterSec < 90 ? `${r.retryAfterSec} seconds` : `${Math.ceil(r.retryAfterSec / 60)} minutes`}.` : 'AI rate limit reached. Try again shortly.' };
  if (r.code === 'empty_response') return { status: 502, error: 'AI returned an empty response' };
  return { status: 502, error: 'AI service error' };
}

/**
 * Cache + in-flight de-duplication: identical concurrent requests share one upstream call; successful results are
 * cached for `ttlMs`. `compute` returns `{ value, cacheable }`.
 */
export class Memo<T> {
  private done = new Map<string, { v: T; exp: number }>();
  private flying = new Map<string, Promise<{ value: T; cacheable: boolean }>>();
  constructor(private ttlMs: number, private max = 200) {}
  async get(key: string, compute: () => Promise<{ value: T; cacheable: boolean }>, now = Date.now()): Promise<{ value: T; cached: boolean }> {
    const hit = this.done.get(key);
    if (hit && hit.exp > now) return { value: hit.v, cached: true };
    let p = this.flying.get(key);
    const shared = !!p;
    if (!p) {
      p = compute().finally(() => this.flying.delete(key));
      this.flying.set(key, p);
    }
    const r = await p;
    if (!shared && r.cacheable) {
      if (this.done.size >= this.max) this.done.clear();
      this.done.set(key, { v: r.value, exp: now + this.ttlMs });
    }
    return { value: r.value, cached: shared };
  }
}
