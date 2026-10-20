# Deployment and rollback (free stack)

Nothing here needs a paid plan or card. Do each step only with the owner's approval; commands change production.

## One-time backend setup (Supabase project `hftgejaodmbmuvsqspon`, Free plan)
1. Secrets (never in git or `VITE_*`):
   `npx supabase secrets set GROQ_API_KEY=... ALLOWED_ORIGINS=https://<your-site>,http://localhost:8080 --project-ref <ref>`
   Optional: `GITHUB_TOKEN=<read-only fine-grained token>` (raises GitHub quota 60 -> 5000/h).
2. Global rate limit table (additive, reversible): `npx supabase db push --project-ref <ref>` (if the CLI fails with a login-role permission error, run the SQL file in the dashboard SQL editor instead; the migration is idempotent)
   Applies `supabase/migrations/20261019000000_rate_limits.sql`. Rollback: `drop function public.rl_hit(text,int,int); drop table public.rate_limits;`
   Until applied, functions log `rl_hit http 404` and fall back to per-instance limiting (fail-open).
3. Functions: `for f in summarize-repo repo-ingest repo-query repo-analyze repo-patch repo-overview; do npx supabase functions deploy $f --project-ref <ref>; done`
   `verify_jwt = true` is set in `supabase/config.toml`; the browser sends the publishable key automatically.

## Frontend (Vercel Hobby, non-commercial use)
- Framework preset: Vite. Build `npm run build`, output `dist`. `vercel.json` provides the SPA rewrite (deep links like `/?analyze=owner/repo` survive refresh) and security headers (CSP, nosniff, HSTS, frame-ancestors none).
- Env vars in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- Order matters: set `ALLOWED_ORIGINS` to the Vercel URL BEFORE the first visit, otherwise every API call is blocked by CORS.
- If you add another origin/API to the frontend, extend `connect-src` in `vercel.json` or the browser will block it (tested locally: no CSP violations for `/` and `/import`).

## Rollback
- Frontend: Vercel dashboard -> Deployments -> promote the previous deployment (instant).
- Functions: redeploy the previous commit's version (`git checkout <sha> -- supabase/functions && npx supabase functions deploy <name>`); function versions are also listed in the Supabase dashboard.
- DB: use the drop statements above. No data other than counters is stored.
- Secrets: re-run `secrets set` with the old value; list with `npx supabase secrets list` (values are hashed).

## Free-tier operational limits (will bite)
- Supabase Free pauses a project after inactivity: every call fails until restored in the dashboard.
- Groq free tier returns HTTP 429 under load; the UI says "AI rate limited" and still shows pattern checks and retrieval.
- GitHub unauthenticated quota is shared per edge IP; set `GITHUB_TOKEN`.
- Vercel Hobby terms prohibit commercial use.

## Pre-release checklist
`npx tsc -p tsconfig.app.json --noEmit` - `npm run lint` - `npm test` - `npm run build` - secret scan of `git ls-files` and `dist/` (`gsk_`, `ghp_`, `service_role`) - `node scripts/eval.mjs` (live) - open `/` and `/import` on the built app.

## Live deployment (2026-10-21)
- Frontend: https://repointel-rho.vercel.app (Vercel Hobby, project `repointel`, account aryan9-6-5, production deploy from the local working tree via `npx vercel deploy --prod --yes --build-env VITE_SUPABASE_URL=... --build-env VITE_SUPABASE_PUBLISHABLE_KEY=...`; only those two public values were passed). The folder is linked through `.vercel/` (gitignored).
- Supabase `ALLOWED_ORIGINS` = `http://localhost:8080,http://localhost:5173,https://repointel-rho.vercel.app`. Any new frontend origin (custom domain, preview URL) must be added there or its API calls are blocked by CORS.
- To redeploy: run the same command from the repo root. To connect Git auto-deploys later, set the two `VITE_*` variables in the Vercel project settings first.
- Verified live: `/` and `/import` return 200 with the CSP/HSTS/nosniff headers; `/import` import + file viewer + grounded Q&A work; `/` finds 29 repos with avatars; 0 CSP violations; CORS allows the live origin and rejects others.

## WARNING: Git pushes deploy automatically (found 2026-10-21)
The Vercel project is connected to the GitHub repo, so every push to `main` builds and deploys production. The project now has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` stored as environment variables (production and preview, added 2026-10-21); they are required (Vercel dashboard > Settings > Environment Variables, or `vercel env add`), otherwise the Git build ships without them and the site is blank (`supabaseUrl is required`). CLI deploys with `--build-env` do not store them. Always re-verify the live site after a push.
