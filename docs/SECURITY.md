# Security and risk review (2026-10-19)

Scope: the deployed Supabase Edge Functions, the React app, local scripts. Free stack only.

## Controls in place (verified)
- Secrets: `GROQ_API_KEY`, `GITHUB_TOKEN`, `ALLOWED_ORIGINS` live in Supabase secrets; the bundle contains only the Supabase URL and publishable key (dist scanned for `gsk_`, `ghp_`, `service_role`: clean; git history scanned: clean).
- All functions: `verify_jwt = true` (no-auth call returned 401), CORS allowlist (disallowed Origin gets no CORS header), body size caps, input validation, sanitized errors (no upstream bodies/prompts), upstream timeouts.
- Untrusted repo content: framed as data in every prompt, never executed on hosted infra; viewer renders plain text; analyzed paths must be in the vetted tree (no arbitrary-URL fetch); inline `content` is size-capped and only analyzed.
- Citations are verified against retrieved text; model line numbers are validated against the file; patches are range/size-validated, never applied automatically.
- Patch verification only in local Docker: `--cap-drop ALL`, `no-new-privileges`, 1 GB, pids 256, CPU caps, `--network none` for test runs, install with `--ignore-scripts`, 120 s timeout.

## Rate limiting: limits that cannot be fully fixed on the free stack
- Limiter and caches are in-memory per edge isolate. Isolates are ephemeral and several can run concurrently, so an attacker can exceed the nominal 20 req/min/IP by spreading load. A global limiter needs shared state (Supabase Postgres table + atomic upsert is possible and free, but adds a DB call per request and a table to manage); not implemented.
- `x-forwarded-for` is the identity key; behind Supabase's gateway this is reasonable but spoofable if the platform does not overwrite it.
- Because JWT verification accepts the public publishable key, anyone who opens the site can call the functions; JWT is not authentication. Real per-user quotas would need Supabase Auth (free) and per-user rows.
- The Groq free tier is shared by all callers: one abuser can exhaust the quota for everyone (observed: HTTP 429 during our own benchmark runs). Mitigation is graceful degradation (UI discloses "AI rate limited"), not prevention.
- GitHub: unauthenticated 60 req/h is shared by all callers of an edge IP; set `GITHUB_TOKEN` (read-only, free) to raise to 5000/h; it is a credential and must stay a Supabase secret.

## npm audit (11 total, 2 in the production tree) after upgrading to Vite 6 / Vitest 4
- Dev/build-time only (not shipped): `braces`, `micromatch`, `fast-glob`, `chokidar`, `tailwindcss`, `postcss-selector-parser`, `postcss-nested`, `@tailwindcss/typography`, `tailwindcss-animate` (ReDoS/DoS on glob or selector parsing of our own source at build time). Fix requires Tailwind major migration; risk is low because inputs are our own files.
- Runtime: `react-router` / `react-router-dom` moderate (open redirect via backslash in `<Link>`/navigation). Our only links are static internal paths (`/`, `/import`) and no user-controlled `to` values, so the vulnerable path is not reachable today. Fix = v7 migration (breaking); deferred, tracked.
- Resolved this milestone: Vitest critical (tinypool/mocker), Vite path traversal, lodash, nanoid, picomatch.
- Tooling note: `@swc/core` is pinned to 1.13.5 because 1.16.x refuses to load on this Windows machine (cache-directory DACL check, fixable with env `SWC_NATIVE_BINDING_CACHE`); revisit when upgrading.

## Residual risks (accepted or open)
- LLM output can be wrong: findings are hypotheses; patches are unverified until the sandbox says otherwise (we measured a bad patch: slugify fixture twice).
- Prompt injection can still influence model text (not tools; the model has none). Worst case today is misleading text or a bad diff the user must review.
- Docker sandbox shares the host kernel; `--network none` and dropped caps reduce but do not eliminate container-escape risk. Do not run against hostile repos on a machine with sensitive data without a VM.
- Install step has network access (needed for `npm ci`); malicious packages could exfiltrate anything inside the container (only the repo copy). `--ignore-scripts` blocks install-time scripts but not code executed by the test command, which runs offline.
- No audit logging / abuse monitoring beyond Supabase function logs.
- Supabase Free projects pause after inactivity; the app is unavailable until restored.
