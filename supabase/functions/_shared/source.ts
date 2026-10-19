import { ingestRepo, type IngestResult } from './ingest.ts';
import type { TtlCache } from './limits.ts';
import { parseRepoRef } from './repoUrl.ts';

export const MAX_INLINE_CHARS = 60_000;

export type Source =
  | { ok: true; text: string; path: string; repoId: string; commitSha: string }
  | { ok: false; status: number; error: string };

type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

/**
 * Resolve the file under analysis. Either `content` (inline, for local/fixture code, no network) or
 * `repo` + `path` (public GitHub file at the current commit, only if it is in the vetted file set).
 */
export async function loadSource(
  body: { repo?: unknown; path?: unknown; content?: unknown },
  doFetch: FetchFn,
  token: string | undefined,
  cache: TtlCache<IngestResult>,
): Promise<Source> {
  const path = typeof body.path === 'string' ? body.path.slice(0, 300) : '';
  if (!path) return { ok: false, status: 400, error: 'Provide a path.' };

  if (typeof body.content === 'string') {
    if (body.content.length > MAX_INLINE_CHARS) return { ok: false, status: 413, error: 'Inline content too large.' };
    return { ok: true, text: body.content, path, repoId: 'inline', commitSha: 'inline' };
  }

  const ref = typeof body.repo === 'string' ? parseRepoRef(body.repo) : null;
  if (!ref) return { ok: false, status: 400, error: 'Provide repo as owner/repo.' };
  const ing = await ingestRepo(ref, doFetch, token, cache);
  if (!ing.ok) return { ok: false, status: ing.code === 'not_found' ? 404 : ing.code === 'rate_limited' ? 429 : 413, error: ing.message };
  if (!ing.files.some((x) => x.path === path)) return { ok: false, status: 404, error: 'File not found in the indexed set.' };
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/${ing.commitSha}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const r = await doFetch(url);
  if (!r.ok) return { ok: false, status: 502, error: 'Could not read file.' };
  return { ok: true, text: await r.text(), path, repoId: ing.repoId, commitSha: ing.commitSha };
}
