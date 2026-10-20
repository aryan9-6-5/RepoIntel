# Real-bug localization benchmark (live, 2026-10-20, 1 runs)

Source: 23 real bug-fix commits from 6 public repos (frozen in `eval/unseen/bugs.json`; 9 of 32 collected commits excluded *before* running by a fixed non-bug rule: config/lint/typo/doc/build/bench paths or messages). The model sees only the pre-fix file; ground truth = lines the real fix changed; "localized" = a finding within +-3 lines. Re-run: `node scripts/eval-real.mjs 1 eval/unseen/bugs.json docs/EVAL-UNSEEN-BUGS.md`.

| Run | File | Result | Fix commit message |
|-----|------|--------|--------------------|
| 1 | jshttp/cookie/src/index.ts | AI step failed (error_400) | - |
| 1 | jshttp/cookie/index.js (fix lines 24,133,134) | localized (2 findings, 1 near) | Fix object assignment of `hasOwnProperty` (#177) |
| 1 | jshttp/cookie/index.js (fix lines 17,18) | localized (5 findings, 4 near) | Fix for maxAge == 0 |
| 1 | jshttp/cookie/index.js (fix lines 46,47) | localized (5 findings, 1 near) | fixed #5 ignore escape error and return original value  |
| 1 | expressjs/cors/lib/index.js (fix lines 190,191,192,193) | MISSED (1 findings, 0 near) | Fix error when options delegate missing "methods" optio |
| 1 | expressjs/cors/lib/index.js (fix lines 184,185) | localized (2 findings, 1 near) | fix tests |
| 1 | expressjs/cors/lib/index.js (fix lines 15,16) | MISSED (2 findings, 0 near) | Fix "Vary: origin" header added for "*" |
| 1 | expressjs/cors/lib/index.js (fix lines 100,101) | MISSED (3 findings, 0 near) | fix: Normalize method names to use uppercase before com |
| 1 | expressjs/cors/lib/index.js (fix lines 169,170,171) | MISSED (2 findings, 0 near) | Bug fix. Do not override options.origin callback. |
| 1 | mde/ejs/jakefile.js (fix lines 83,84) | localized (5 findings, 1 near) | Fix minification |
| 1 | mde/ejs/bin/cli.js (fix lines 151) | MISSED (5 findings, 0 near) | Fix cli includes by defaulting views to the current wor |
| 1 | mde/ejs/bin/cli.js (fix lines 155,156) | localized (5 findings, 1 near) | Fix wrong output file option in cli |
| 1 | mde/ejs/lib/utils.js (fix lines 34,35,36,37) | localized (1 findings, 1 near) | Fix indentation |
| 1 | jshttp/negotiator/index.js (fix lines 53,54) | localized (5 findings, 2 near) | fix(test): fixed up preferred encoding tests |
| 1 | jshttp/negotiator/lib/encoding.js (fix lines 15,16) | MISSED (2 findings, 0 near) | Fix missing identity encoding when q=0 exists |
| 1 | jshttp/negotiator/lib/mediaType.js (fix lines 81,82) | MISSED (2 findings, 0 near) | Fix error when media type has invalid parameter |
| 1 | jshttp/negotiator/lib/mediaType.js (fix lines 13,14) | localized (3 findings, 1 near) | Fixing global leak. |
| 1 | sindresorhus/p-limit/index.js (fix lines 108,109) | MISSED (3 findings, 0 near) | Fix detached limit.map calls (#108) |
| 1 | sindresorhus/p-limit/index.d.ts (fix lines 36,37,93,94) | MISSED (0 findings, 0 near) | Fix `limitFunction` type |
| 1 | sindresorhus/p-limit/index.js (fix lines 6,7) | localized (2 findings, 1 near) | Fix error on invalid concurrency (#35) |
| 1 | pallets/itsdangerous/src/itsdangerous/timed.py (fix lines 57,58,175,176) | MISSED (3 findings, 0 near) | fix pyright findings |
| 1 | pallets/itsdangerous/itsdangerous.py (fix lines 274,275,276) | MISSED (5 findings, 0 near) | Fix issue #3 and add proper unit test. |
| 1 | pallets/itsdangerous/itsdangerous.py (fix lines 110,111) | localized (5 findings, 1 near) | Fixed a bug that caused the library not to accept unico |

## Measured
- Localization (analyses where the AI step completed): 11/22 (50%)
- Finding precision (findings within +-3 lines of a real fixed line / all findings): 15/68 (22%)
- Findings per file (mean): 3.1
- AI step failed (429/unparseable): 1 of 23

## Limits (read before quoting any number)
- Very small sample (23 distinct cases); a few cases move the percentage by double digits.
- Popular public repos: the model may have seen these fixes in training (possible contamination), so scores may be inflated.
- A real fix often changes lines far from the "root cause" a reviewer would point at; finding near the fix is not the same as understanding the bug. Findings elsewhere in the file may be valid issues but count as misses here.
- Only localization is measured: no patch success on real repos (their tests were not run).
- Single file visible to the model; fixes that depend on other files are unfair misses.
