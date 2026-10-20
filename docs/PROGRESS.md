# Progress

Last updated: 2026-10-19

**Overall:** All roadmap phases implemented to a working, live-verified baseline. Open items are listed honestly below.
**Next concrete action:** user review; commit/push on approval; then the open items (see HANDOFF.md).

| Phase | Status |
|-------|--------|
| 0 Audit & foundation | COMPLETE |
| 1 Hardening + ingestion | COMPLETE (deployed, live-verified) |
| 2 Retrieval | PARTIALLY COMPLETE (no entry-point/dependency detection) |
| 3 Grounded explorer | PARTIALLY COMPLETE (Q&A + citation verification done; no directory tree/file viewer/architecture summary) |
| 4 Bug findings | PARTIALLY COMPLETE (5 static rules + labeled hypotheses; toy benchmark) |
| 5 Patch + safe verification | PARTIALLY COMPLETE (diff + Docker verify + UI; no failing->passing demo) |
| 6 Evaluation & cost control | PARTIALLY COMPLETE (docs/EVAL.md real numbers; cache + per-isolate rate limit; no token tracking) |
| 7 Production readiness | PARTIALLY COMPLETE (README, .env.example, secrets scan, lint clean; no a11y audit, no production deploy) |

## Verified (actually run 2026-10-19)
- `tsc` PASS; lint 0 errors / 8 warnings (shadcn fast-refresh); `npm test` 30/30; `npm run build` PASS; dist has no `gsk_`/`ghp_`/`service_role`
- Live: no-auth -> 401; bad Origin -> no CORS header; ingest/query/analyze/patch work on aryan9-6-5/RepoIntel; Q&A grounded with verified citations; docs/EVAL.md: retrieval 6/6, Q&A behaviour 3/3, 0 invalid citations, median 1171 ms
- Docker verification e2e (tsc as the check): baseline PASS, patched PASS -> "no-regression (fix not demonstrated)", 40 s
- Git history scan: no secret patterns. `.env` (publishable VITE_* values only) remains in the FIRST commit's history; untracked since; no history rewrite (not needed for publishable keys)

## Not verified
- Browser run of `/import` UI (analyze -> propose fix -> copy command flow compiles, not clicked through)
- A fix turning a failing test green; non-Node repos; LLM hypothesis precision; patch success rate
- Production deployment (none exists); accessibility audit; concurrency/failure-recovery tests

## Known issues
- `npm audit`: 10 in production tree (5 moderate, 5 high) after `npm audit fix`; the rest need breaking upgrades (vite, react-router, tailwind chain). vitest->tinypool critical is dev-only. Plan: upgrade vite 6+/vitest 4 together
- Rate limit and cache are per edge isolate only; no DB-backed global limit
- Model `llama-3.3-70b-versatile` unavailable to this key; using `openai/gpt-oss-120b` (ADR-008); availability may change again
- RepoDetailModal still calls Groq on every open (quota waste)
- Supabase Free project pauses when idle (paused once; user restored it)
- 606 kB JS chunk

## Git
`main` pushed to origin (aryan9-6-5/RepoIntel) at 6a24ee8. Work since then is uncommitted (user asked not to commit). User's own `vite.config.ts` and `hello.txt` untouched.

## Manual setup
Supabase secrets: `GROQ_API_KEY` (set), `ALLOWED_ORIGINS` (localhost only for now; add the production origin before deploying a frontend), optional `GITHUB_TOKEN`.

## Milestones 1-2 (2026-10-19, browser-verified at http://localhost:8080/import)
M1 browser results: invalid input -> inline error PASS; import real repo PASS (84 files); nonexistent repo -> "Repository not found or not public." PASS; network failure -> generic error, form re-enabled PASS; Q&A PASS; analyze PASS; propose fix PASS (diff shown, "unverified, nothing applied").
Bugs found and fixed by testing: (a) Q&A citations pointed at wrong lines because the prompt had no line numbers -> prompt now numbers lines; (b) analyze hid a Groq 429/unparseable-JSON behind "No findings" -> UI now discloses AI status, JSON-object response format + reasoning_effort medium (3/3 later runs OK); (c) one proposed patch (removing the OPTIONS handler in summarize-repo) was WRONG -> shows why patches stay "unverified" until sandboxed.
M2 delivered: `repo-overview` function (deterministic languages/dirs/entry points/config + package.json/requirements.txt/go.mod dependencies + optional grounded architecture summary), `_shared/overview.ts` (34 tests total, all pass), FileTree, CodeViewer (raw file at pinned commit, plain-text rendering, highlight range), clickable citations/findings/entry points. Browser-verified: tree renders, viewer line numbers 40/40 match source, citation click highlights 9-13, architecture summary shows "Citations verified" (4 valid, 0 invalid via curl).
Not browser-tested: very large files (render capped at 3000 lines), keyboard navigation of the tree, mobile layout.

## Milestones 3-4 + final state (2026-10-19)
M3 evaluation (all measured live; see docs/EVAL.md and docs/EVAL-BUGS.md):
- Retrieval hit@8: 12/12 on 2 repos (RepoIntel, expressjs/express). Honest history: first run 10/12; failures were real ranking flaws (test files and the huge History.md changelog outranked source). Fixed with prefix matching, test/changelog deprioritization, sublinear term scoring. These fixes were tuned on this benchmark, so 12/12 is optimistic; expect lower on unseen repos.
- Q&A behaviour: 5/6 to 6/6 across runs (the miss = model sometimes omits citations, UI then says "No verified citations"; separate 429s from the free Groq tier). 0 invalid citations observed.
- Bug benchmark (6 synthetic fixtures, 2 runs): localization 8/8, finding precision 14/16 (88%), 0 false positives on the clean control, static rules 8 TP / 0 FP / 0 FN, patch success 6/8 (75%) = failing tests -> passing in the Docker sandbox for sum-range, clamp, average (both runs). slugify failed both runs (patch did not satisfy the tests: the sandbox correctly reported `still-failing`). This satisfies the "at least one reproducible failing->green case": `node scripts/eval-bugs.mjs` (or `node scripts/verify-patch.mjs --local eval/fixtures/sum-range <patch.json>`).
- Caveats: synthetic single-function bugs authored by us; one file visible to the model; non-deterministic; NOT evidence for real repositories.
M4: docs/SECURITY.md. Upgraded to Vite 6.4 / Vitest 4.1 (npm audit 16 -> 11 total, 10 -> 2 in production tree; all remaining are build-time tooling except react-router open-redirect (not reachable: static links only; fix = breaking v7)). `@swc/core` pinned to 1.13.5 (newer one fails to load on this Windows machine: DACL cache check). Rate limiting remains per isolate (cannot be made global without a DB table; documented).

## Final verification (run just before this note)
tsc PASS; lint 0 errors/10 warnings; 37/37 tests; build PASS; dist has no secret patterns; git history has no real tokens; fixture fake key replaced to avoid push-protection false positives.
Browser-verified: import, error states, Q&A, analyze, propose fix, tree, viewer (40/40 lines match), citation highlight, architecture summary. Not browser-tested: mobile layout, tree keyboard navigation, very large files, bundle size (606 kB chunk).

## Still open
Directory-level architecture is summary-only (reads README/manifest/<=3 entry files); non-Node patch verification; global rate limit; react-router v7 migration; Tailwind major upgrade; single-file analysis only (no cross-file/call-graph); production deploy + accessibility audit not done.

## Round 2, M1: real-repo benchmark (2026-10-19) - DONE
`scripts/build-real-bugs.mjs` (collects real fix commits via `gh`, read-only) -> frozen `eval/real-bugs.json` (20 collected; 12 excluded by a rule fixed BEFORE running: config/lint/typo/doc/build paths or messages) -> `scripts/eval-real.mjs` -> `docs/EVAL-REAL.md`.
Measured (8 real fixes, 4 repos, 2 runs): localization 13/16 (81%), finding precision 17/60 (28%), 3.8 findings/file, AI step failures 0/16. Run 1 localized 5/8, run 2 8/8 -> the model is non-deterministic; one run is not trustworthy.
Risks: n=8; possible training contamination on popular repos; "near the fix" != understood the bug; low precision means users see ~3 noisy findings per true one; patch success on real repos NOT measured.
Ideas if reliability must go up: run analysis twice and keep only findings both runs agree on (costs 2x Groq quota), or ask the model for confidence and filter.

## Round 2, M2: global rate limit (2026-10-19) - CODE DONE, NOT DEPLOYED (needs approval)
Added `supabase/migrations/20261019000000_rate_limits.sql` (table `rate_limits` with RLS and no policies; `rl_hit()` atomic fixed-window counter, service-role only, self-cleaning; reversible via drop) and `overLimit()` in `_shared/limits.ts` (layer 1 per-isolate, layer 2 shared Postgres via PostgREST RPC with 1.5 s timeout; FAILS OPEN to layer 1 if DB errors, logged). All 6 functions use it (summarize-repo's private copy removed). 5 new tests (rejects when over, fails open on 500/unreachable, no-DB path enforces local limit, key only in headers). Total 42/42.
NOT DONE until approved: `supabase db push` (production schema change) and redeploy of 6 functions. Until then production still uses per-isolate limiting only.
Risks: fixed window allows 2x burst at boundaries; key = client IP (x-forwarded-for, spoofable if the gateway does not overwrite it); fail-open means a DB outage removes the global layer; one extra ~10-50 ms DB call per request; counts consume Supabase free-tier DB writes (small).

## Round 2, M3: mobile + accessibility (2026-10-19) - DONE, measured in the browser at 375x812
Before: horizontal overflow none; 198 controls < 24 px tall (WCAG 2.2 SC 2.5.8); tree used static `aria-expanded` roles (wrong after toggling); no visible focus style.
Changes: FileTree rewritten with native details/summary + buttons (no ARIA roles to get wrong), `aria-current` on the open file, rows min 40 px on touch / 28 px desktop, decorative icons `aria-hidden`, `focus-visible` outlines on links/buttons; overview now picks the project's root manifest (fixtures no longer shadow it; test added).
After: overflow none, targets under 24 px: 0 of 202, 6/6 distinct text/background colour pairs >= 4.5:1, open file marked `aria-current`, viewer 40/40 lines.
Not verified: real screen-reader run, true keyboard Tab traversal (the automation pane did not give the page keyboard focus; we verified buttons are natively focusable, tabIndex 0, and the focus-visible CSS rule exists), tablet layout, zoom 200%, prefers-reduced-motion.

## Round 2, M4: multi-file analysis (2026-10-19) - DONE, opt-in, benefit NOT proven
Built `_shared/imports.ts` (resolve relative JS/TS and Python imports against the repo file list, normalize paths, never escape root; 5 tests) and `repo-analyze` `context` option: repo mode auto-resolves up to 3 imported files (first 120 lines each, read only from the vetted tree); inline mode accepts `context:[{path,content}]`. Findings are still validated against the TARGET file's lines only. Live smoke: repo mode resolved the 3 real imports of `_shared/source.ts`.
A/B (`node scripts/eval-context.mjs`, docs/EVAL-CONTEXT.md; 4 synthetic cross-file bugs x 4 runs, localization +-1 line): without context 15/16 (94%, precision 94%), with context 16/16 (100%, precision 96%). Difference is one run = within noise. An earlier easier pair showed context LOWERING precision (73% vs 100%). Conclusion: no demonstrated gain, extra prompt tokens against free Groq quota -> default is OFF (`context: true` to enable). Real-repo effect unmeasured (the real-bug dataset is single-file by construction).
Risks: only one-hop, relative imports (no package/alias/tsconfig-path resolution, no call graph); extra Groq tokens when enabled.

## Round 2, M5: production readiness (partial, 2026-10-19)
Done + measured: route-level code splitting (single 676 kB chunk -> entry 335 kB + Supabase client 230 kB + routes 98/14 kB; the >500 kB build warning is gone); `vercel.json` (SPA rewrite so `/import` survives refresh, CSP, nosniff, HSTS, Referrer-Policy, Permissions-Policy, frame-ancestors none); CSP tested by serving `dist/` with exactly those headers on an allowed origin: `/import` (import, open file, Q&A) and `/` (GitHub API, avatars, repo list) ran with 0 CSP violations and no console errors; `docs/DEPLOY.md` (secrets, migration, deploy order, rollback, free-tier limits, checklist).
Reproducibility (measured): a clean copy of the working tree (git-tracked + untracked, no node_modules, no .env) -> `npm ci` exit 0 -> tsc PASS, 47/47 tests, lint 0 errors, build PASS. First attempt FAILED (lockfile out of sync from the earlier `--legacy-peer-deps` install); fixed with committed `.npmrc` (`legacy-peer-deps=true`), regenerated lockfile, `@swc/core` pinned exactly to 1.13.5 (a caret range would let a fresh install pull 1.16.x, which fails to load on this Windows machine). README updated (6 functions, migration step, .npmrc note).
M5 still open: production deploy of a frontend (needs user's Vercel action + ALLOWED_ORIGINS), applying the rate-limit migration, redeploying repo-ingest/repo-query/repo-patch/summarize-repo (they contain the new limiter code but production still runs the old version), real keyboard/screen-reader testing, tablet and 200% zoom, a load/concurrency test.

## Pending user approvals (Round 2)
1. `npx supabase db push --project-ref hftgejaodmbmuvsqspon` (adds rate_limits table + rl_hit function; rollback SQL in DEPLOY.md)
2. Redeploy summarize-repo, repo-ingest, repo-query, repo-patch (repo-analyze and repo-overview already redeployed)
3. Commit (user asked not to commit)

## Round 2 deploy status (2026-10-19)
All 6 functions are now deployed with the global-limiter code (no-auth -> 401 on all six; authenticated repo-ingest call OK). The limiter currently runs in fail-open mode: the `rate_limits` table does NOT exist yet.
`supabase db push` FAILED: CLI 2.65.7 could not create its temporary login role (`42501 permission denied to alter role cli_login_postgres`), a platform/CLI incompatibility, not a migration error. Nothing was changed in the database. Options: (a) owner pastes `supabase/migrations/20261019000000_rate_limits.sql` into the Supabase dashboard SQL editor, or (b) upgrade the CLI (`npx supabase@latest db push`) with approval. After either, verify live: fire >20 requests/min from one IP across fresh isolates and expect HTTP 429 plus rows in `rate_limits`.
(Superseded by the verification below: migration applied and verified.)

## Global rate limiter: applied and verified live (2026-10-19, ~20:00-20:08 UTC)
Applied via the Supabase connector (`apply_migration`, name `rate_limits`, the exact SQL of `supabase/migrations/20261019000000_rate_limits.sql`) after `supabase db push` failed on the CLI login-role error. Note: the connector records its own migration version/name, so a future `supabase db push` may see the local file as unapplied; the SQL is idempotent (`if not exists` / `create or replace`), so re-applying is harmless.
Test conditions: Free-plan project hftgejaodmbmuvsqspon; one client IP (this machine); limit 20 requests / 60 s fixed window per IP; bursts started at a window boundary; `repo-ingest` (+1 call to `repo-overview`); anon/publishable key; curl.
Results (all measured):
- Permissions: anon and authenticated cannot execute `rl_hit`, service_role can; RLS on with 0 policies; REST call of `rl_hit` as anon -> 401; REST read of `rate_limits` as anon -> `[]`.
- Sequential burst of 26 aligned to a window: requests 1-20 -> 200, requests 21-26 -> 429. A `repo-overview` call in the same window -> 429 (limit is shared across functions per IP). DB count for that window: 27 (26 + the overview call).
- Concurrent burst of 60 (30 parallel) aligned to a window: exactly 20 x 200 and 40 x 429; a follow-up in the same window -> 429; DB count 61 = every request was counted exactly once -> the counter is atomic.
- Reset: first request of the next window -> 200 and a new row with count 1.
- Boundary effect (documented trade-off, observed): an unaligned burst of 30 split 19 + 11 across two windows and all returned 200.
- Logs (`function_logs`, 19:30-20:08 UTC): every `rl_hit` message is `rl_hit http 404` (fail-open working before the table existed), last at 19:57:18. Zero `rl_hit` errors from 20:02 onward (all test traffic).
Remaining limitations (not tested or inherent): single IP only (multi-IP and `x-forwarded-for` spoofing untested; trust depends on the gateway overwriting the header); fixed window allows up to 2x the limit across a boundary; rejected requests still increment the counter (one row per IP per window, so storage is tiny, but a flooder keeps the counter high); fail-open on a DB outage is unit-tested but was not provoked live; added DB latency per request was not measured; the limit identifies clients by IP only (shared NAT users share a quota); this does not protect the shared Groq/GitHub upstream quotas from many different IPs.

## Round 3 (2026-10-20): unseen-repo benchmarks, audits, e2e - evidence
DEV vs BENCHMARK kept separate. "DEV" = data I looked at while fixing; "BENCH" = data not used for tuning.

Retrieval (auto-labeled queries from each repo's own functions; scripts/build-unseen.mjs, docs/EVAL-UNSEEN.md, docs/EVAL-RETRIEVAL-FIX.md)
- LIVE, deployed code, 6 unseen repos, 20 queries (first look, before any fix): file hit 13/20 (65%), line hit 11/20 (55%); doc-comment queries 3/9, identifier queries 10/11; Python repo itsdangerous 1/6. Q&A (conditional on retrieval hit): 6/12 grounded, 4/12 cited the right place, 0 invalid citations, 4 API failures (429).
- Root cause: with no path-word match the ranker filled the 15 slots with CI/config/README and never read the source files. Fix (local, not deployed): source-file prior, dot-dir/bench penalties, window 15 -> 24.
- OFFLINE (same pipeline code, harness reproduces the live number exactly): DEV set 65% -> 95% (15 files) -> 100% (24 files) = IN-SAMPLE, optimistic. BENCH (held-out: 4 repos never used, 14 queries, different seed): 43% -> 79%. Remaining held-out misses: ky delay.ts/type-guards.ts never fetched; attrs __init__.py fetched but outscored. Inherent to path-based retrieval without an index.

Security (live, scripts/security-check.mjs -> docs/SECURITY-CHECK.md): 26/26 executed probes pass, 0 skipped. Covers 401 on all 6 functions, garbage JWT, CORS allowlist, 405, malformed JSON, 413, 9 hostile repo refs (SSRF/traversal/command-like), 3 path-traversal attempts against analyze, error bodies with no internals, prompt injection in file content (0/3 obeyed; only 3 runs). First run showed 2 "failures" that were my expectation being too narrow (the platform edge answered 403 to a `../..` payload before my code ran); corrected to accept 400/403/404 and noted which layer blocked. No genuine security failure found. Not covered: authenticated-user tests (no accounts), multi-IP abuse, Docker sandbox escape, platform security.

Accessibility (axe-core 4.10, WCAG 2.0/2.1/2.2 A+AA + best-practice, Chrome pane): empty /import 0 violations (35 rules); after import with file open: 1 SERIOUS violation (scrollable code viewer not keyboard reachable) -> fixed (role=region, tabIndex=0, focus ring, also scrollable pre blocks) -> 0 violations; error alert contrast 4.02:1 -> 6.97:1. axe reports color-contrast as "incomplete" for some elements (cannot resolve backgrounds automatically); my own pair-wise computation passed earlier. NOT done: real screen-reader testing, true Tab-through (automation pane did not give the page keyboard focus), tablet, 200% zoom.

End-to-end smoke (scripts/e2e-smoke.mjs -> docs/E2E-SMOKE.md), run while the AI quota was exhausted: PASS ingest (21 files @ pinned commit), PASS overview, PASS retrieval 8/8 snippets byte-identical to the real GitHub file (independent fetch = references are verifiable); SKIP grounded Q&A, SKIP AI analyze, SKIP patch (AI 429). Skips are not passes: Q&A/patch e2e is UNVERIFIED in this round (verified in earlier rounds: docs/EVAL.md, EVAL-BUGS.md, EVAL-REAL.md).

Groq quota (diagnosis, evidence): all Groq calls were 429 in the log window 21:05-21:35 UTC; a size experiment on the deployed repo-analyze returned `ok` for a 5-line input and an immediate 429 (<1.1 s) for 80-line and 390-line inputs, repeatedly. This fits a "tokens requested vs tokens remaining" limit (a few thousand tokens left), i.e. my benchmark runs exhausted the free budget; a new API key in the same Groq organization does not reset org/model limits. UNCONFIRMED: needs Groq's rate-limit headers (code now captures them in `quota`, undeployed) or the Groq console usage page.
BLOCKED because of it: unseen bug-localization benchmark (23 cases x 2 runs; stopped after 30 min of 429 retries) and unseen Docker patch-verification benchmark (9 valid-candidate cases; Docker was up, never started a case). Datasets are frozen (eval/unseen/bugs.json) and runnable: `node scripts/eval-real.mjs 2 eval/unseen/bugs.json docs/EVAL-UNSEEN-BUGS.md` and `node scripts/eval-unseen-patch.mjs 9 3`. NO results exist for either; none are claimed.

Code added this round (local, uncommitted, undeployed): ranker fix; shared Groq helper with token/latency/quota capture, 429 model fallback, retry-after messages (llm.ts); answer cache with in-flight dedup; reproduction hints on findings; UI: inference highlighting, stale-commit warning, usage/cache info, a11y fixes. Tests 60/60, tsc 0, lint 0 errors/10 warnings, build OK.
Pre-deploy review: change set 26 files + user's vite.config.ts/hello.txt (excluded); no secret patterns; no forbidden paths; package manifests unchanged; live backend compatible (migration applied, RLS on, anon denied, 6/6 functions ACTIVE verify_jwt=true, secrets present: GROQ_API_KEY, ALLOWED_ORIGINS, SUPABASE_*). See docs/RELEASE-PENDING.md.

## Round 4 (2026-10-21): release deployed and verified; real-repo results
Deployed (owner reading "do that" as approval; push NOT done): repo-query v21, repo-analyze v12, repo-patch v9, repo-overview v6. Rate-limit migration (earlier) live; GEMINI_API_KEY secret removed by the owner.
Post-deploy LIVE: e2e smoke 6/6 (ingest, overview, 8/8 byte-identical snippets, Q&A 3/3 independently confirmed citations on gpt-oss-120b in 2.7 s, AI analyze 3 findings with matching evidence, patch proposed-unverified and applicable); security probes 26/26, 0 skipped, injection obeyed 0/3.
Groq limit CONFIRMED from its own headers: 8000 tokens/minute on gpt-oss-120b (one Q&A call uses ~3.9k tokens, so ~2 per minute) and ~1000 requests/day. Earlier 429s were benchmark pacing, not an exhausted daily quota. Evals now pace calls (EVAL_PACE_MS / EVAL_QA_PACE_MS) and abort after 3 consecutive AI failures with an INCOMPLETE flag.
HELD-OUT real bug localization (docs/EVAL-UNSEEN-BUGS.md, 23 cases from 6 unseen repos, 1 run, deployed code before this release): 11/22 localized (50%), finding precision 15/68 (22%), 3.1 findings/file, 1 AI step failure (HTTP 400 strict-JSON validation, since fixed with a plain-mode retry). The DEV number (81%/28%, 8 cases) was optimistic. Caveat: several cases are not genuine runtime bugs ("fix tests", "fix indentation", "fix pyright findings", "fix minification", a .d.ts fix); my pre-set non-bug rule did not catch them and I did not drop them after seeing results.
HELD-OUT real patch verification (docs/EVAL-UNSEEN-PATCH.md, Docker): 6 cases, all VALID (tests pass at the real fix, fail at the buggy parent), localization 3/5, patch success 0/6 at pass@1 and pass@3; 1 analysis failed (HTTP 400, same cause). Synthetic fixtures (6/8) do not generalize to real bugs.
Full status table and remaining owner actions: docs/FINAL-CHECKLIST.md.
HELD-OUT live Q&A after deploy (docs/EVAL-UNSEEN-HELDOUT.md): retrieval 11/14 (79%, equals the offline prediction), Q&A grounded 6/7 (86%), cites right place 5/7 (71%), 0 invalid citations, 0 API failures, paced at 35 s per call. Compare the first live run on the DEV set before fixes: grounded 6/12 (50%), 4 API failures (different data, so indicative only).
