# Bug-finding and patch benchmark (live, 2026-10-19, 2 runs)

Fixtures: `eval/fixtures/*` (4 buggy functions with real failing tests, 1 clean control, 1 insecure-pattern file). Re-run: `node scripts/eval-bugs.mjs [runs]`.
Localization = at least one finding within +-1 line of the seeded bug. Patch success = the sandboxed test suite goes from failing to passing (Docker, no network).

| Run | Fixture | Localization | Proposed edit | Sandbox verdict |
|-----|---------|--------------|---------------|-----------------|
| 1 | sum-range | localized (1 findings, 1 near bug) | lines 4-4 | fixes-failing-tests |
| 1 | clamp | localized (2 findings, 2 near bug) | lines 3-4 | fixes-failing-tests |
| 1 | average | localized (1 findings, 1 near bug) | lines 5-5 | fixes-failing-tests |
| 1 | slugify | localized (2 findings, 2 near bug) | lines 2-3 | still-failing |
| 1 | clean (no bug) | 0 findings (all false positives) | - | - |
| 1 | insecure | static: 4 findings | - | - |
| 2 | sum-range | localized (2 findings, 1 near bug) | lines 4-4 | fixes-failing-tests |
| 2 | clamp | localized (2 findings, 2 near bug) | lines 3-4 | fixes-failing-tests |
| 2 | average | localized (2 findings, 1 near bug) | lines 5-5 | fixes-failing-tests |
| 2 | slugify | localized (4 findings, 4 near bug) | lines 2-4 | still-failing |
| 2 | clean (no bug) | 0 findings (all false positives) | - | - |
| 2 | insecure | static: 4 findings | - | - |

## Measured
- Bug localization (buggy fixtures): 8/8 (100%)
- Finding precision on buggy fixtures (findings near a seeded bug / all findings): 14/16 (88%)
- False positives on the clean control: 0 finding(s) across 2 run(s)
- Patch success, given localization (failing -> passing): 6/8 (75%)
- End-to-end success (buggy fixtures fixed / all buggy fixture attempts): 6/8 (75%)
- Static rules on the insecure file: 8 TP, 0 FP, 0 FN
- Analyses where the AI step did not complete OK (429/unparseable/error): 0

## Limits
Tiny, synthetic, single-function bugs written by the project author; the model sees one file only; 2 run(s) of a non-deterministic model. These numbers do not predict performance on real repositories. Findings the model reports outside the seeded bug count as non-precise here even if they are legitimate observations.
