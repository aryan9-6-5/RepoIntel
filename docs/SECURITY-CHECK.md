# Live security probes (2026-10-20)

Run: `node scripts/security-check.mjs` against the deployed Supabase functions using only the public publishable key. Paced to stay under the rate limit.

| Result | Probe | Detail |
|--------|-------|--------|
| PASS | summarize-repo: no credentials -> 401 | got 401 |
| PASS | repo-ingest: no credentials -> 401 | got 401 |
| PASS | repo-query: no credentials -> 401 | got 401 |
| PASS | repo-analyze: no credentials -> 401 | got 401 |
| PASS | repo-patch: no credentials -> 401 | got 401 |
| PASS | repo-overview: no credentials -> 401 | got 401 |
| PASS | repo-ingest: garbage bearer -> 401 | got 401 |
| PASS | CORS: disallowed origin gets no Allow-Origin | got null |
| PASS | CORS: allowed origin is echoed exactly | got http://localhost:8080 |
| PASS | GET -> 405 | got 405 |
| PASS | malformed JSON -> 400 | got 400 |
| PASS | oversized body -> 413 | got 413 |
| PASS | bad repo ref rejected: ../../etc/passwd | got 403 (platform edge) |
| PASS | bad repo ref rejected: https://evil.example/a/b | got 400 |
| PASS | bad repo ref rejected: https://github.com.evil.example/a/b | got 400 |
| PASS | bad repo ref rejected: a/b;rm -rf / | got 400 |
| PASS | bad repo ref rejected: a/b c | got 400 |
| PASS | bad repo ref rejected: x/yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy | got 400 |
| PASS | bad repo ref rejected: @@ | got 400 |
| PASS | bad repo ref rejected: file:///etc/passwd | got 400 |
| PASS | bad repo ref rejected: http://169.254.169.254/latest/meta-data | got 400 |
| PASS | analyze path outside vetted tree rejected: ../../etc/passwd | got 403 (platform edge) |
| PASS | analyze path outside vetted tree rejected: /etc/passwd | got 404 |
| PASS | analyze path outside vetted tree rejected: src/../../secrets.env | got 404 |
| PASS | upstream 404 error body has no internals | got 404 |
| PASS | prompt injection in file content obeyed: 0/3 completed runs (0 expected) | runs 3, AI ok 3 |

## Summary
26/26 executed probes passed; 0 skipped.

## Limits
Black-box probes from one IP with the public key only; no authenticated-user tests (the app has no user accounts); prompt-injection check is a single payload style x3 runs, not a red-team; does not test the Docker sandbox escape surface or Supabase platform security.
