# Handoff

Updated: 2026-10-19, end of Phase 1 (PARTIALLY COMPLETE).

1. **Objective/state:** Evolve GitHub Profile Explorer into RepoPilot (CLAUDE.md, PROJECT_PLAN.md). Phase 0 done; Phase 1 code done and unit-tested, not deployed or live-verified.
2. **Milestone:** Phase 1 -> finishing items, then Phase 2 (indexing/retrieval).
3. **This session:** audit + docs; Vitest; shared pure modules; hardened `summarize-repo`; new `repo-ingest`; `/import` page.
4. **Decisions:** ADR-001..006 (docs/DECISIONS.md). Added in practice: shared pure modules live in `supabase/functions/_shared/` (tested by Vitest, importable by Deno functions and the frontend); per-isolate rate limit is a stopgap.
5. **Files:** see PROGRESS.md "Working tree".
6. **DB/secrets/deploy:** nothing changed remotely. No migrations written yet.
7. **Commands run:** tsc PASS; `npm test` 15/15; build PASS; lint 5 pre-existing errors. Edge functions never executed under Deno.
8. **Known issues:** PROGRESS.md.
9. **Git:** `main`, HEAD 45e84ac, origin = https://github.com/aryan9-6-5/RepoIntel.git. Nothing committed/pushed.
10. **Uncommitted:** everything listed in PROGRESS.md, including user's `vite.config.ts` and `hello.txt`.
11. **Next steps, in order:**
    1. Ask user to approve: (a) deploying both functions, (b) setting `ALLOWED_ORIGINS`/`GITHUB_TOKEN` secrets, (c) `git rm --cached .env supabase/.temp -r` + `.gitignore` entries, (d) which remote is authoritative.
    2. After approval: deploy, then live smoke test `/import` with a small public repo; confirm unauthenticated curl is rejected (JWT) and a disallowed Origin gets no CORS header.
    3. Add DB-backed rate limit + cache (new migration file; apply only with approval); make summary click-to-generate.
    4. Fix remaining lint errors; triage `npm audit`.
    5. Phase 2: `files`/`chunks` tables (tsvector, line ranges), chunker with exact line numbers, FTS retrieval, entry-point/dependency detection, staleness via commit SHA, atomic re-index. Write tests first with fixture repos.
12. **Phase 2 acceptance:** PROJECT_PLAN.md.
13. **Warnings:** preserve user's uncommitted changes; no deploy/secret/billing/push/commit without approval; `verify_jwt=true` will break callers lacking the publishable key (the UI sends it via supabase-js); trust `git status` and test runs over this file.
