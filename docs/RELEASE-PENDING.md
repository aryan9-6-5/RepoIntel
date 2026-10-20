# Pending release (NOT deployed) - prepared 2026-10-20

STATUS 2026-10-21: DEPLOYED (repo-query v21, repo-analyze v12, repo-patch v9, repo-overview v6) and verified live (e2e 6/6, security 26/26); committed locally, not pushed. The 'not verified live' items below were checked after deploy; see docs/FINAL-CHECKLIST.md. Original plan text follows.

## What would be deployed
Functions (Supabase project `hftgejaodmbmuvsqspon`), exactly four, because only these import changed modules:

| Function | Changes since the live version |
|----------|--------------------------------|
| `repo-query` | candidate window 15 -> 24 files; new ranker (source prior, dot-dir/bench/changelog penalties); answer cache + in-flight de-duplication (10 min, key = commit + question); shared Groq helper (token cap 600 -> 1500, reasoning low); response adds `usage`, `aiMs`, `model`, `fellBack`, `cached`, `ms`, `quota` |
| `repo-analyze` | model returns a `reproduction` hint per finding; shared Groq helper; response adds `usage`, `aiMs`, `model`, `fellBack`, `quota` |
| `repo-patch` | shared Groq helper (fallback model, clearer 429 message with retry-after); response adds `usage`, `aiMs`, `model`, `fellBack` |
| `repo-overview` | shared Groq helper; response adds `usage`, `aiMs`, `model`, `fellBack` |

Not redeployed (unchanged inputs): `summarize-repo`, `repo-ingest`.
Database: no new migration (the rate-limit migration is already applied and verified). Secrets: none new. Frontend: there is no deployed frontend; the UI changes (`RepoImport.tsx`, `CodeViewer.tsx`: reproduction hints, "Inference" highlighting, stale-commit warning, token/latency/cache info, keyboard-focusable scroll regions, error contrast 4.02 -> 6.97) only affect local dev and the next Vercel build.

## Expected impact (with the evidence that exists)
- Retrieval: held-out unseen repos 43% -> 79% file-hit (offline, same pipeline code; docs/EVAL-RETRIEVAL-FIX.md). The dev-set 100% is in-sample and optimistic.
- Rate limiting: when `gpt-oss-120b` returns 429 the call retries once on `gpt-oss-20b` (separate budget) and the response says so; if both fail the user gets "try again in about N seconds".
- Cost control: repeated identical questions on the same commit cost 0 tokens for 10 minutes.
- Diagnostics: `quota` (Groq's remaining-token headers) is returned on failures; this will let us confirm whether the current 429s are a quota-remaining effect.

## NOT verified live (be aware)
- Q&A quality after the prompt/token-cap/effort change and answers produced by the fallback model: the free Groq budget was exhausted when testing (see docs/PROGRESS.md "Groq quota"), so only mocked unit tests (60/60) and offline retrieval covered these changes.
- Latency/CPU of fetching 24 files instead of 15 on the edge runtime (not measured; expected ~+0.3-0.6 s per retrieval-only call; the e2e script prints timings after deploy).
- The unseen bug-localization and Docker patch-verification benchmarks have no results yet (blocked by the same quota).

## Rollback
1. Functions: `git checkout cf2cc5d -- supabase/functions` (the committed state equals what is live today) then redeploy the four functions with `npx supabase functions deploy <name> --project-ref hftgejaodmbmuvsqspon`. `_shared/llm.ts` is new and is not imported by the old code.
2. DB/secrets: unchanged by this release, nothing to roll back.
3. Verify: `node scripts/security-check.mjs` and `node scripts/e2e-smoke.mjs`.

## Remaining risks
- Free-tier Groq quota (per model, per minute and per day) is the main availability limit; fallback only helps if the 20b model still has budget.
- Fallback answers come from a smaller model: possible lower quality; always labeled via `model`/`fellBack` in the response (not yet shown in the UI).
- Per-isolate cache means no cross-instance sharing; cache hit rates will be modest.
- Unused secret `GEMINI_API_KEY` exists on the project (not referenced by any code here). Owner decision: remove it if it is not needed.
- Rate limit identity is client IP (shared NAT users share a quota); fixed 60 s window allows up to 2x burst at boundaries.
