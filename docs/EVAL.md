# Evaluation (live, 2026-10-19)

Target: `aryan9-6-5/RepoIntel` via deployed Supabase functions. Re-run: `node scripts/eval.mjs`.

| Type | Case | Result | Latency |
|------|------|--------|---------|
| retrieval | rate limit banner low remaining | HIT | 3308 ms |
| retrieval | fetch github user and repositories | HIT | 1216 ms |
| retrieval | repository card display | HIT | 1171 ms |
| retrieval | summarize repository with groq | HIT | 1126 ms |
| retrieval | filter and sort repositories | HIT | 583 ms |
| retrieval | user profile component | HIT | 510 ms |
| qa (answerable) | how does the rate limit banner decide to show | OK (valid 1, invalid 0, http 200) | 1258 ms |
| qa (answerable) | how are repositories fetched from github | OK (valid 2, invalid 0, http 200) | 2233 ms |
| qa (unanswerable) | how does this code implement blockchain consensus | OK (valid 0, invalid 0, http 200) | 816 ms |

## Metrics
- Retrieval hit@8 (expected file among returned snippets): 6/6
- Q&A correct behaviour (grounded when answerable, not grounded/INSUFFICIENT when not): 3/3
- Invalid (hallucinated) citations caught: 0
- Rate-limit (429) responses: 0
- Latency median / max: 1171 ms / 3308 ms

## Limits of this benchmark
Small (6 retrieval + 3 Q&A cases), one small repository, labels written by the project author, single run (LLM output is non-deterministic). Static bug-check precision/recall is measured separately in `supabase/functions/_shared/findings.test.ts` on a 9-line seeded fixture and says nothing about real-world accuracy. LLM bug hypotheses and patch success rates are NOT measured.
