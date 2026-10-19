export interface RepoRef {
  owner: string;
  repo: string;
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

/** Parse "owner/repo" or a github.com URL. Returns null for anything else. */
export function parseRepoRef(input: string): RepoRef | null {
  let s = (input ?? '').trim();
  if (!s || s.length > 300 || /\s/.test(s)) return null;

  const url = s.match(/^(?:https:\/\/)?(?:www\.)?github\.com\/(.+)$/i);
  if (url) s = url[1];
  else if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.split('/')[0].includes('.')) return null;

  const [owner, rawRepo] = s.split('/');
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..') return null;
  return { owner, repo };
}

/** Deterministic, case-insensitive identity. */
export function repoId(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`.toLowerCase();
}
