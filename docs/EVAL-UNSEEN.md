# Unseen-repo retrieval, Q&A and citation benchmark (live, 2026-10-19)

Method: for each repo, functions were sampled with a fixed seed (`scripts/build-unseen.mjs`, frozen in `eval/unseen/queries.json`). Query = the function's own doc comment ("doc" kind, semantic) or, when undocumented, its identifier turned into words ("symbol" kind). Ground truth = the file and line that define it; no hand labeling. Q&A is run only when retrieval found the file (so Q&A scores are conditional on retrieval success). Re-run: `node scripts/eval-unseen-qa.mjs`.

| Repo | Kind | Query | Truth | Retrieval | Q&A |
|------|------|-------|-------|-----------|-----|
| cookie | symbol | how does gen cookies work | src/parse-cookie.bench.ts:51 | HIT file | grounded, cites elsewhere/none, 0 invalid |
| cookie | symbol | how does gen cookies work | src/stringify-cookie.bench.ts:49 | HIT+line | grounded, cites the right place, 0 invalid |
| cookie | doc | Find the next = character, or return len. | src/index.ts:486 | HIT+line | grounded, cites the right place, 0 invalid |
| cors | symbol | how does is origin allowed work | lib/index.js:19 | HIT+line | grounded, cites the right place, 0 invalid |
| ejs | symbol | how does has binary work | jakelib/ecosystem.js:8 | HIT file | grounded, cites elsewhere/none, 0 invalid |
| ejs | doc | If the consumer closes our output pipe (e.g. | bin/cli.js:32 | HIT+line | grounded, cites the right place, 0 invalid |
| ejs | symbol | how does escape xmlto string work | lib/esm/utils.js:103 | MISS | - |
| ejs | doc | Try to resolve file path on multiple directories | lib/esm/ejs.js:133 | MISS | - |
| negotiator | symbol | how does get encoding priority work | lib/encoding.js:77 | HIT+line | UNGROUNDED, cites elsewhere/none, 0 invalid |
| negotiator | symbol | how does get language priority work | lib/language.js:65 | HIT+line | UNGROUNDED, cites elsewhere/none, 0 invalid |
| negotiator | symbol | how does parse accept work | lib/accept.js:23 | HIT+line | API fail (http 429) |
| negotiator | symbol | how does compare specs work | lib/mediaType.js:156 | HIT+line | API fail (http 429) |
| negotiator | symbol | how does get charset priority work | lib/charset.js:58 | HIT+line | - |
| p-limit | symbol | how does validate concurrency work | index.js:144 | HIT+line | API fail (http 429) |
| itsdangerous | doc | Works like :class:.Serializer but dumps and loads into  | src/itsdangerous/url_safe.py:72 | HIT+line | API fail (http 429) |
| itsdangerous | doc | Base64 encode a string of bytes or text. | src/itsdangerous/encoding.py:20 | MISS | - |
| itsdangerous | doc | Raised if a signature timestamp is older than max_age. | src/itsdangerous/exc.py:60 | MISS | - |
| itsdangerous | doc | Creates a new instance of the signer to be used. | src/itsdangerous/serializer.py:278 | MISS | - |
| itsdangerous | doc | Convert the timestamp from :meth:get_timestamp into an | src/itsdangerous/timed.py:35 | MISS | - |
| itsdangerous | doc | Verifies the given signature matches the expected | src/itsdangerous/signer.py:24 | MISS | - |

## Measured
- Retrieval, defining file in top-8 snippets: 13/20 (65%) (doc-comment queries 3/9 (33%); identifier queries 10/11 (91%))
- Retrieval, a snippet covers the definition line: 11/20 (55%)
- Q&A answers with >=1 verified citation (given retrieval hit): 6/12 (50%)
- Q&A answers whose citation lands within +-30 lines of the true definition: 4/12 (33%)
- Invalid (hallucinated) citations caught by verification: 0; Q&A API failures: 4
- Queries run where live HEAD differs from the dataset commit: 0

| Repo | File hit | Line hit | Grounded | Cites right place | Invalid cites |
|------|----------|----------|----------|-------------------|---------------|
| jshttp/cookie | 3/3 (100%) | 2/3 (67%) | 3/3 (100%) | 2/3 (67%) | 0 |
| expressjs/cors | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 0 |
| mde/ejs | 2/4 (50%) | 1/4 (25%) | 2/2 (100%) | 1/2 (50%) | 0 |
| jshttp/negotiator | 5/5 (100%) | 5/5 (100%) | 0/4 (0%) | 0/4 (0%) | 0 |
| sindresorhus/p-limit | 1/1 (100%) | 1/1 (100%) | 0/1 (0%) | 0/1 (0%) | 0 |
| pallets/itsdangerous | 1/6 (17%) | 1/6 (17%) | 0/1 (0%) | 0/1 (0%) | 0 |

## Limits
Small samples per repo; queries are proxies (a doc comment is not how real users ask questions); "cites the right place" checks location, not whether the prose is correct; popular repos may be in the model's training data; Groq free tier can 429 (retried, failures counted).
