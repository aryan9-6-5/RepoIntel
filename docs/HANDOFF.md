# Handoff

Updated: 2026-10-19 (round 2 in progress: M1-M3 done; M2 awaits deploy approval).

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
