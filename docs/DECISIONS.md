# Architecture Decision Records

## ADR-001 - Evolve the existing TypeScript/Supabase app (2026-10-19) - FINAL
Context: Product could be a new Python/FastAPI service (initial idea) or an evolution of this app.
Options: (a) Python+FastAPI+pgvector+Docker backend; (b) extend React + Supabase Edge Functions.
Decision: (b), per the master plan. Reasons: zero cost, reuses deployed infra, preserves working explorer.
Rejected: (a) needs paid/hosted compute for an always-on service. Consequences: Deno CPU/memory limits
shape the design; heavy/untrusted execution is local-only (ADR-005).

## ADR-002 - Groq free tier for hosted LLM, Ollama optional (2026-10-19) - PROVISIONAL
Context: Need an LLM at no cost. Decision: keep Groq (already integrated) behind edge functions; model id
in one constant; Ollama as optional local path. Trade-off: rate limits; mitigated by caps/caching.
Rejected: paid APIs (cost rule).

## ADR-003 - Postgres full-text search before embeddings (2026-10-19) - PROVISIONAL
Context: Retrieval over code. Options: embeddings+vector DB, Postgres FTS (tsvector) + symbol/path boosts.
Decision: FTS first: deterministic, free, testable. Revisit only if Phase 6 benchmark shows recall problems.
Rejected for now: paid vector DBs/embedding APIs; local embeddings need compute the edge runtime lacks.

## ADR-004 - Harden the existing edge function before adding AI features (2026-10-19) - FINAL
Context: Audit found open Groq proxy (verify_jwt=false, CORS *, no limits, upstream errors echoed).
Decision: Phase 1 starts by enabling JWT verification (browser sends publishable key, so UI keeps
working), CORS allowlist, zod-style request validation with size caps, sanitized errors, and a DB-backed
rate limit. Production config/deploy changes require user approval.

## ADR-005 - No repository code execution on hosted infra (2026-10-19) - FINAL
Decision: Patch verification runs only in local Docker (no network, read-only mount, cpu/mem/time caps).
Docker 28.5.1 confirmed on the dev machine. If unavailable, deliver patches + manual verification steps.

## ADR-006 - Test tooling: Vitest + Deno test (2026-10-19) - PROVISIONAL
Decision: Vitest (already Vite-native) for `src/lib` logic; `deno test` for edge handlers, with shared
pure modules importable by both. Live GitHub/Groq calls only in documented manual smoke tests.

## ADR-007 - Stateless retrieval instead of a stored index (2026-10-19) - PROVISIONAL
Per-query: tree -> path ranking -> raw fetch at pinned commit -> chunk -> keyword score. No DB, no staleness, no corruption risk; costs a few GitHub calls per query. Revisit if Phase 6 metrics show quota/latency problems.
