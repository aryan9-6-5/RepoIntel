# Retrieval fix: before/after on unseen repos (offline, reproducible)

Date: 2026-10-20. No deployment was involved: `scripts/eval-retrieval-local.mjs` runs the same pipeline code as `repo-query` (ingest -> `rankPaths` -> fetch -> `chunkFile` -> `searchChunks`) in Node, reading GitHub through the `gh` CLI. It reproduced the live deployed result exactly (13/20, 11/20, 33% doc, 91% symbol), which validates the harness.

Re-run:
```
git show HEAD:supabase/functions/_shared/search.ts > old-search.ts          # old ranker
node --experimental-strip-types scripts/eval-retrieval-local.mjs eval/unseen/queries.json 15 old-search.ts
node --experimental-strip-types scripts/eval-retrieval-local.mjs eval/unseen/queries.json 24
node --experimental-strip-types scripts/eval-retrieval-local.mjs eval/unseen/heldout-queries.json 24
```

## What was wrong (found by the first unseen run, docs/EVAL-UNSEEN.md)
In `pallets/itsdangerous` the doc-comment queries matched no path word, so the ranker fell back to "shallowest path wins": CI workflows, devcontainer and README filled the 15 fetch slots and the 8 `src/*.py` files were never read. Also the candidate window (15) was small.

## Fix
`rankPaths`: prior for real source files (+4) vs config/lock files (-2); dot-directories (`.github`, `.devcontainer`...) and `*.bench.*` files count as auxiliary; candidate window 15 -> 24 files. Tests reproduce the failure (`search.test.ts`).

## Results (file hit = defining file among the top-8 snippets)
| Set | What it is | Old ranker, 15 files (deployed) | New ranker, 15 files | New ranker, 24 files |
|-----|------------|--------------------------------|----------------------|----------------------|
| DEV  `eval/unseen/queries.json` (20 queries, 6 repos) | the set the failure was diagnosed on: IN-SAMPLE, optimistic | 13/20 (65%) | 19/20 (95%) | 20/20 (100%) |
| HELD-OUT `eval/unseen/heldout-queries.json` (14 queries, 4 repos never used before, different seed) | not looked at while fixing | 6/14 (43%) | not run | 11/14 (79%) |

Held-out breakdown (new, 24 files): doc-comment queries 4/4, identifier queries 7/10. Remaining 3 misses: `ky` `source/utils/delay.ts` and `type-guards.ts` (never fetched: no path word matched and the 24 slots went elsewhere) and `attrs` `src/attr/__init__.py` (fetched, but outscored by other chunks).

## Honest reading
- The trustworthy number is the held-out one: retrieval improved from 43% to 79% on repos the fix was not tuned on. The 100% dev number is inflated by tuning.
- The remaining failures are inherent to stateless path-based retrieval: if no path word matches, files are chosen by a prior and the rest of a large repo is never read. A real index (Postgres full-text over file contents, ADR-003) would fix this class; it was deliberately deferred and is the next retrieval step if these numbers matter.
- Queries are auto-derived proxies (doc comment or identifier words), not real user questions.
