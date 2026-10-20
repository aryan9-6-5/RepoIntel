#!/usr/bin/env node
// Real-bug localization benchmark. Usage: node scripts/eval-real.mjs [runs=2] [dataset.json] [report.md]
// Cases: eval/real-bugs.json (frozen real fix commits). The model sees the PRE-fix file only; a case is
// "localized" when a finding lands within +-TOL lines of a line the real fix changed. Writes docs/EVAL-REAL.md.
import { readFileSync, writeFileSync } from 'node:fs';

const TOL = 3;
const NON_BUG_MSG = /lint|typo|mypy|\bdocs?\b|ci skip|python_requires|\bsemi\b|\bXO\b/i;
const NON_BUG_PATH = /(eslintrc|sandbox|benchmark|build-site|setup\.py|(^|\/)scripts\/)/i;

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const DATASET = process.argv[3] ?? 'eval/real-bugs.json';
const REPORT = process.argv[4] ?? 'docs/EVAL-REAL.md';
const all = JSON.parse(readFileSync(new URL(`../${DATASET}`, import.meta.url), 'utf8'));
const cases = all.filter((c) => !NON_BUG_MSG.test(c.message) && !NON_BUG_PATH.test(c.path));
const runs = Number(process.argv[2] ?? 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Free-tier Groq has a small tokens-per-minute budget: one 400-line analysis uses most of it, so pace calls (override with EVAL_PACE_MS)
const PACE = Number(process.env.EVAL_PACE_MS ?? 60_000);

async function analyze(body) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/repo-analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!(r.status === 429 || String(d.llmStatus ?? '').startsWith('error_429')) || t === 3) return { status: r.status, d };
    await sleep(25_000);
  }
}

const rows = [];
const T = { n: 0, localized: 0, findings: 0, near: 0, ok: 0, aiFail: 0, sizes: [] };
const dist = (f, lines) => Math.min(...lines.map((l) => Math.abs(l - f.line)));

let streak = 0; // consecutive AI failures; 3 in a row = quota is gone, stop instead of burning retries
let aborted = false;
for (let run = 1; run <= runs && !aborted; run++) {
  for (const c of cases) {
    if (streak >= 3) { aborted = true; break; }
    const raw = await (await fetch(`https://raw.githubusercontent.com/${c.repo}/${c.parentSha}/${c.path}`)).text();
    const { status, d } = await analyze({ path: c.path, content: raw, llm: true });
    await sleep(PACE);
    T.n++;
    if (status !== 200 || d.llmStatus !== 'ok') { streak++; T.aiFail++; rows.push(`| ${run} | ${c.repo}/${c.path} | AI step failed (${d.llmStatus ?? status}) | - |`); continue; }
    streak = 0;
    T.ok++;
    const f = d.findings ?? [];
    const near = f.filter((x) => dist(x, c.buggyLines) <= TOL);
    T.findings += f.length; T.near += near.length;
    if (near.length) T.localized++;
    rows.push(`| ${run} | ${c.repo}/${c.path} (fix lines ${c.buggyLines.slice(0, 4).join(',')}) | ${near.length ? 'localized' : 'MISSED'} (${f.length} findings, ${near.length} near) | ${c.message.slice(0, 55)} |`);
  }
}
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'n/a');
const md = `# Real-bug localization benchmark (live, ${new Date().toISOString().slice(0, 10)}, ${runs} runs)

Source: ${cases.length} real bug-fix commits from ${new Set(cases.map((c) => c.repo)).size} public repos (frozen in \`${DATASET}\`; ${all.length - cases.length} of ${all.length} collected commits excluded *before* running by a fixed non-bug rule: config/lint/typo/doc/build/bench paths or messages). The model sees only the pre-fix file; ground truth = lines the real fix changed; "localized" = a finding within +-${TOL} lines. Re-run: \`node scripts/eval-real.mjs ${runs} ${DATASET} ${REPORT}\`.

| Run | File | Result | Fix commit message |
|-----|------|--------|--------------------|
${rows.join('\n')}

${aborted ? `> INCOMPLETE: stopped after 3 consecutive AI failures (free-tier quota). Only ${T.n} analyses were attempted; numbers below cover completed ones only.

` : ''}## Measured
- Localization (analyses where the AI step completed): ${pct(T.localized, T.ok)}
- Finding precision (findings within +-${TOL} lines of a real fixed line / all findings): ${pct(T.near, T.findings)}
- Findings per file (mean): ${T.ok ? (T.findings / T.ok).toFixed(1) : 'n/a'}
- AI step failed (429/unparseable): ${T.aiFail} of ${T.n}

## Limits (read before quoting any number)
- Very small sample (${cases.length} distinct cases); a few cases move the percentage by double digits.
- Popular public repos: the model may have seen these fixes in training (possible contamination), so scores may be inflated.
- A real fix often changes lines far from the "root cause" a reviewer would point at; finding near the fix is not the same as understanding the bug. Findings elsewhere in the file may be valid issues but count as misses here.
- Only localization is measured: no patch success on real repos (their tests were not run).
- Single file visible to the model; fixes that depend on other files are unfair misses.
`;
writeFileSync(new URL(`../${REPORT}`, import.meta.url), md);
console.log(md);
