# RepoPilot

AI codebase-intelligence assistant for **public GitHub repositories**. It retrieves real source, answers questions with
line-level citations that are verified against the retrieved code, flags likely bugs (clearly labeling what is a pattern
match versus an unverified model hypothesis), proposes minimal patches as reviewable diffs, and verifies patches only inside
an isolated local Docker sandbox. It never applies, commits or pushes anything on its own.

It evolved from GitHub Profile Explorer; the original profile explorer is still at `/`, RepoPilot is at `/import`.

## Architecture
```
React + Vite UI --supabase-js--> Supabase Edge Functions (Deno, JWT-verified, CORS allowlist, input caps, rate limit)
  repo-ingest   GitHub tree -> filtered file list (no code executed)
  repo-query    path ranking + raw fetch at pinned commit + line-exact chunks + keyword scoring (+ Groq answer, citations verified)
  repo-analyze  5 static rules + optional Groq hypotheses (validated to real lines)
  repo-patch    Groq proposes a line-range edit; server validates it and renders a diff
  repo-overview languages, entry points, dependencies, file tree, optional grounded architecture summary
  summarize-repo  (original) profile/repo summary
scripts/verify-patch.mjs  local Docker: install --ignore-scripts, tests --network none, baseline vs patched
scripts/eval.mjs          live benchmark -> docs/EVAL.md
```
Pure logic lives in `supabase/functions/_shared/` and is unit-tested with Vitest.

## Setup
Requirements: Node 20+, a free Supabase project, a free Groq API key, Docker (only for patch verification).
```bash
npm install
cp .env.example .env        # fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npx supabase login
npx supabase secrets set GROQ_API_KEY=... ALLOWED_ORIGINS=http://localhost:8080 --project-ref <ref>
# optional, raises GitHub quota from 60/h: npx supabase secrets set GITHUB_TOKEN=<read-only token> --project-ref <ref>
npx supabase db push --project-ref <ref>   # global rate-limit table (see docs/DEPLOY.md)
for f in summarize-repo repo-ingest repo-query repo-analyze repo-patch repo-overview; do npx supabase functions deploy $f --project-ref <ref>; done
npm run dev                 # http://localhost:8080
```
Notes: `.npmrc` sets `legacy-peer-deps=true` (needed for the Vite 6 / plugin peer ranges) and `@swc/core` is pinned to 1.13.5 (newer versions fail to load on some Windows machines).
Secrets live only in Supabase secrets; the browser gets only the Supabase URL and publishable key. Set `ALLOWED_ORIGINS`
to your production origin(s) (comma-separated) before deploying a frontend.

## Commands
`npm test` - unit tests - `npm run lint` - `npm run build` - `node scripts/eval.mjs` - `node scripts/verify-patch.mjs <owner/repo> <sha> patch.json "npm test"`

## Limits and honesty
- Public repos only; max 3000 files, 200 KB/file, 20 MB total; Node projects only for patch verification.
- Findings from the model are hypotheses, never confirmed bugs. A patch is "verified" only when the sandbox run says so.
- Free-tier limits apply (Groq, GitHub 60 req/h unauthenticated, Supabase Free pauses idle projects).
- Rate limiting and caching are per edge isolate (best effort), not global.
- See `docs/EVAL.md` for the (small) benchmark and `docs/PROGRESS.md` for known issues.

## Docs
`CLAUDE.md`, `docs/PROJECT_PLAN.md`, `DECISIONS.md`, `PROGRESS.md`, `CHANGELOG.md`, `HANDOFF.md`, `TESTING.md`, `DEPLOY.md`, `SECURITY.md`, `EVAL.md`, `EVAL-BUGS.md`, `EVAL-REAL.md`, `EVAL-CONTEXT.md`.
