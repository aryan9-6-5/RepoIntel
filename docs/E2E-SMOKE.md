# End-to-end smoke test (live, 2026-10-19)

Target: `jshttp/cookie` (src/index.ts) through the deployed functions. Re-run: `node scripts/e2e-smoke.mjs jshttp/cookie src/index.ts`.

| Result | Step | Detail |
|--------|------|--------|
| PASS | ingest returns a pinned commit and filtered files | 21 files @ 51c4854 in 2318 ms |
| PASS | overview: languages, entry points or dependencies detected | langs TypeScript, entry 1, manifests 1 |
| PASS | every retrieved snippet equals the real file lines (independently fetched) | 8/8 byte-identical |
| PASS | Q&A has >=1 verified citation and each lies inside a real snippet and file | 3 valid (3 independently confirmed), 0 invalid, model undefined, undefined ms |
| SKIP | analyze: findings reference real lines and evidence matches the file | SKIPPED: 0 findings to verify (AI step: error_429); a pass here would be vacuous |
| SKIP | analyze: AI hypotheses | SKIPPED: AI step was error_429 |
| SKIP | patch proposal is unverified, minimal and applies to the real file | SKIPPED: no findings to patch (AI unavailable or nothing found) |

4 passed, 0 failed, 3 skipped (of 7).

Limits: one repository, one run; the AI steps are non-deterministic and rate limited on the free tier (a 429 is reported as a failure of that step, not hidden).
