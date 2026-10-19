import { describe, expect, it } from 'vitest';
import { TtlCache, rateLimited } from './limits.ts';

describe('rateLimited', () => {
  it('blocks after max calls in the window and recovers after it', () => {
    const k = 'ip-test';
    for (let i = 0; i < 3; i++) expect(rateLimited(k, 3, 1000, 1000 + i)).toBe(false);
    expect(rateLimited(k, 3, 1000, 1010)).toBe(true);
    expect(rateLimited(k, 3, 1000, 5000)).toBe(false);
  });
});

describe('TtlCache', () => {
  it('expires entries', () => {
    const c = new TtlCache<number>(100);
    c.set('a', 1, 0);
    expect(c.get('a', 50)).toBe(1);
    expect(c.get('a', 150)).toBeUndefined();
  });
});

import { overLimit } from './limits.ts';

describe('overLimit (global)', () => {
  const cfg = { url: 'https://x.supabase.co', key: 'srv' };
  const ok = (v: unknown) => async () => new Response(JSON.stringify(v), { status: 200 });

  it('rejects when the shared counter says over, allows when under', async () => {
    expect(await overLimit('g1', cfg, ok(true))).toBe(true);
    expect(await overLimit('g2', cfg, ok(false))).toBe(false);
  });
  it('fails open (and reports) when the DB errors or is unreachable', async () => {
    const errs: string[] = [];
    expect(await overLimit('g3', cfg, async () => new Response('x', { status: 500 }), 20, 60, (m) => errs.push(m))).toBe(false);
    expect(await overLimit('g4', cfg, async () => { throw new Error('down'); }, 20, 60, (m) => errs.push(m))).toBe(false);
    expect(errs).toEqual(['rl_hit http 500', 'rl_hit unreachable']);
  });
  it('skips the DB when unconfigured and still enforces the local limit', async () => {
    let calls = 0;
    const f = async () => { calls++; return new Response('false'); };
    for (let i = 0; i < 3; i++) expect(await overLimit('g5', {}, f, 3, 60)).toBe(false);
    expect(await overLimit('g5', {}, f, 3, 60)).toBe(true);
    expect(calls).toBe(0);
  });
  it('sends the key only in headers, never in the body', async () => {
    let seen: { headers: Record<string, string>; body: string } | undefined;
    await overLimit('g6', cfg, async (_u, init) => { seen = init; return new Response('false'); });
    expect(seen!.headers.apikey).toBe('srv');
    expect(seen!.body).not.toContain('srv');
  });
});
