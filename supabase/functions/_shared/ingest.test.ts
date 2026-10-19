import { describe, expect, it } from 'vitest';
import { ingestRepo } from './ingest.ts';

const ref = { owner: 'Acme', repo: 'Tool' };
const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function mockFetch(routes: Record<string, Response>) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const hit = Object.keys(routes).find((k) => url.endsWith(k));
    return hit ? routes[hit].clone() : res(404, {});
  };
  return { fn, calls };
}

const meta = { default_branch: 'main', size: 100, private: false, html_url: 'https://github.com/Acme/Tool' };

describe('ingestRepo', () => {
  it('returns deterministic id, commit sha and filtered files', async () => {
    const { fn, calls } = mockFetch({
      '/repos/Acme/Tool': res(200, meta),
      '/git/trees/main?recursive=1': res(200, {
        sha: 'abc', truncated: false,
        tree: [
          { path: 'src/a.ts', type: 'blob', size: 10, sha: '1' },
          { path: 'logo.png', type: 'blob', size: 10, sha: '2' },
        ],
      }),
    });
    const r = await ingestRepo(ref, fn);
    expect(r).toMatchObject({ ok: true, repoId: 'acme/tool', commitSha: 'abc', defaultBranch: 'main' });
    if (r.ok) expect(r.files.map((f) => f.path)).toEqual(['src/a.ts']);
    expect(calls.every((u) => u.startsWith('https://api.github.com/'))).toBe(true);
  });
  it('maps 404, rate limit, private and truncated trees to typed errors', async () => {
    expect(await ingestRepo(ref, mockFetch({}).fn)).toMatchObject({ ok: false, code: 'not_found' });
    expect(await ingestRepo(ref, mockFetch({ '/repos/Acme/Tool': res(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' }) }).fn))
      .toMatchObject({ ok: false, code: 'rate_limited' });
    expect(await ingestRepo(ref, mockFetch({ '/repos/Acme/Tool': res(200, { ...meta, private: true }) }).fn))
      .toMatchObject({ ok: false, code: 'not_found' });
    const trunc = mockFetch({ '/repos/Acme/Tool': res(200, meta), '/git/trees/main?recursive=1': res(200, { sha: 'x', truncated: true, tree: [] }) });
    expect(await ingestRepo(ref, trunc.fn)).toMatchObject({ ok: false, code: 'repo_too_large' });
  });
  it('rejects oversized repos from metadata before fetching the tree', async () => {
    const { fn, calls } = mockFetch({ '/repos/Acme/Tool': res(200, { ...meta, size: 10_000_000 }) });
    expect(await ingestRepo(ref, fn)).toMatchObject({ ok: false, code: 'repo_too_large' });
    expect(calls).toHaveLength(1);
  });
  it('sends the token only as an Authorization header', async () => {
    let auth: string | undefined;
    const fn = async (_u: string, init?: { headers?: Record<string, string> }) => { auth = init?.headers?.Authorization; return res(404, {}); };
    await ingestRepo(ref, fn, 'tok');
    expect(auth).toBe('Bearer tok');
  });
});
