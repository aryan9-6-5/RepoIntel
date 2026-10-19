#!/usr/bin/env node
// Live benchmark against the deployed functions. Usage: node scripts/eval.mjs [owner/repo]
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env (never printed). Writes docs/EVAL.md.
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
// Ground truth (verified by reading the files): query -> file that must appear among retrieved snippets.
const TARGETS = [
  {
    repo: 'aryan9-6-5/RepoIntel',
    retrieval: [
      ['rate limit banner low remaining', 'src/components/RateLimitBanner.tsx'],
      ['fetch github user and repositories', 'src/hooks/useGitHubApi.ts'],
      ['repository card display', 'src/components/RepoCard.tsx'],
      ['summarize repository with groq', 'supabase/functions/summarize-repo/index.ts'],
      ['filter and sort repositories', 'src/components/RepoFilters.tsx'],
      ['user profile component', 'src/components/UserProfile.tsx'],
    ],
    qa: [
      ['how does the rate limit banner decide to show', true],
      ['how are repositories fetched from github', true],
      ['how does this code implement blockchain consensus', false], // no evidence exists: must not be "grounded"
    ],
  },
  {
    repo: 'expressjs/express', // live HEAD at run time; paths verified 2026-10-19
    retrieval: [
      ['res.json send json response', 'lib/response.js'],
      ['res.redirect location header', 'lib/response.js'],
      ['res.cookie set cookie options', 'lib/response.js'],
      ['app.listen create http server', 'lib/application.js'],
      ['app.use mount middleware', 'lib/application.js'],
      ['View class template engine lookup', 'lib/view.js'],
    ],
    qa: [
      ['how does app.listen start the server', true],
      ['how does res.redirect set the location', true],
      ['how does this code implement blockchain consensus', false],
    ],
  },
];

async function call(name, body) {
  const t = Date.now();
  const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, ms: Date.now() - t, data: await r.json().catch(() => ({})) };
}

const rows = [];
let hits = 0, nRetrieval = 0, groundedOk = 0, nQa = 0, invalid = 0, rateErrors = 0;
const lat = [];
for (const { repo, retrieval, qa } of TARGETS) {
  for (const [query, expected] of retrieval) {
    const r = await call('repo-query', { repo, query });
    const found = (r.data.snippets ?? []).some((s) => s.path === expected);
    hits += found; nRetrieval++;
    lat.push(r.ms);
    rows.push(`| ${repo} | retrieval | ${query} | ${found ? 'HIT' : 'MISS'} | ${r.ms} ms |`);
  }
  for (const [query, answerable] of qa) {
    let r = await call('repo-query', { repo, query, ask: true });
    if (r.status === 429) { rateErrors++; await new Promise((res) => setTimeout(res, 25_000)); r = await call('repo-query', { repo, query, ask: true }); }
    const c = r.data.citations ?? { valid: [], invalid: [], grounded: false };
    invalid += c.invalid.length;
    const ok = answerable ? c.grounded : !c.grounded || /INSUFFICIENT/i.test(r.data.answer ?? '');
    groundedOk += ok; nQa++;
    lat.push(r.ms);
    rows.push(`| ${repo} | qa (${answerable ? 'answerable' : 'unanswerable'}) | ${query} | ${ok ? 'OK' : 'FAIL'} (valid ${c.valid.length}, invalid ${c.invalid.length}, http ${r.status}) | ${r.ms} ms |`);
  }
}
lat.sort((a, b) => a - b);
const md = `# Evaluation (live, ${new Date().toISOString().slice(0, 10)})

Targets: ${TARGETS.map((t) => t.repo).join(', ')} via deployed Supabase functions. Re-run: \`node scripts/eval.mjs\`.

| Repo | Type | Case | Result | Latency |
|------|------|------|--------|---------|
${rows.join('\n')}

## Metrics
- Retrieval hit@8 (expected file among returned snippets): ${hits}/${nRetrieval}
- Q&A correct behaviour (grounded when answerable, not grounded/INSUFFICIENT when not): ${groundedOk}/${nQa}
- Invalid (hallucinated) citations caught: ${invalid}
- Rate-limit (429) responses: ${rateErrors}
- Latency median / max: ${lat[Math.floor(lat.length / 2)]} ms / ${lat[lat.length - 1]} ms

## Limits of this benchmark
Small (${nRetrieval} retrieval + ${nQa} Q&A cases), two repositories (one small, one mid-size), labels written by the project author, single run (LLM output is non-deterministic). Static bug-check precision/recall is measured separately in \`supabase/functions/_shared/findings.test.ts\` on a 9-line seeded fixture and says nothing about real-world accuracy. Bug-finding and patch results are in \`docs/EVAL-BUGS.md\` (synthetic fixtures only).
`;
writeFileSync(new URL('../docs/EVAL.md', import.meta.url), md);
console.log(md);
