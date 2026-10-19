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
