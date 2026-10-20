# Unseen-repo retrieval, Q&A and citation benchmark (live, 2026-10-20)

Method: for each repo, functions were sampled with a fixed seed (`scripts/build-unseen.mjs`, frozen in `eval/unseen/queries.json`). Query = the function's own doc comment ("doc" kind, semantic) or, when undocumented, its identifier turned into words ("symbol" kind). Ground truth = the file and line that define it; no hand labeling. Q&A is run only when retrieval found the file (so Q&A scores are conditional on retrieval success). Re-run: `node scripts/eval-unseen-qa.mjs`.

| Repo | Kind | Query | Truth | Retrieval | Q&A |
|------|------|-------|-------|-----------|-----|
| mime-types | symbol | how does populate maps work | index.js:154 | HIT+line | grounded, cites the right place, 0 invalid |
| blinker | doc | Emitted at the end of each :meth:connect call. | src/blinker/base.py:42 | HIT+line | UNGROUNDED, cites elsewhere/none, 0 invalid |
| blinker | doc | Get a stable identifier for a receiver or sender, to be | src/blinker/_utilities.py:42 | HIT+line | grounded, cites the right place, 0 invalid |
| ky | doc | Clone mutable option properties so init hook mutations  | source/core/Ky.ts:312 | HIT+line | grounded, cites the right place, 0 invalid |
| ky | symbol | how does abort handler work | source/utils/delay.ts:19 | MISS | - |
| ky | symbol | how does is ky error work | source/utils/type-guards.ts:36 | MISS | - |
| attrs | symbol | how does with custom repr work | typing_tests/baseline.py:129 | HIT+line | UNGROUNDED, cites elsewhere/none, 0 invalid |
| attrs | symbol | how does attrs instance work | src/attr/__init__.py:39 | MISS | - |
| attrs | symbol | how does resolve types work | src/attr/_funcs.py:425 | HIT+line | UNGROUNDED, cites elsewhere/none, 0 invalid |
| attrs | symbol | how does get disabled work | src/attr/validators.py:61 | HIT+line | grounded, cites the right place, 0 invalid |
| attrs | symbol | how does cmp using work | src/attr/_cmp.py:13 | HIT+line | - |
| attrs | symbol | how does version info work | src/attr/_version_info.py:12 | HIT+line | - |
| attrs | doc | If this is a generic class (A[str]), return the generic | src/attr/_compat.py:98 | HIT+line | - |
| attrs | symbol | how does optional converter work | src/attr/converters.py:43 | HIT+line | - |

## Measured
- Retrieval, defining file in top-8 snippets: 11/14 (79%) (doc-comment queries 4/4 (100%); identifier queries 7/10 (70%))
- Retrieval, a snippet covers the definition line: 11/14 (79%)
- Q&A answers with >=1 verified citation (given retrieval hit): 4/7 (57%)
- Q&A answers whose citation lands within +-30 lines of the true definition: 4/7 (57%)
- Invalid (hallucinated) citations caught by verification: 0; Q&A API failures: 0
- Tokens per answered question (prompt + completion): mean 2886, max 3671, n=7 (free-tier budget: 8000 tokens per minute)
- Queries run where live HEAD differs from the dataset commit: 0

| Repo | File hit | Line hit | Grounded | Cites right place | Invalid cites |
|------|----------|----------|----------|-------------------|---------------|
| jshttp/mime-types | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 0 |
| pallets-eco/blinker | 2/2 (100%) | 2/2 (100%) | 1/2 (50%) | 1/2 (50%) | 0 |
| sindresorhus/ky | 1/3 (33%) | 1/3 (33%) | 1/1 (100%) | 1/1 (100%) | 0 |
| python-attrs/attrs | 7/8 (88%) | 7/8 (88%) | 1/3 (33%) | 1/3 (33%) | 0 |

## Limits
Small samples per repo; queries are proxies (a doc comment is not how real users ask questions); "cites the right place" checks location, not whether the prose is correct; popular repos may be in the model's training data; Groq free tier can 429 (retried, failures counted).
