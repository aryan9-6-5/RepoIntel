# Handoff

Updated: 2026-10-19 (all phases at working baseline).

1. **Objective:** RepoPilot (CLAUDE.md, PROJECT_PLAN.md). Live on Supabase project `hftgejaodmbmuvsqspon` (functions: summarize-repo, repo-ingest, repo-query, repo-analyze, repo-patch).
2. **State:** see PROGRESS.md table. Everything is deployed except nothing needs deploying locally-only; `scripts/verify-patch.mjs` and `scripts/eval.mjs` run locally.
3. **Decisions:** ADR-001..008 (DECISIONS.md). Key: stateless retrieval (ADR-007), model `openai/gpt-oss-120b` with `reasoning_effort: low` for JSON outputs (ADR-008).
4. **Gotchas:** write code with regex/backslashes using the Write tool, not bash heredocs (backslashes get stripped). Docker bind mounts on Windows are slow; verify script mounts node_modules as a named volume. Never run untrusted repo code outside Docker.
5. **Git:** `main`; local commits exist; Phase 4-7 changes are uncommitted; nothing pushed. Do not commit/push/deploy-to-prod without user approval.
6. **Next steps, in order:**
   1. User reviews; approve commit (and later push to origin aryan9-6-5/RepoIntel).
   2. Browser-test `/import` end to end (run `npm run dev`).
   3. Directory tree + file viewer; entry-point/dependency detection (Phase 2/3 gaps).
   4. Bigger benchmark (more repos, seeded bugs in real code); measure hypothesis precision and patch success.
   5. Upgrade vite 6+/vitest 4 to clear audit findings; DB-backed rate limit; click-to-generate summary.
   6. If deploying a frontend: set `ALLOWED_ORIGINS` secret to its origin first.
