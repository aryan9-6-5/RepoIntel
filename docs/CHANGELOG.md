# Changelog

## 2026-10-19 - Phase 0: Audit and foundation
- Added CLAUDE.md and docs/ (PROJECT_PLAN, DECISIONS, PROGRESS, CHANGELOG, HANDOFF, TESTING).
- No application code, dependencies, database, or configuration changed.
- No security fixes yet; findings S1-S7 recorded in PROGRESS.md for Phase 1.

## 2026-10-19 - Phase 1: Hardening and repository ingestion (partially complete, undeployed)
- User-visible: new `/import` page lists indexable files of a public GitHub repo; link from the explorer.
- Backend: new `repo-ingest` edge function; shared pure modules in `supabase/functions/_shared/`.
- Security: `summarize-repo` now validates/bounds input, caps body size, uses a CORS allowlist, returns sanitized errors, times out upstream calls, frames repo data as untrusted; `verify_jwt = true` for both functions (config only, needs deploy).
- Dependencies: added dev dependency `vitest`; added `npm test`.
- Bug fixes/cleanup: removed `any` usage in RepoDetailModal and the edge function (lint 10 -> 5 errors).
- Breaking: after deploy, callers without the Supabase publishable key are rejected; browsers must come from `ALLOWED_ORIGINS`.

## 2026-10-19 - Phases 2-7 (working baseline)
- New functions: repo-query (retrieval + grounded Q&A with verified citations), repo-analyze (static rules + hypotheses), repo-patch (validated edit + diff). Model switched to openai/gpt-oss-120b.
- UI: `/import` shows files, Q&A, findings, proposed diff and the local verify command (no auto-apply).
- Local tooling: scripts/verify-patch.mjs (Docker sandbox), scripts/eval.mjs (benchmark -> docs/EVAL.md).
- Security/cost: per-isolate rate limit on all repo-* functions, 5-min tree cache, CORS allowlist, .env.example, .env and supabase/.temp untracked.
- Cleanup: lint 0 errors; non-breaking npm audit fixes; vitest 3; README rewritten.
