# Patch verification on real fixes in unseen repos (live, 2026-10-19)

Method: 6 real fix commits (JS repos, fix commit also changes tests; 2 of 11 eligible excluded by inspection before any model run: a test-only fix and a .d.ts types fix) from `eval/unseen/bugs.json`. A case is VALID only if (A) the project's tests pass at the real fix commit in the offline sandbox and (B) they fail at the buggy parent with the fix's test files overlaid. For valid cases the model sees only the buggy file; its top 3 findings (severity order, not chosen with ground truth) each get a proposed patch, applied one at a time, tests re-run in Docker (install with --ignore-scripts, tests --network none). Re-run: `node scripts/eval-unseen-patch.mjs 6 3`.

| Case | Real fix | Localization | Patch candidates (tests) | Result |
|------|----------|--------------|--------------------------|--------|
| jshttp/cookie@24f7da0 | Fix for maxAge == 0 | localized | #1:fail #2:fail #3:fail | not fixed |
| jshttp/cookie@1ae8966 | fixed #5 ignore escape error and return origi | localized | #1:fail #2:fail #3:fail | not fixed |
| expressjs/cors@d603fdc | Fix error when options delegate missing "meth | AI analysis failed (error_400) | - | - |
| expressjs/cors@e456c51 | fix: Normalize method names to use uppercase  | missed | #1:fail #2:fail | not fixed |
| expressjs/cors@3100a7c | Bug fix. Do not override options.origin callb | missed | #1:fail | not fixed |
| jshttp/negotiator@e227370 | Fix missing identity encoding when q=0 exists | localized | #1:fail #2:fail #3:fail | not fixed |

## Measured
- Cases attempted: 6; valid verification setups: 6; INVALID (infrastructure/test-oracle problems, excluded from rates): 0
- Of valid cases: model analysis failed 1; no findings 0
- Localization (any finding within +-3 lines of the real fix): 3/5 (60%)
- Patch success pass@1 (first candidate makes the tests pass): 0/6 (0%)
- Patch success pass@3 (any of top 3 candidates makes the tests pass): 0/6 (0%)

## Limits
Tiny sample; only JS projects with an offline-runnable `npm test`; dependency versions are resolved fresh (no lockfile) so some cases are invalid by design; passing the tests is not proof the patch is correct or complete; popular repos may be in the model's training data; a proposed patch that passes may still differ from the real fix.
