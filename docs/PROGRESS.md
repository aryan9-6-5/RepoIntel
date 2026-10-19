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

## Milestones 1-2 (2026-10-19, browser-verified at http://localhost:8080/import)
M1 browser results: invalid input -> inline error PASS; import real repo PASS (84 files); nonexistent repo -> "Repository not found or not public." PASS; network failure -> generic error, form re-enabled PASS; Q&A PASS; analyze PASS; propose fix PASS (diff shown, "unverified, nothing applied").
Bugs found and fixed by testing: (a) Q&A citations pointed at wrong lines because the prompt had no line numbers -> prompt now numbers lines; (b) analyze hid a Groq 429/unparseable-JSON behind "No findings" -> UI now discloses AI status, JSON-object response format + reasoning_effort medium (3/3 later runs OK); (c) one proposed patch (removing the OPTIONS handler in summarize-repo) was WRONG -> shows why patches stay "unverified" until sandboxed.
M2 delivered: `repo-overview` function (deterministic languages/dirs/entry points/config + package.json/requirements.txt/go.mod dependencies + optional grounded architecture summary), `_shared/overview.ts` (34 tests total, all pass), FileTree, CodeViewer (raw file at pinned commit, plain-text rendering, highlight range), clickable citations/findings/entry points. Browser-verified: tree renders, viewer line numbers 40/40 match source, citation click highlights 9-13, architecture summary shows "Citations verified" (4 valid, 0 invalid via curl).
Not browser-tested: very large files (render capped at 3000 lines), keyboard navigation of the tree, mobile layout.

## Milestones 3-4 + final state (2026-10-19)
M3 evaluation (all measured live; see docs/EVAL.md and docs/EVAL-BUGS.md):
- Retrieval hit@8: 12/12 on 2 repos (RepoIntel, expressjs/express). Honest history: first run 10/12; failures were real ranking flaws (test files and the huge History.md changelog outranked source). Fixed with prefix matching, test/changelog deprioritization, sublinear term scoring. These fixes were tuned on this benchmark, so 12/12 is optimistic; expect lower on unseen repos.
- Q&A behaviour: 5/6 to 6/6 across runs (the miss = model sometimes omits citations, UI then says "No verified citations"; separate 429s from the free Groq tier). 0 invalid citations observed.
- Bug benchmark (6 synthetic fixtures, 2 runs): localization 8/8, finding precision 14/16 (88%), 0 false positives on the clean control, static rules 8 TP / 0 FP / 0 FN, patch success 6/8 (75%) = failing tests -> passing in the Docker sandbox for sum-range, clamp, average (both runs). slugify failed both runs (patch did not satisfy the tests: the sandbox correctly reported `still-failing`). This satisfies the "at least one reproducible failing->green case": `node scripts/eval-bugs.mjs` (or `node scripts/verify-patch.mjs --local eval/fixtures/sum-range <patch.json>`).
- Caveats: synthetic single-function bugs authored by us; one file visible to the model; non-deterministic; NOT evidence for real repositories.
M4: docs/SECURITY.md. Upgraded to Vite 6.4 / Vitest 4.1 (npm audit 16 -> 11 total, 10 -> 2 in production tree; all remaining are build-time tooling except react-router open-redirect (not reachable: static links only; fix = breaking v7)). `@swc/core` pinned to 1.13.5 (newer one fails to load on this Windows machine: DACL cache check). Rate limiting remains per isolate (cannot be made global without a DB table; documented).

## Final verification (run just before this note)
tsc PASS; lint 0 errors/10 warnings; 37/37 tests; build PASS; dist has no secret patterns; git history has no real tokens; fixture fake key replaced to avoid push-protection false positives.
Browser-verified: import, error states, Q&A, analyze, propose fix, tree, viewer (40/40 lines match), citation highlight, architecture summary. Not browser-tested: mobile layout, tree keyboard navigation, very large files, bundle size (606 kB chunk).

## Still open
Directory-level architecture is summary-only (reads README/manifest/<=3 entry files); non-Node patch verification; global rate limit; react-router v7 migration; Tailwind major upgrade; single-file analysis only (no cross-file/call-graph); production deploy + accessibility audit not done.
