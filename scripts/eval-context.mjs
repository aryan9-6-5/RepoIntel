#!/usr/bin/env node
// A/B: does import context improve bug localization on cross-file bugs? Usage: node scripts/eval-context.mjs [runs=4]
// Fixtures with a "context" list in eval/fixtures/manifest.json; each run analyzes the target file WITH and WITHOUT context.
// Localization only (+-1 line of the seeded bug). Writes docs/EVAL-CONTEXT.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const runs = Number(process.argv[2] ?? 4);
const fixtures = JSON.parse(readFileSync(join(root, 'eval/fixtures/manifest.json'), 'utf8')).filter((f) => f.context?.length);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function analyze(body) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/repo-analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!(r.status === 429 || String(d.llmStatus ?? '').startsWith('error_429')) || t === 3) return d;
    await sleep(25_000);
  }
}

const tally = { with: { hit: 0, n: 0, findings: 0, near: 0 }, without: { hit: 0, n: 0, findings: 0, near: 0 } };
const rows = [];
for (const fx of fixtures) {
  const dir = join(root, 'eval/fixtures', fx.fixture);
  const content = readFileSync(join(dir, fx.file), 'utf8');
  const context = fx.context.map((p) => ({ path: p, content: readFileSync(join(dir, p), 'utf8') }));
  for (let run = 1; run <= runs; run++) {
    const cells = [];
    for (const mode of ['without', 'with']) {
      const d = await analyze({ path: fx.file, content, llm: true, context: mode === 'with' ? context : false });
      await sleep(5_000);
      const t = tally[mode];
      const f = d.findings ?? [];
      const near = f.filter((x) => fx.bugs.some((b) => x.line >= b.lines[0] - 1 && x.line <= b.lines[1] + 1));
      if (d.llmStatus === 'ok') { t.n++; t.findings += f.length; t.near += near.length; if (near.length) t.hit++; }
      cells.push(d.llmStatus === 'ok' ? (near.length ? `hit (${f.length}f)` : `MISS (${f.length}f)`) : `AI fail ${d.llmStatus}`);
    }
    rows.push(`| ${fx.fixture} | ${run} | ${cells[0]} | ${cells[1]} |`);
  }
}
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'n/a');
const md = `# Cross-file context A/B (live, ${new Date().toISOString().slice(0, 10)}, ${runs} runs per fixture)

Fixtures (two guessable from names alone, two that genuinely need the imported file): ${fixtures.map((f) => f.fixture).join(', ')} (bug only visible by reading the imported file). Re-run: \`node scripts/eval-context.mjs\`.

| Fixture | Run | Without context | With imported file as context |
|---------|-----|-----------------|-------------------------------|
${rows.join('\n')}

## Measured
- Localization without context: ${pct(tally.without.hit, tally.without.n)}; precision ${pct(tally.without.near, tally.without.findings)}
- Localization with context: ${pct(tally.with.hit, tally.with.n)}; precision ${pct(tally.with.near, tally.with.findings)}

## Limits
Four tiny synthetic cross-file bugs (n=16 per arm; one extra hit is within noise) written by the project author; one-hop imports only; results from a non-deterministic model. Shows whether context can help, not by how much on real code. Context adds prompt tokens (up to 3 files x 120 lines) per analysis, which counts against the free Groq quota.
`;
writeFileSync(join(root, 'docs/EVAL-CONTEXT.md'), md);
console.log(md);
