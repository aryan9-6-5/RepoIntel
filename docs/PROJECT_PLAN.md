# RepoPilot - Project Plan

Last updated: 2026-10-19 (Phase 0)

## Vision
Evidence-backed codebase understanding and debugging for public GitHub repositories. Every answer or
finding cites real files and line ranges and separates facts from inference.

## Scope
In: public repo import, deterministic indexing, keyword retrieval, source-grounded Q&A, bug findings
with confidence, patch proposals, local Docker verification, evaluation benchmarks.
Non-goals: private repos, auto-pushing/PRs, running repo code on hosted infra, paid services,
embeddings/vector DB (until retrieval benchmarks show keyword search is insufficient).

## Architecture (target)
```
React UI --supabase.functions.invoke--> Edge Functions (Deno)
   |                                      repo-ingest   GitHub REST (tree + blobs) -> limits/filters
   | (existing profile explorer           repo-query     retrieval (Postgres FTS) + Groq grounded answer
   |  calls GitHub directly)              repo-analyze   static checks + Groq findings
   |                                      summarize-repo (existing, to be hardened)
   '--> Supabase Postgres: repos, files, chunks(line ranges, tsvector), rate_limits, cache
Local only (Phase 5): scripts/verify-patch (Docker: no network, ro mount, cpu/mem/time caps)
```
Edge Function free-plan limits (CPU ~2s, memory 256MB) force: bounded file counts/sizes, batching,
and doing heavy work client-orchestrated in chunks rather than one long call.

## Audit baseline (Phase 0 findings)
Working: profile search, repo list/filter/sort, stats, per-repo AI summary (edge function), rate-limit banner.
Baseline: type-check PASS, build PASS (606 kB JS chunk warning), lint 10 errors/8 warnings, 0 tests.
Security/debt: see docs/PROGRESS.md "Known issues". Highest priority before new AI features:
S1 `verify_jwt=false`, S2 wildcard CORS, S3 no input validation/size caps, S4 upstream error body
returned to client, S5 no rate limiting on Groq-backed endpoint, S6 `.env` and `supabase/.temp/` tracked.

## Phases
| # | Name | Depends on | Acceptance (summary) |
|---|------|-----------|----------------------|
| 0 | Audit & foundation | - | Architecture understood, docs created, no app rewrite, no secret exposed |
| 1 | Hardening + repo ingestion | 0 | Import public repo, enumerate filtered files, graceful limits, nothing executed, explorer intact, Vitest set up |
| 2 | Indexing & retrieval | 1 | Chunks with accurate line refs, FTS retrieval reproducible, entry points/deps detected, staleness detection, atomic re-index |
| 3 | Grounded Codebase Explorer | 2 | Tree + file viewer, Q&A with verifiable citations, explicit "insufficient evidence", AI failure doesn't break browsing |
| 4 | Bug investigation | 3 | Findings with severity/confidence/evidence, seeded-bug benchmark, FP/miss measurable |
| 5 | Patch + safe verification | 4 | Diffs reviewable, Docker-isolated runs, real before/after results, no auto-apply |
| 6 | Evaluation & cost control | 3-5 | Defined metrics, repeatable benchmark, latency/token/429 tracking, caching/dedup |
| 7 | Production readiness | all | Fresh-dev setup works, build/tests pass, secrets history review, a11y, deploy docs, free-tier only |

## Testing strategy
See docs/TESTING.md. Vitest for pure logic (URL parsing, file filters, chunking, retrieval ranking,
citation validation); Deno tests for edge-function handlers; recorded GitHub fixtures (no live calls in CI);
Groq mocked; live smoke tests documented as manual.

## Risks
| Risk | Mitigation |
|------|-----------|
| GitHub 60 req/hr unauthenticated | server-side optional token secret, tree API + raw fetch, caching, size caps |
| Groq free-tier limits / 429 | token budgets, snippet caps, cache, graceful degradation, Ollama option |
| Edge CPU/time limits | bounded work per call, chunked client-driven ingestion |
| Prompt injection via repo content | delimiters, untrusted-data framing, no tools for model, output schema validation, citation verification |
| Hallucinated citations | validate every cited path:line against stored content, drop/flag failures |
| Anonymous abuse of Groq key | verify_jwt, rate-limit table, CORS allowlist, request caps |

## Deployment
Frontend: existing Vercel Hobby. Backend: existing Supabase Free project. Deploys and secret changes
require explicit user approval. Rollback: redeploy previous commit / previous function version.

## Free-tier constraints (verify before relying on them)
Supabase Free: limited DB size, edge function invocation/CPU limits, projects pause after inactivity.
Groq free: per-minute/day token and request limits (model-specific). GitHub unauthenticated: 60 req/h;
authenticated PAT 5000/h (a read-only PAT is free but is a credential -> Supabase secret only).
Vercel Hobby: non-commercial use terms. No payment info required by any planned component.

## Definition of completion
All phase acceptance criteria met, tests/build green, benchmark numbers measured and documented,
docs current, no unapproved paid resources.
