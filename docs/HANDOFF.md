# Handoff

Updated: 2026-10-21 (release deployed and verified; commits local, not pushed).

1. **Objective:** RepoPilot (CLAUDE.md, PROJECT_PLAN.md). Live on Supabase project `hftgejaodmbmuvsqspon` (functions: summarize-repo, repo-ingest, repo-query, repo-analyze, repo-patch).
2. **State:** see PROGRESS.md table. Everything is deployed except nothing needs deploying locally-only; `scripts/verify-patch.mjs` and `scripts/eval.mjs` run locally.
3. **Decisions:** ADR-001..008 (DECISIONS.md). Key: stateless retrieval (ADR-007), model `openai/gpt-oss-120b` with `reasoning_effort: low` for JSON outputs (ADR-008).
4. **Gotchas:** write code with regex/backslashes using the Write tool, not bash heredocs (backslashes get stripped). Docker bind mounts on Windows are slow; verify script mounts node_modules as a named volume. Never run untrusted repo code outside Docker.
5. **Git:** `main`; local commits exist; Phase 4-7 changes are uncommitted; nothing pushed. Do not commit/push/deploy-to-prod without user approval.
6. **State at pause:** all user-requested milestones (browser test, explorer, evaluation, security review) done and recorded in PROGRESS.md. Deployed functions: summarize-repo, repo-ingest, repo-query, repo-analyze (supports inline `content`), repo-patch (inline `content`), repo-overview. Uncommitted work exists; user asked for a pre-push review and to WAIT for approval before committing/pushing.
7. **Next steps, in order:**
   1. User approves the pre-push file list -> commit in logical commits -> (separate approval) push to origin aryan9-6-5/RepoIntel.
   2. Optional follow-ups: global rate limit (DB table), react-router v7, Tailwind upgrade, multi-file analysis, mobile/a11y pass, larger benchmark on unseen repos.
8. **Gotchas:** `@swc/core` pinned 1.13.5 (do not bump without `SWC_NATIVE_BINDING_CACHE`); `--legacy-peer-deps` was needed for the Vite 6 upgrade; write regex code with the Write tool, not bash heredocs; the Groq free tier 429s under load.

## Round 2 status (details in PROGRESS.md)
- M1 real-repo benchmark: docs/EVAL-REAL.md (localization 81%, precision 28%, n=8, noisy).
- M2 global rate limit: DONE and verified live (migration applied via the Supabase connector; 20x200 then 429s in one window; 60 concurrent -> exactly 20 allowed; next window resets; no `rl_hit` errors after the table existed). All 6 functions are deployed with it. Details and limitations in PROGRESS.md (single-IP test only, fixed-window boundary burst, counts rejected requests).
- M3 mobile/a11y: measured (0/202 targets under 24px, contrast AA, no overflow); not tested with a real screen reader/keyboard traversal.
- M4 multi-file: `context` option on repo-analyze, OPT-IN (A/B: no significant gain; docs/EVAL-CONTEXT.md).
- M5: code splitting, vercel.json (CSP tested, 0 violations), docs/DEPLOY.md, fresh-install reproduction verified (needed .npmrc + exact @swc/core pin).
- Git: nothing committed since push at 6a24ee8 (user asked not to). Uncommitted: round-2 code, fixtures, scripts, docs, vercel.json, .npmrc, supabase/migrations. User's vite.config.ts/hello.txt untouched.
- Gotchas: `.npmrc` legacy-peer-deps + swc pin are load-bearing; Groq free tier 429s; write regex code with the Write tool.
- Next: commit (user asked not to commit yet) -> optional push; then real screen-reader pass, multi-IP test, frontend deploy.

## Round 3 status (read docs/RELEASE-PENDING.md and PROGRESS.md "Round 3")
- Pending approvals: (1) deploy 4 functions (repo-query, repo-analyze, repo-patch, repo-overview); (2) commit the local changes (user's vite.config.ts/hello.txt excluded); (3) optionally remove unused secret GEMINI_API_KEY.
- BLOCKED: unseen bug-localization and Docker patch-verification benchmarks (free Groq budget exhausted; runnable commands in PROGRESS.md). Rerun after the quota resets or after deploying the fallback/quota-header code; check `quota` in responses first.
- Verified: retrieval fix offline (held-out 43% -> 79%), security probes 26/26, axe 0 violations after fixes, migration live and enforced (earlier concurrency test: exactly 20 of 60 allowed).
- Gotchas: stale background node processes from earlier sessions can keep burning Groq quota (kill eval-*.mjs); the browser tool times out at ~45 s per call; write regex code with the Write tool.

## Round 4 status (2026-10-21) - read docs/FINAL-CHECKLIST.md first
- Deployed and verified live (e2e 6/6, security 26/26). Local commits not pushed (5 ahead of origin/main as of the last commit, plus final docs/results to commit).
- Owner actions left: push; Vercel frontend + URL (then set ALLOWED_ORIGINS); real screen-reader test; decide on a DB full-text index.
- Honest quality picture: strong reading/citation/security/process; weak real-bug accuracy (held-out localization 50%, precision 22%, patch success 0/6).
- Groq free tier: 8000 tokens/min, ~1000 req/day on gpt-oss-120b; pace AI calls ~35-60 s apart in evals.
- Optional next engineering: full-text index (migration, needs approval), react-router v7 + Tailwind upgrades, stronger real-bug approach.

## Update 2026-10-21 (later): frontend is LIVE
https://repointel-rho.vercel.app (Vercel project repointel, account aryan9-6-5). See docs/DEPLOY.md "Live deployment". Remaining owner items: real screen-reader test, DB index decision. Recommended next engineering: cap Q&A prompt size (a single answer can use ~7.6k of the 8k tokens/min free budget).

## Update 2026-10-21 (final)
repo-query now (a) sends at most ~10k chars of snippets and 900 output tokens, (b) retries once when an answer has no verified citation. Deployed and measured on held-out data (7/7 grounded, mean 3.3k tokens). All of this is committed and pushed to origin/main (your own vite.config.ts and hello.txt remain local-only). Remaining owner items: real screen-reader test, DB full-text index decision. Open engineering: cap analyze prompt size for ~400-line files; stronger real-bug accuracy.
