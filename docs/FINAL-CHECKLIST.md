# RepoPilot final checklist (2026-10-21)

Status words: PASS = criterion met and verified with evidence; PARTIAL = built but limited or only partly verified; BLOCKED = needs an owner action. Percentages are my estimates; numbers in the evidence column were measured. DEV = data used while fixing; HELD-OUT = not tuned on.

## Roadmap phases
| Phase | Status | Evidence | Gap |
|-------|--------|----------|-----|
| 0 Audit and foundation | PASS | docs/PROGRESS.md baseline, 7 doc files, ADRs | none |
| 1 Hardening and ingestion | PASS | live: 401 without JWT on all 6 functions, CORS allowlist, input caps, sanitized errors; 26/26 security probes | none |
| 2 Indexing and retrieval | PARTIAL | HELD-OUT file hit 43% -> 79% after ranker fix (offline); deployed; staleness warning in UI | no full-text index: 3 of 14 held-out queries still miss |
| 3 Grounded explorer | PASS | live e2e: 8/8 snippets byte-identical to GitHub, Q&A 3/3 citations independently confirmed, 0 invalid citations in any run; tree, viewer, summary, "Inference" labelling | Q&A quality after the latest prompt change: see held-out Q&A result below |
| 4 Bug findings | PARTIAL | findings carry severity, confidence, evidence, reproduction hint, kind (pattern vs unverified hypothesis); HELD-OUT real fixes: localization 11/22 (50%), precision 15/68 (22%) | weak accuracy on real bugs |
| 5 Patch and safe verification | PARTIAL | process criteria met (reviewable diff, Docker with no network, never auto-applied, real test results); HELD-OUT real repos: 6/6 valid setups, patch success 0/6 | patches do not fix real bugs; synthetic fixtures 6/8 do not generalize |
| 6 Evaluation and cost control | PASS | metrics defined and measured on dev and held-out sets; token, latency, quota and model reported per call; answer cache; Groq 429 fallback; global rate limit verified (exactly 20 of 60 concurrent requests allowed) | none for the criteria; quality numbers are the weak part |
| 7 Production readiness | PARTIAL | fresh `npm ci` from a clean copy passes; 62 tests, tsc, lint 0 errors, build; axe 0 violations after fixes; CSP tested with 0 violations; deploy and rollback docs | no frontend deployed (owner), no real screen-reader test (owner), react-router v7 and Tailwind upgrades not done |

## Test and benchmark results (actual)
- Unit tests 62/62, `tsc` 0 errors, lint 0 errors (10 warnings), build OK, no secrets in the change set or `dist/`.
- Live after deploy: e2e smoke 6/6; security probes 26/26 (prompt injection obeyed 0/3, small sample).
- Retrieval: LIVE before fix 13/20 (65%); OFFLINE after fix DEV 100% (in-sample, optimistic), HELD-OUT 79%.
- Real bug localization (HELD-OUT, unseen repos, 22 completed cases, 1 run): 50%, precision 22%. On the earlier DEV repos (8 cases): 81% / 28% (optimistic).
- Real patch verification (HELD-OUT): 0/6 fixed (pass@3), localization 3/5.
- Synthetic fixtures (DEV, authored by us): localization 8/8, patch success 6/8.

## Deployment status
- Supabase project hftgejaodmbmuvsqspon: 6 functions ACTIVE, JWT on, rate-limit migration applied and enforced, secrets GROQ_API_KEY and ALLOWED_ORIGINS set (GEMINI_API_KEY removed by the owner).
- Deployed 2026-10-21: repo-query v21, repo-analyze v12, repo-patch v9, repo-overview v6.
- Git: 5 commits ahead of origin/main, NOT pushed. Frontend: not deployed (no production site).

## Remaining items and who acts
| Item | Owner |
|------|-------|
| Push commits to GitHub | owner says "push" |
| Deploy frontend on Vercel and give the URL (then set ALLOWED_ORIGINS) | owner, then me |
| Real screen-reader pass of /import | owner |
| Decide on a database full-text index (needs a migration) | owner |
| react-router v7 and Tailwind upgrades (clear remaining audit findings) | me, on request |
| Improve real-bug accuracy (stronger model, multi-file reasoning, test-guided patching) | open-ended; limited by Groq free tier (8,000 tokens/min) |

## Not claimed
No claim of 100% completion. Real-bug finding and patching are not reliable yet; results above are small samples on popular public repos (possible training contamination).
