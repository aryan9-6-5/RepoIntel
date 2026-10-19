# Real-bug localization benchmark (live, 2026-10-19, 2 runs)

Source: 8 real bug-fix commits from 4 public repos (frozen in `eval/real-bugs.json`; 12 of 20 collected commits excluded *before* running by a fixed non-bug rule: config/lint/typo/doc/build/bench paths or messages). The model sees only the pre-fix file; ground truth = lines the real fix changed; "localized" = a finding within +-3 lines. Re-run: `node scripts/eval-real.mjs`.

| Run | File | Result | Fix commit message |
|-----|------|--------|--------------------|
| 1 | axios/axios/lib/helpers/resolveConfig.js (fix lines 38,39,106,107) | MISSED (4 findings, 0 near) | fix: convert resolveConfig default export to named func |
| 1 | axios/axios/lib/core/mergeConfig.js (fix lines 102,103) | localized (5 findings, 2 near) | fix(security): guard mergeConfig value reads with hasOw |
| 1 | sindresorhus/got/source/as-promise/index.ts (fix lines 56,57) | localized (5 findings, 1 near) | Fix `deflate` responses not being decompressed (#1918) |
| 1 | chalk/chalk/source/vendor/supports-color/browser.js (fix lines 4,5,11,12) | localized (2 findings, 1 near) | Fix `navigator` not defined `ReferenceError` (#642) |
| 1 | chalk/chalk/source/vendor/ansi-styles/index.js (fix lines 68,219,220,221) | MISSED (2 findings, 0 near) | Fix exported styles names (#569) |
| 1 | uuidjs/uuid/src/stringify.js (fix lines 16,37,38) | localized (1 findings, 1 near) | fix: revert "perf: remove superfluous call to toLowerCa |
| 1 | uuidjs/uuid/src/v35.js (fix lines 19,20) | MISSED (5 findings, 0 near) | fix: change default export to named function (#545) |
| 1 | uuidjs/uuid/src/rng-browser.js (fix lines 10,11) | localized (1 findings, 1 near) | fix: make access to msCrypto consistent (#393) |
| 2 | axios/axios/lib/helpers/resolveConfig.js (fix lines 38,39,106,107) | localized (5 findings, 1 near) | fix: convert resolveConfig default export to named func |
| 2 | axios/axios/lib/core/mergeConfig.js (fix lines 102,103) | localized (5 findings, 1 near) | fix(security): guard mergeConfig value reads with hasOw |
| 2 | sindresorhus/got/source/as-promise/index.ts (fix lines 56,57) | localized (5 findings, 1 near) | Fix `deflate` responses not being decompressed (#1918) |
| 2 | chalk/chalk/source/vendor/supports-color/browser.js (fix lines 4,5,11,12) | localized (2 findings, 1 near) | Fix `navigator` not defined `ReferenceError` (#642) |
| 2 | chalk/chalk/source/vendor/ansi-styles/index.js (fix lines 68,219,220,221) | localized (5 findings, 1 near) | Fix exported styles names (#569) |
| 2 | uuidjs/uuid/src/stringify.js (fix lines 16,37,38) | localized (3 findings, 2 near) | fix: revert "perf: remove superfluous call to toLowerCa |
| 2 | uuidjs/uuid/src/v35.js (fix lines 19,20) | localized (6 findings, 1 near) | fix: change default export to named function (#545) |
| 2 | uuidjs/uuid/src/rng-browser.js (fix lines 10,11) | localized (4 findings, 3 near) | fix: make access to msCrypto consistent (#393) |

## Measured
- Localization (analyses where the AI step completed): 13/16 (81%)
- Finding precision (findings within +-3 lines of a real fixed line / all findings): 17/60 (28%)
- Findings per file (mean): 3.8
- AI step failed (429/unparseable): 0 of 16

## Limits (read before quoting any number)
- Very small sample (8 distinct cases); a few cases move the percentage by double digits.
- Popular public repos: the model may have seen these fixes in training (possible contamination), so scores may be inflated.
- A real fix often changes lines far from the "root cause" a reviewer would point at; finding near the fix is not the same as understanding the bug. Findings elsewhere in the file may be valid issues but count as misses here.
- Only localization is measured: no patch success on real repos (their tests were not run).
- Single file visible to the model; fixes that depend on other files are unfair misses.
