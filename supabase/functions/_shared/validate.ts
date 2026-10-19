export interface RepoData {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  license: { name: string } | null;
  updated_at: string;
}

export interface ProfileData {
  user: { login: string; name: string | null; bio: string | null; public_repos: number; followers: number };
  repositories: { name: string; description: string | null; language: string | null; stargazers_count: number }[];
}

export type SummarizeBody =
  | { type: 'repo-summary'; repoData: RepoData }
  | { type: 'profile-summary'; profileData: ProfileData };

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.slice(0, max) : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function repoData(v: unknown): RepoData | null {
  if (!isObj(v)) return null;
  const name = str(v.name, 100);
  if (!name) return null;
  const license = isObj(v.license) ? str(v.license.name, 100) : null;
  return {
    name,
    description: str(v.description, 500),
    language: str(v.language, 50),
    stargazers_count: num(v.stargazers_count),
    forks_count: num(v.forks_count),
    topics: Array.isArray(v.topics) ? v.topics.slice(0, 20).map((t) => str(t, 50)).filter((t): t is string => !!t) : [],
    license: license ? { name: license } : null,
    updated_at: str(v.updated_at, 40) ?? '',
  };
}

/** Validate and bound the body of the summarize-repo function. */
export function validateSummarizeBody(body: unknown): Validated<SummarizeBody> {
  if (!isObj(body)) return { ok: false, error: 'Invalid request body' };
  if (body.type === 'repo-summary') {
    const r = repoData(body.repoData);
    return r ? { ok: true, value: { type: 'repo-summary', repoData: r } } : { ok: false, error: 'Invalid repoData' };
  }
  if (body.type === 'profile-summary') {
    const p = body.profileData;
    if (!isObj(p) || !isObj(p.user) || !Array.isArray(p.repositories)) return { ok: false, error: 'Invalid profileData' };
    const login = str(p.user.login, 39);
    if (!login) return { ok: false, error: 'Invalid profileData' };
    const repositories = p.repositories
      .slice(0, 20)
      .filter(isObj)
      .map((r) => ({
        name: str(r.name, 100) ?? '',
        description: str(r.description, 200),
        language: str(r.language, 50),
        stargazers_count: num(r.stargazers_count),
      }))
      .filter((r) => r.name);
    return {
      ok: true,
      value: {
        type: 'profile-summary',
        profileData: {
          user: {
            login,
            name: str(p.user.name, 100),
            bio: str(p.user.bio, 300),
            public_repos: num(p.user.public_repos),
            followers: num(p.user.followers),
          },
          repositories,
        },
      },
    };
  }
  return { ok: false, error: 'Invalid request type' };
}

/** CORS headers; Allow-Origin is set only for allowlisted origins. */
export function corsHeadersFor(origin: string | null, allowed: string[]): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
