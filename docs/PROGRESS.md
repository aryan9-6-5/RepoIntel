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
`main`; local commits only, nothing pushed (origin = aryan9-6-5/RepoIntel, confirmed authoritative). Uncommitted: Phase 4-7 work (functions, scripts/, UI, lint fixes, README, docs). The user's own `vite.config.ts` (port 8080) and `hello.txt` are untouched.

## Manual setup
Supabase secrets: `GROQ_API_KEY` (set), `ALLOWED_ORIGINS` (localhost only for now; add the production origin before deploying a frontend), optional `GITHUB_TOKEN`.
