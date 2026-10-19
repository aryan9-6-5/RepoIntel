#!/usr/bin/env node
// Bug-finding + patch benchmark on eval/fixtures (seeded bugs, real tests). Usage: node scripts/eval-bugs.mjs [runs=1]
// Calls the deployed repo-analyze / repo-patch functions with inline content, then verifies patches in the Docker sandbox.
// Writes docs/EVAL-BUGS.md. Requires Docker and .env (never printed).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const runs = Number(process.argv[2] ?? 1);
const manifest = JSON.parse(readFileSync(join(root, 'eval/fixtures/manifest.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(name, body, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    const limited = r.status === 429 || String(data.llmStatus ?? '').startsWith('error_429');
    if (!limited || t === tries - 1) return { status: r.status, data };
    await sleep(25_000);
  }
}

const near = (line, [lo, hi]) => line >= lo - 1 && line <= hi + 1;
const rows = [];
const tot = { bugs: 0, localized: 0, findings: 0, relevant: 0, cleanFindings: 0, attempted: 0, fixed: 0, buggyFixtures: 0, staticTp: 0, staticFp: 0, staticFn: 0, apiFail: 0 };

for (let run = 1; run <= runs; run++) {
  for (const fx of manifest) {
    const dir = join(root, 'eval/fixtures', fx.fixture);
    const text = readFileSync(join(dir, fx.file), 'utf8');
    const a = await call('repo-analyze', { path: fx.file, content: text, llm: true });
    const findings = a.data.findings ?? [];
    if (a.status !== 200 || a.data.llmStatus !== 'ok') tot.apiFail++;
    await sleep(6_000);

    if (fx.fixture === 'insecure') {
      for (const bug of fx.bugs) {
        const hit = findings.some((f) => f.kind === 'static' && f.rule === bug.rule && f.line === bug.lines[0]);
        hit ? tot.staticTp++ : tot.staticFn++;
      }
      tot.staticFp += findings.filter((f) => f.kind === 'static' && !fx.bugs.some((b) => b.rule === f.rule && b.lines[0] === f.line)).length;
      rows.push(`| ${run} | ${fx.fixture} | static: ${findings.filter((f) => f.kind === 'static').length} findings | - | - |`);
      continue;
    }
    if (fx.bugs.length === 0) {
      tot.cleanFindings += findings.length;
      rows.push(`| ${run} | ${fx.fixture} (no bug) | ${findings.length} findings (all false positives) | - | - |`);
      continue;
    }

    tot.buggyFixtures++;
    tot.bugs += fx.bugs.length;
    const relevant = findings.filter((f) => fx.bugs.some((b) => near(f.line, b.lines)));
    tot.findings += findings.length;
    tot.relevant += relevant.length;
    const localized = relevant.length > 0;
    if (localized) tot.localized++;

    let patchCell = '-';
    let verdict = '-';
    if (localized) {
      tot.attempted++;
      const f = relevant[0];
      const p = await call('repo-patch', { path: fx.file, content: text, line: f.line, title: f.title, rationale: f.rationale });
      await sleep(6_000);
      if (p.status === 200) {
        const pf = join(mkdtempSync(join(tmpdir(), 'rp-patch-')), 'patch.json');
        writeFileSync(pf, JSON.stringify({ path: fx.file, edit: p.data.edit }));
        const v = spawnSync('node', [join(root, 'scripts/verify-patch.mjs'), '--local', dir, pf, 'npm test'], { encoding: 'utf8', timeout: 600_000 });
        try { verdict = JSON.parse(v.stdout).verdict; } catch { verdict = 'verify-error'; }
        if (verdict === 'fixes-failing-tests') tot.fixed++;
        patchCell = `lines ${p.data.edit.startLine}-${p.data.edit.endLine}`;
      } else patchCell = `no patch (http ${p.status}: ${p.data.error ?? ''})`;
    }
    rows.push(`| ${run} | ${fx.fixture} | ${localized ? 'localized' : 'MISSED'} (${findings.length} findings, ${relevant.length} near bug) | ${patchCell} | ${verdict} |`);
  }
}

const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'n/a');
const md = `# Bug-finding and patch benchmark (live, ${new Date().toISOString().slice(0, 10)}, ${runs} run${runs > 1 ? 's' : ''})

Fixtures: \`eval/fixtures/*\` (4 buggy functions with real failing tests, 1 clean control, 1 insecure-pattern file). Re-run: \`node scripts/eval-bugs.mjs [runs]\`.
Localization = at least one finding within +-1 line of the seeded bug. Patch success = the sandboxed test suite goes from failing to passing (Docker, no network).

| Run | Fixture | Localization | Proposed edit | Sandbox verdict |
|-----|---------|--------------|---------------|-----------------|
${rows.join('\n')}

## Measured
- Bug localization (buggy fixtures): ${pct(tot.localized, tot.buggyFixtures * 1 && tot.buggyFixtures)}
- Finding precision on buggy fixtures (findings near a seeded bug / all findings): ${pct(tot.relevant, tot.findings)}
- False positives on the clean control: ${tot.cleanFindings} finding(s) across ${runs} run(s)
- Patch success, given localization (failing -> passing): ${pct(tot.fixed, tot.attempted)}
- End-to-end success (buggy fixtures fixed / all buggy fixture attempts): ${pct(tot.fixed, tot.buggyFixtures)}
- Static rules on the insecure file: ${tot.staticTp} TP, ${tot.staticFp} FP, ${tot.staticFn} FN
- Analyses where the AI step did not complete OK (429/unparseable/error): ${tot.apiFail}

## Limits
Tiny, synthetic, single-function bugs written by the project author; the model sees one file only; ${runs} run(s) of a non-deterministic model. These numbers do not predict performance on real repositories. Findings the model reports outside the seeded bug count as non-precise here even if they are legitimate observations.
`;
writeFileSync(join(root, 'docs/EVAL-BUGS.md'), md);
console.log(md);
