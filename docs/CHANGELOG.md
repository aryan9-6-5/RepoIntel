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
