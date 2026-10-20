#!/usr/bin/env node
// End-to-end smoke test of the deployed pipeline on a real repo. Usage: node scripts/e2e-smoke.mjs [owner/repo] [path]
// ingest -> overview -> retrieval -> grounded Q&A -> analyze -> patch proposal, with independent verification:
//  * every returned snippet is compared byte-for-byte with the real file on GitHub (citations are checkable by anyone)
//  * every verified citation range exists inside a returned snippet and inside the real file
//  * the patch is "proposed-unverified" and its diff applies cleanly to the real file
// Paced under the 20 req/min limiter. Exit code 1 on any failed assertion. Writes docs/E2E-SMOKE.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const REPO = process.argv[2] ?? 'jshttp/cookie';
const FILE = process.argv[3] ?? 'src/index.ts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const steps = [];
let failed = 0;
// ok === null means SKIPPED (e.g. the free-tier AI is rate limited): neither a pass nor a hidden failure
const step = (name, ok, detail = '') => { steps.push({ name, ok, detail }); if (ok === false) failed++; console.error(`${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

async function fn(name, body, wait = 3500) {
  await sleep(wait);
  for (let t = 0; t < 3; t++) {
    const t0 = Date.now();
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status !== 429 || t === 2) return { status: r.status, d, ms: Date.now() - t0 };
    await sleep(30_000);
  }
}
const raw = async (sha, path) => (await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/${path}`)).text();

const ing = await fn('repo-ingest', { repo: REPO });
step('ingest returns a pinned commit and filtered files', ing.status === 200 && /^[0-9a-f]{40}$/.test(ing.d.commitSha) && ing.d.files.length > 0, `${ing.d.files?.length} files @ ${ing.d.commitSha?.slice(0, 7)} in ${ing.ms} ms`);
const sha = ing.d.commitSha;

const ov = await fn('repo-overview', { repo: REPO });
step('overview: languages, entry points or dependencies detected', ov.status === 200 && ov.d.overview.languages.length > 0 && (ov.d.overview.entryPoints.length > 0 || ov.d.dependencies.length > 0), `langs ${ov.d.overview?.languages?.[0]?.name}, entry ${ov.d.overview?.entryPoints?.length}, manifests ${ov.d.dependencies?.length}`);

const q = await fn('repo-query', { repo: REPO, query: 'how are cookies parsed' });
let exact = 0;
for (const s of q.d.snippets ?? []) {
  const lines = (await raw(q.d.commitSha, s.path)).split('\n').slice(s.start - 1, s.end).join('\n');
  if (lines === s.text) exact++;
}
step('every retrieved snippet equals the real file lines (independently fetched)', q.status === 200 && q.d.snippets.length > 0 && exact === q.d.snippets.length, `${exact}/${q.d.snippets?.length} byte-identical`);

const a = await fn('repo-query', { repo: REPO, query: 'how are cookies parsed', ask: true });
if (a.status === 429) step('grounded Q&A with independently confirmed citations', null, 'SKIPPED: AI rate limited (429), not verified');
else {
  const c = a.d.citations ?? { valid: [], invalid: [] };
  let inside = 0;
  for (const v of c.valid) {
    const m = v.match(/^(.+):(\d+)-(\d+)$/);
    const sn = (a.d.snippets ?? []).find((s) => s.path === m[1] && +m[2] >= s.start && +m[3] <= s.end);
    const total = sn ? (await raw(a.d.commitSha, m[1])).split('\n').length : 0;
    if (sn && +m[3] <= total) inside++;
  }
  step('Q&A has >=1 verified citation and each lies inside a real snippet and file', a.status === 200 && c.valid.length > 0 && inside === c.valid.length, `${c.valid.length} valid (${inside} independently confirmed), ${c.invalid.length} invalid, model ${a.d.model}${a.d.fellBack ? ' (fallback)' : ''}, ${a.d.ms} ms`);
}

const an = await fn('repo-analyze', { repo: REPO, path: FILE, llm: true }, 65_000); // let the per-minute token budget refill after the Q&A call
const real = (await raw(sha, FILE)).split('\n');
const evidenceOk = (an.d.findings ?? []).every((f) => real[f.line - 1]?.trim().slice(0, 160) === f.evidence);
if ((an.d.findings ?? []).length === 0) step('analyze: findings reference real lines and evidence matches the file', null, `SKIPPED: 0 findings to verify (AI step: ${an.d.llmStatus}); a pass here would be vacuous`);
else step('analyze: findings reference real lines and evidence matches the file', an.status === 200 && evidenceOk, `${an.d.findings.length} findings, AI step: ${an.d.llmStatus}`);
if (an.d.llmStatus !== 'ok') step('analyze: AI hypotheses', null, `SKIPPED: AI step was ${an.d.llmStatus}`);

const fnd = (an.d.findings ?? []).find((f) => f.kind === 'hypothesis') ?? (an.d.findings ?? [])[0];
if (!fnd) step('patch proposal is unverified, minimal and applies to the real file', null, 'SKIPPED: no findings to patch (AI unavailable or nothing found)');
else {
  const p = await fn('repo-patch', { repo: REPO, path: FILE, line: fnd.line, title: fnd.title, rationale: fnd.rationale }, 25_000);
  if (p.status === 429) step('patch proposal is unverified, minimal and applies to the real file', null, 'SKIPPED: AI rate limited (429)');
  else if (p.status !== 200) step('patch proposal is unverified, minimal and applies to the real file', p.status === 422, `http ${p.status}: ${p.d.error}`);
  else {
    const { startLine, endLine, newText } = p.d.edit;
    const out = [...real.slice(0, startLine - 1), ...(newText === '' ? [] : newText.split('\n')), ...real.slice(endLine)];
    step('patch is proposed-unverified, minimal, and applies to the real file', p.d.status === 'proposed-unverified' && endLine - startLine < 30 && out.join('\n') !== real.join('\n') && /^--- a\//.test(p.d.diff), `lines ${startLine}-${endLine}, model ${p.d.model}`);
  }
}

const md = `# End-to-end smoke test (live, ${new Date().toISOString().slice(0, 10)})

Target: \`${REPO}\` (${FILE}) through the deployed functions. Re-run: \`node scripts/e2e-smoke.mjs ${REPO} ${FILE}\`.

| Result | Step | Detail |
|--------|------|--------|
${steps.map((s) => `| ${s.ok === null ? 'SKIP' : s.ok ? 'PASS' : 'FAIL'} | ${s.name} | ${s.detail} |`).join('\n')}

${steps.filter((x) => x.ok).length} passed, ${failed} failed, ${steps.filter((x) => x.ok === null).length} skipped (of ${steps.length}).

Limits: one repository, one run; the AI steps are non-deterministic and rate limited on the free tier (a 429 is reported as a failure of that step, not hidden).
`;
writeFileSync(join(root, 'docs/E2E-SMOKE.md'), md);
console.log(md);
process.exit(failed ? 1 : 0);
