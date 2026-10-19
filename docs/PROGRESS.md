# Progress

Last updated: 2026-10-19

**Current phase:** 1 - Hardening + repository ingestion: **PARTIALLY COMPLETE** (code + unit tests done locally; deploy/live verification pending approval)
**Next concrete action:** see PROGRESS.md latest update; then Phase 4 UI + larger benchmark, Phase 5 patches.

| Phase | Status |
|-------|--------|
| 0 Audit & foundation | COMPLETE |
| 1 Hardening + ingestion | PARTIALLY COMPLETE |
| 2-7 | Unstarted |

## Implemented (Phase 1)
- Vitest + `npm test`; 15 unit tests in `supabase/functions/_shared/*.test.ts`
- `_shared/repoUrl.ts` (parse/identity), `fileFilter.ts` (filters + limits: 3000 files, 200 KB/file, 20 MB total), `ingest.ts` (GitHub REST ingestion with typed errors, injectable fetch), `validate.ts` (body validation, caps, CORS allowlist)
- `summarize-repo` hardened: validated/bounded input, 20 KB body cap, CORS allowlist (`ALLOWED_ORIGINS` secret, defaults to localhost), sanitized errors (no upstream bodies), Groq timeout + max_tokens, untrusted-data prompt framing, best-effort per-isolate rate limit, empty-response handling
- `repo-ingest` edge function (optional `GITHUB_TOKEN` secret, 15 s timeout)
- `/import` page (`src/pages/RepoImport.tsx`) + link from the explorer; existing explorer unchanged
- `verify_jwt = true` for both functions in `supabase/config.toml` (NOT deployed)
- Lint: 10 -> 5 errors (removed edge-function `any`s and RepoDetailModal `any`s)

## Verification actually run (2026-10-19)
- `npx tsc -p tsconfig.app.json --noEmit`: PASS
- `npm test`: 15/15 PASS (mocked GitHub; no live calls)
- `npm run build`: PASS (~6 s); no `gsk_`/`ghp_` patterns in `dist/`
- `npm run lint`: FAIL, 5 errors/8 warnings, all pre-existing (ui/textarea, ui/command, `no-useless-catch` x2 in useGitHubApi, tailwind `require`)
- NOT run: edge functions under Deno/Supabase (`deno` not exercised), live GitHub/Groq calls, browser test of `/import`, deploy

## Phase 1 acceptance
- Import public repo and enumerate files: implemented, verified only against mocked responses
- Oversize/unsupported fail gracefully: unit-tested (404, 403/429, private, truncated tree, too many files, too large)
- No source executed: true by construction (metadata only; file contents are not even downloaded yet)
- Explorer intact: type-check/build pass; not browser-tested
- Unmet: live verification, deploy, `.env`/`supabase/.temp` untracking, global (DB-backed) rate limiting, caching

## Known issues
- S1 fixed in config only (needs deploy). S2/S3/S4 fixed in code (needs deploy). S5 partially (per-isolate only). S6 open: `.env`, `supabase/.temp/` still tracked (git rm --cached needs approval). S7 open: npm audit 16 vulns, untriaged
- RepoDetailModal still calls Groq on every open (quota waste) - candidate for click-to-generate + cache
- README stale; remote URL mismatch (README `aryanhanumakonda/github-profile-explorer` vs origin `aryan9-6-5/RepoIntel`)
- Bundle chunk 606 kB
- `ingest` trusts GitHub's reported `size` (KB) and tree sizes; file contents not fetched until Phase 2

## Working tree (uncommitted, nothing pushed)
Modified: package.json, package-lock.json (vitest), src/App.tsx, src/components/RepoDetailModal.tsx, src/pages/Index.tsx, supabase/config.toml, supabase/functions/summarize-repo/index.ts, vite.config.ts (user's port change)
New: CLAUDE.md, docs/, hello.txt (user's), src/pages/RepoImport.tsx, supabase/functions/_shared/, supabase/functions/repo-ingest/, vitest.config.ts

## Manual setup required
Supabase secrets: `GROQ_API_KEY` (verify), `ALLOWED_ORIGINS` (production origin, comma-separated), optional `GITHUB_TOKEN` (read-only PAT).

## Update: deploy + live smoke (2026-10-19)
Project is `hftgejaodmbmuvsqspon` (config.toml project_id was stale, fixed). Free-plan project had been paused; user restored it.
Deployed `summarize-repo` and `repo-ingest`; secret `ALLOWED_ORIGINS=localhost:8080,5173` set (no production site exists).
Live checks PASSED: no-auth call -> 401; disallowed Origin -> no CORS header; `repo-ingest` on aryan9-6-5/RepoIntel -> ok:true with commit SHA + files; invalid repo -> 400.
Not live-tested: `summarize-repo` Groq path, `/import` in a browser. `.env` and `supabase/.temp` untracked + gitignored (staged deletions, not committed).
Minor: ingest response passes through extra GitHub tree fields (`mode`, `url`); harmless, trim later.
Phase 1 remaining: DB-backed rate limit/cache, lint leftovers, npm audit triage. Status: PARTIALLY COMPLETE -> effectively COMPLETE for ingestion; leave open until rate-limit item decided.

## Phase 2 (2026-10-19): PARTIALLY COMPLETE
Done: `_shared/search.ts` (line-exact chunking, path ranking, keyword scoring; 3 tests, total 18/18 pass) and deployed `repo-query` function (ingest tree -> rank top 15 paths -> fetch raw at pinned commit SHA -> chunk -> top 8 snippets with path:start-end). Live smoke OK on RepoIntel.
Design (ADR-007, provisional): stateless retrieval, no DB index. Staleness is impossible because every query pins the current commit SHA; no index to corrupt. Cost: re-fetch per query (15 files max). Add DB/cache if latency or GitHub quota hurts.
Not done: entry-point/dependency/config detection, retrieval benchmark with known queries, UI for queries (Phase 3), rate limit on repo-query (unauthenticated GitHub quota 60/h unless GITHUB_TOKEN secret set).

## Phase 3 (2026-10-19): PARTIALLY COMPLETE / BLOCKED on Groq
Done: `_shared/answer.ts` (grounding prompt, citation verification against retrieved snippets; 21/21 tests pass), `repo-query` `ask:true` returns answer + verified/invalid citations (explicit INSUFFICIENT EVIDENCE when no snippets, no Groq call), Q&A box on `/import` showing answer, citation status, expandable snippets. tsc PASS, build PASS, lint 5 pre-existing errors. Deployed.
Blocker: live Groq calls return 502 "AI service error" for BOTH `summarize-repo` and `repo-query` (status not captured in logs). Likely invalid/expired GROQ_API_KEY or retired model. User must set a fresh key: `npx supabase secrets set GROQ_API_KEY=<key> --project-ref hftgejaodmbmuvsqspon`. Not browser-tested.
Not done: directory tree + full file viewer, architecture summary, fact/inference UI beyond prompt rule.

## Update (2026-10-19): Phase 3 verified live; Phase 4 started
Groq blocker resolved: key was fine; model `llama-3.3-70b-versatile` returned 404 `model_not_found` for this key. Switched all functions to `openai/gpt-oss-120b` (the key's available chat models: gpt-oss-120b/20b, qwen3.8-27b, allam-2-7b). Phase 3 live test: answer with 2 valid, 0 invalid citations. Citation checker now accepts fullwidth brackets (model emitted them). `repo-query` errors expose `upstreamStatus`/`upstreamCode` (no bodies). Phase 3 still lacks directory tree/file viewer + architecture summary. Tests 25/25.
Phase 4 PARTIALLY COMPLETE: `_shared/findings.ts` (5 deterministic rules, line-accurate; LLM hypotheses validated to existing lines, always labeled `hypothesis`/low confidence; `score()` for precision/recall) + deployed `repo-analyze` (path must be in vetted tree). Seeded benchmark (9-line fixture, 5 labeled bugs): static precision 1.0, recall 1.0 - TOY benchmark written by us, not evidence of real-world accuracy. LLM hypothesis precision NOT measured. Live: static found 0 on summarize-repo (expected), LLM gave 3 hypotheses. No UI yet; no reproduction suggestions.
