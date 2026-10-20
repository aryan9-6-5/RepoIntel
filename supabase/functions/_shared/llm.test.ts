import { describe, expect, it } from 'vitest';
import { Memo, chatError, groqChat, readQuota } from './llm.ts';

const ok = (content: string, usage?: object) => async () => new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200 });
const opts = { messages: [{ role: 'user', content: 'hi' }], maxTokens: 10 };

describe('groqChat', () => {
  it('returns text, usage and latency; sends the key only as a header', async () => {
    let seen: { headers: Record<string, string>; body: string } | undefined;
    const r = await groqChat('KEY', { ...opts, json: true, reasoningEffort: 'low' }, async (_u, init) => { seen = init; return ok('hello', { prompt_tokens: 7, completion_tokens: 3 })(); });
    expect(r).toMatchObject({ ok: true, text: 'hello', usage: { prompt: 7, completion: 3 } });
    expect(seen!.headers.Authorization).toBe('Bearer KEY');
    expect(seen!.body).not.toContain('KEY');
    expect(JSON.parse(seen!.body)).toMatchObject({ response_format: { type: 'json_object' }, reasoning_effort: 'low' });
  });
  it('classifies upstream errors without forwarding bodies', async () => {
    const r429 = await groqChat('k', opts, async () => new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'secret details' } }), { status: 429 }));
    expect(r429).toMatchObject({ ok: false, status: 429, code: 'rate_limit_exceeded' });
    expect(chatError(r429 as never)).toEqual({ status: 429, error: 'AI rate limit reached. Try again shortly.' });
    expect(chatError({ ok: false, status: 429, ms: 1, retryAfterSec: 45 })).toEqual({ status: 429, error: 'AI rate limit reached. Try again in about 45 seconds.' });
    expect(chatError({ ok: false, status: 429, ms: 1, retryAfterSec: 600 }).error).toBe('AI rate limit reached. Try again in about 10 minutes.');
    const empty = await groqChat('k', opts, ok('   '));
    expect(chatError(empty as never).error).toBe('AI returned an empty response');
    const net = await groqChat('k', opts, async () => { throw new Error('boom'); });
    expect(net).toMatchObject({ ok: false, status: 504 });
    expect(chatError(net as never)).toEqual({ status: 502, error: 'AI service error' });
  });
});

describe('readQuota', () => {
  it('parses Groq rate-limit headers (numbers and durations); undefined when absent', () => {
    const h = new Headers({ 'x-ratelimit-remaining-tokens': '2750', 'x-ratelimit-limit-tokens': '8000', 'x-ratelimit-remaining-requests': '14', 'x-ratelimit-reset-tokens': '2m59.5s' });
    expect(readQuota(h)).toEqual({ remainingTokens: 2750, limitTokens: 8000, remainingRequests: 14, resetTokensSec: 179.5 });
    expect(readQuota(new Headers())).toBeUndefined();
    expect(readQuota(new Headers({ 'x-ratelimit-reset-tokens': '7.66s' }))?.resetTokensSec).toBe(7.7);
  });
  it('is attached to failures and successes without leaking the key', async () => {
    const r = await groqChat('SECRET', opts, async () => new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }), { status: 429, headers: { 'x-ratelimit-remaining-tokens': '120', 'retry-after': '5' } }), );
    expect(r).toMatchObject({ ok: false, status: 429, quota: { remainingTokens: 120 } });
    expect(JSON.stringify(r)).not.toContain('SECRET');
  });
});

describe('strict JSON mode failure (HTTP 400 json_validate_failed)', () => {
  const bad = () => new Response(JSON.stringify({ error: { code: 'json_validate_failed' } }), { status: 400 });
  it('retries once without strict JSON mode on the same model and succeeds', async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await groqChat('k', { ...opts, json: true }, async (_u, init) => { const b = JSON.parse(init.body); bodies.push(b); return b.response_format ? bad() : ok('{"findings":[]}')(); });
    expect(bodies.map((b) => !!b.response_format)).toEqual([true, false]);
    expect(bodies[0].model).toBe(bodies[1].model);
    expect(r).toMatchObject({ ok: true, text: '{"findings":[]}', model: 'openai/gpt-oss-120b' });
  });
  it('does not retry other 400s or non-JSON calls', async () => {
    let calls = 0;
    const other = await groqChat('k', { ...opts, json: true }, async () => { calls++; return new Response(JSON.stringify({ error: { code: 'invalid_request_error' } }), { status: 400 }); });
    expect(calls).toBe(1);
    expect(other).toMatchObject({ ok: false, status: 400 });
    calls = 0;
    await groqChat('k', opts, async () => { calls++; return bad(); });
    expect(calls).toBe(1);
  });
});

describe('model fallback on 429', () => {
  const limited = () => new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }), { status: 429, headers: { 'retry-after': '30' } });
  it('retries once on the fallback model and says which model answered', async () => {
    const models: string[] = [];
    const r = await groqChat('k', opts, async (_u, init) => { const m = JSON.parse(init.body).model; models.push(m); return m === 'openai/gpt-oss-120b' ? limited() : ok('from small model')(); });
    expect(models).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(r).toMatchObject({ ok: true, text: 'from small model', model: 'openai/gpt-oss-20b', fellBack: true });
  });
  it('reports the primary 429 with retry-after when the fallback also fails; and can be disabled', async () => {
    let calls = 0;
    const r = await groqChat('k', opts, async () => { calls++; return limited(); });
    expect(calls).toBe(2);
    expect(r).toMatchObject({ ok: false, status: 429, retryAfterSec: 30 });
    calls = 0;
    await groqChat('k', { ...opts, fallbackModel: null }, async () => { calls++; return limited(); });
    expect(calls).toBe(1);
  });
  it('does not fall back on non-429 errors and uses the primary model when it works', async () => {
    let calls = 0;
    const r = await groqChat('k', opts, async () => { calls++; return ok('fine')(); });
    expect(calls).toBe(1);
    expect(r).toMatchObject({ ok: true, model: 'openai/gpt-oss-120b' });
    expect((r as { fellBack?: boolean }).fellBack).toBeUndefined();
  });
});

describe('Memo', () => {
  it('shares one in-flight computation between concurrent callers and caches successes', async () => {
    const m = new Memo<number>(1000);
    let calls = 0;
    const compute = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { value: 42, cacheable: true }; };
    const [a, b] = await Promise.all([m.get('k', compute, 0), m.get('k', compute, 0)]);
    expect(calls).toBe(1);
    expect([a.value, b.value]).toEqual([42, 42]);
    expect((await m.get('k', compute, 500)).cached).toBe(true);
    expect(calls).toBe(1);
    await m.get('k', compute, 2000); // expired
    expect(calls).toBe(2);
  });
  it('does not cache failures', async () => {
    const m = new Memo<string>(1000);
    let calls = 0;
    const bad = async () => { calls++; return { value: 'err', cacheable: false }; };
    await m.get('x', bad, 0); await m.get('x', bad, 1);
    expect(calls).toBe(2);
  });
});
