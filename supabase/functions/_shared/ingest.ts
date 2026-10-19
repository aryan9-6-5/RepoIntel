import { selectFiles, type SelectResult, type TreeEntry } from './fileFilter.ts';
import type { TtlCache } from './limits.ts';
import { repoId, type RepoRef } from './repoUrl.ts';

/** Repositories larger than this (GitHub-reported KB) are refused before the tree is fetched. */
export const MAX_REPO_KB = 200_000;

export type IngestErrorCode = 'not_found' | 'rate_limited' | 'repo_too_large' | 'too_many_files' | 'upstream_error';

export type IngestResult =
  | {
      ok: true;
      repoId: string;
      defaultBranch: string;
      commitSha: string;
      htmlUrl: string;
      files: TreeEntry[];
      skipped: SelectResult['skipped'];
      totalBytes: number;
    }
  | { ok: false; code: IngestErrorCode; message: string; resetAt?: number };

type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

const API = 'https://api.github.com';

const fail = (code: IngestErrorCode, message: string, resetAt?: number): IngestResult => ({ ok: false, code, message, resetAt });

function rateLimit(res: Response): IngestResult | null {
  if (res.status !== 403 && res.status !== 429) return null;
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  return fail('rate_limited', 'GitHub API rate limit reached. Try again later.', Number.isFinite(reset) && reset > 0 ? reset : undefined);
}

/**
 * Enumerate indexable files of a PUBLIC repository using only GitHub REST metadata.
 * Never downloads archives and never executes anything.
 */
export async function ingestRepo(ref: RepoRef, doFetch: FetchFn, token?: string, cache?: TtlCache<IngestResult>): Promise<IngestResult> {
  const hit = cache?.get(repoId(ref));
  if (hit) return hit;
  const result = await ingestUncached(ref, doFetch, token);
  if (result.ok) cache?.set(repoId(ref), result);
  return result;
}

async function ingestUncached(ref: RepoRef, doFetch: FetchFn, token?: string): Promise<IngestResult> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'RepoPilot' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = `${API}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;

  const metaRes = await doFetch(base, { headers });
  const limited = rateLimit(metaRes);
  if (limited) return limited;
  if (metaRes.status === 404) return fail('not_found', 'Repository not found or not public.');
  if (!metaRes.ok) return fail('upstream_error', 'GitHub returned an unexpected error.');
  const meta = await metaRes.json();
  if (meta.private) return fail('not_found', 'Repository not found or not public.');
  if (typeof meta.size === 'number' && meta.size > MAX_REPO_KB) return fail('repo_too_large', 'Repository exceeds the size limit.');

  const treeRes = await doFetch(`${base}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`, { headers });
  const limited2 = rateLimit(treeRes);
  if (limited2) return limited2;
  if (treeRes.status === 404 || treeRes.status === 409) return fail('not_found', 'Repository has no readable default branch (empty?).');
  if (!treeRes.ok) return fail('upstream_error', 'GitHub returned an unexpected error.');
  const tree = await treeRes.json();
  if (tree.truncated) return fail('repo_too_large', 'Repository tree is too large to enumerate.');

  const sel = selectFiles(tree.tree as TreeEntry[]);
  if (sel.error) return fail(sel.error, sel.error === 'too_many_files' ? 'Too many eligible files.' : 'Eligible files exceed the total size limit.');

  return {
    ok: true,
    repoId: repoId(ref),
    defaultBranch: meta.default_branch,
    commitSha: tree.sha,
    htmlUrl: meta.html_url,
    files: sel.files,
    skipped: sel.skipped,
    totalBytes: sel.totalBytes,
  };
}
