# Evaluation (live, 2026-10-19)

Targets: aryan9-6-5/RepoIntel, expressjs/express via deployed Supabase functions. Re-run: `node scripts/eval.mjs`.

| Repo | Type | Case | Result | Latency |
|------|------|------|--------|---------|
| aryan9-6-5/RepoIntel | retrieval | rate limit banner low remaining | HIT | 2355 ms |
| aryan9-6-5/RepoIntel | retrieval | fetch github user and repositories | HIT | 1768 ms |
| aryan9-6-5/RepoIntel | retrieval | repository card display | HIT | 809 ms |
| aryan9-6-5/RepoIntel | retrieval | summarize repository with groq | HIT | 812 ms |
| aryan9-6-5/RepoIntel | retrieval | filter and sort repositories | HIT | 235 ms |
| aryan9-6-5/RepoIntel | retrieval | user profile component | HIT | 237 ms |
| aryan9-6-5/RepoIntel | qa (answerable) | how does the rate limit banner decide to show | FAIL (valid 0, invalid 0, http 200) | 1338 ms |
| aryan9-6-5/RepoIntel | qa (answerable) | how are repositories fetched from github | OK (valid 5, invalid 0, http 200) | 1751 ms |
| aryan9-6-5/RepoIntel | qa (unanswerable) | how does this code implement blockchain consensus | OK (valid 0, invalid 0, http 200) | 1218 ms |
| expressjs/express | retrieval | res.json send json response | HIT | 795 ms |
| expressjs/express | retrieval | res.redirect location header | HIT | 878 ms |
| expressjs/express | retrieval | res.cookie set cookie options | HIT | 899 ms |
| expressjs/express | retrieval | app.listen create http server | HIT | 791 ms |
| expressjs/express | retrieval | app.use mount middleware | HIT | 814 ms |
| expressjs/express | retrieval | View class template engine lookup | HIT | 1125 ms |
| expressjs/express | qa (answerable) | how does app.listen start the server | OK (valid 2, invalid 0, http 200) | 2026 ms |
| expressjs/express | qa (answerable) | how does res.redirect set the location | OK (valid 4, invalid 0, http 200) | 1673 ms |
| expressjs/express | qa (unanswerable) | how does this code implement blockchain consensus | OK (valid 0, invalid 0, http 200) | 1652 ms |

## Metrics
- Retrieval hit@8 (expected file among returned snippets): 12/12
- Q&A correct behaviour (grounded when answerable, not grounded/INSUFFICIENT when not): 5/6
- Invalid (hallucinated) citations caught: 0
- Rate-limit (429) responses: 3
- Latency median / max: 1125 ms / 2355 ms

## Limits of this benchmark
Small (12 retrieval + 6 Q&A cases), two repositories (one small, one mid-size), labels written by the project author, single run (LLM output is non-deterministic). Static bug-check precision/recall is measured separately in `supabase/functions/_shared/findings.test.ts` on a 9-line seeded fixture and says nothing about real-world accuracy. Bug-finding and patch results are in `docs/EVAL-BUGS.md` (synthetic fixtures only).
