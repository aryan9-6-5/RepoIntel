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
