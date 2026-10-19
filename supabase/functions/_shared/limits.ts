// Best-effort, per-isolate protections. Edge isolates are ephemeral, so these reduce abuse and
// GitHub/Groq quota burn but are NOT a global guarantee (see docs/PROJECT_PLAN.md risks).

const hits = new Map<string, number[]>();

/** True when `key` exceeded `max` calls within `windowMs`. */
export function rateLimited(key: string, max = 20, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear(); // bound memory
  return recent.length > max;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

/** Tiny TTL cache for upstream GitHub results. */
export class TtlCache<T> {
  private m = new Map<string, { v: T; exp: number }>();
  constructor(private ttlMs: number, private max = 100) {}
  get(k: string, now = Date.now()): T | undefined {
    const e = this.m.get(k);
    if (!e || e.exp < now) { this.m.delete(k); return undefined; }
    return e.v;
  }
  set(k: string, v: T, now = Date.now()) {
    if (this.m.size >= this.max) this.m.clear();
    this.m.set(k, { v, exp: now + this.ttlMs });
  }
}

export type GlobalCfg = { url?: string; key?: string };
export type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Response>;

/**
 * True when `ip` should be rejected. Layer 1: per-isolate counter (free, instant). Layer 2: shared Postgres counter
 * (rl_hit RPC via the service role) so limits hold across isolates. If the DB is unreachable or unconfigured we fail
 * OPEN to layer 1 only (availability over strictness) and `onError` is called so it can be logged.
 */
export async function overLimit(
  ip: string, cfg: GlobalCfg, doFetch: Fetcher = fetch, max = 20, windowSec = 60, onError: (m: string) => void = () => {},
): Promise<boolean> {
  if (rateLimited(ip, max, windowSec * 1000)) return true;
  if (!cfg.url || !cfg.key) return false;
  try {
    const r = await doFetch(`${cfg.url}/rest/v1/rpc/rl_hit`, {
      method: 'POST',
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: ip, p_window_sec: windowSec, p_max: max }),
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) { onError(`rl_hit http ${r.status}`); return false; }
    return (await r.json()) === true;
  } catch {
    onError('rl_hit unreachable');
    return false;
  }
}
