# Testing

Status: Vitest installed (Phase 1).

## Tools
Vitest (+ jsdom for components) for frontend/pure logic; `deno test` for edge-function handlers;
recorded JSON fixtures for GitHub responses; Groq mocked.

## Commands (current)
```
npx tsc -p tsconfig.app.json --noEmit
npm run lint      # currently 5 errors (pre-existing, see PROGRESS.md)
npm run build
```
`npm test` (Vitest, 30 tests, mocked network). Planned: `deno test` for handlers; live smoke tests are manual.

## Critical workflows
Repo URL parsing; file filtering (binary/vendored/generated/oversize); limit enforcement; GitHub 403/404/429
handling; chunking line-number accuracy; retrieval ranking reproducibility; citation validation (every cited
path:line exists in stored content); prompt-injection fixtures (repo text saying "ignore instructions").

## Security checks
No secrets in client bundle (`grep` dist for `gsk_`, `ghp_`); request-size rejection; CORS/JWT behavior;
rate-limit behavior; error bodies contain no upstream details.

## Known-defect reproduction
Lint errors: `npm run lint`. Open Groq proxy (S1): POST to function URL without Authorization header succeeds
while `verify_jwt=false` (manual, do not run against production without approval).

## Release checks
tsc, lint, tests, build, bundle secret scan, git-history secret review, manual smoke of profile + repo flows.
Eval: node scripts\/eval.mjs (live) -> docs\/EVAL.md. Patch sandbox: scripts\/verify-patch.mjs.
