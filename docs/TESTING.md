# Testing

Status: Vitest installed (Phase 1).

## Tools
Vitest (+ jsdom for components) for frontend/pure logic; `deno test` for edge-function handlers;
recorded JSON fixtures for GitHub responses; Groq mocked.

## Commands (current)
```
npx tsc -p tsconfig.app.json --noEmit
npm run lint      # currently 5 errors (pre-existing, see PROGRESS.md)
npm run build
```
`npm test` (Vitest, 60 tests, mocked network). Planned: `deno test` for handlers; live smoke tests are manual.

## Critical workflows
Repo URL parsing; file filtering (binary/vendored/generated/oversize); limit enforcement; GitHub 403/404/429
handling; chunking line-number accuracy; retrieval ranking reproducibility; citation validation (every cited
path:line exists in stored content); prompt-injection fixtures (repo text saying "ignore instructions").

## Security checks
No secrets in client bundle (`grep` dist for `gsk_`, `ghp_`); request-size rejection; CORS/JWT behavior;
rate-limit behavior; error bodies contain no upstream details.

## Known-defect reproduction
Lint errors: `npm run lint`. Open Groq proxy (S1): POST to function URL without Authorization header succeeds
while `verify_jwt=false` (manual, do not run against production without approval).

## Release checks
tsc, lint, tests, build, bundle secret scan, git-history secret review, manual smoke of profile + repo flows.
Eval: node scripts\/eval.mjs (live) -> docs\/EVAL.md. Patch sandbox: scripts\/verify-patch.mjs.


## Current test inventory (2026-10-20)
Unit (`npm test`, 60 tests in 12 files, no live calls): repoUrl, fileFilter, ingest, validate, search/ranking, answer/citations, findings (+benchmark fixture, reproduction), patch, overview, imports, limits (+global limiter incl. fail-open), llm (Groq helper: usage, quota headers, 429 fallback, retry-after, cache/dedup).
Live scripts (need `.env`, Groq budget, paced under the 20 req/min limiter):
| Script | Purpose | Report |
|--------|---------|--------|
| `scripts/security-check.mjs` | 26 black-box security probes | docs/SECURITY-CHECK.md |
| `scripts/e2e-smoke.mjs` | ingest -> overview -> retrieval -> Q&A -> analyze -> patch with independent verification against GitHub; AI steps SKIP (not pass) when rate limited | docs/E2E-SMOKE.md |
| `scripts/eval.mjs` | retrieval + Q&A on two dev repos | docs/EVAL.md |
| `scripts/eval-bugs.mjs`, `eval-context.mjs` | synthetic fixtures: localization, Docker patch success, context A/B | docs/EVAL-BUGS.md, EVAL-CONTEXT.md |
| `scripts/eval-real.mjs [runs] [dataset] [report]` | real bug-fix localization | docs/EVAL-REAL.md (dev repos); EVAL-UNSEEN-BUGS.md (unseen, BLOCKED) |
| `scripts/eval-unseen-qa.mjs` | unseen retrieval + Q&A + citation checks | docs/EVAL-UNSEEN.md |
| `scripts/eval-unseen-patch.mjs` | real-fix patch verification in Docker with control run + failing-test check | docs/EVAL-UNSEEN-PATCH.md (BLOCKED) |
Offline: `node --experimental-strip-types scripts/eval-retrieval-local.mjs <queries.json> [maxFiles] [searchModule]` (no Groq, no deploy; docs/EVAL-RETRIEVAL-FIX.md).
Datasets: `scripts/build-unseen.mjs [--heldout]`, `build-real-bugs.mjs`, frozen under eval/.
Accessibility: axe-core 4.10 run in the browser pane (procedure and results in PROGRESS.md Round 3); not yet automated in CI.
Release gates: tsc, lint, npm test, npm run build, secret scan of the change set and dist/, fresh `npm ci` from a clean copy (done 2026-10-19), live security-check + e2e-smoke after any deploy.
