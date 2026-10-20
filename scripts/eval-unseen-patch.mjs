#!/usr/bin/env node
// Patch-success benchmark on REAL fixes in UNSEEN repos. Usage: node scripts/eval-unseen-patch.mjs [maxCases=8] [topK=3]
// Validity protocol per case (cases failing any step are reported as INVALID, never as patch failures):
//   A. control: tests pass at the real fix commit            (proves the test command works offline in the sandbox)
//   B. bug:     tests FAIL at the parent commit with the fix's test files overlaid (proves the tests detect this bug)
// Then for the model's top-K findings (by severity, then model order; NOT chosen using ground truth):
//   repo-analyze -> repo-patch (inline parent file) -> apply -> run tests. Success = tests pass (pass@K); pass@1 = first candidate.
// Untrusted code runs ONLY in Docker (install with --ignore-scripts, tests with --network none). Host does git fetch/checkout only.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const MAX = Number(process.argv[2] ?? 8);
const K = Number(process.argv[3] ?? 3);
const NON_BUG_MSG = /lint|typo|mypy|\bdocs?\b|ci skip|python_requires|\bsemi\b|\bXO\b|fix\(test\)/i; // fix(test) = a test-only fix, not a runtime bug
const NON_RUNTIME_PATH = /\.d\.ts$/; // type definitions are not exercised by npm test
const cases = JSON.parse(readFileSync(join(root, 'eval/unseen/bugs.json'), 'utf8'))
  .filter((c) => c.lang === 'js' && c.testFiles.length && !NON_BUG_MSG.test(c.message) && !NON_RUNTIME_PATH.test(c.path)).slice(0, MAX);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Free-tier Groq has a small tokens-per-minute budget: pace analyses and patches (override with EVAL_PACE_MS)
const PACE = Number(process.env.EVAL_PACE_MS ?? 60_000);
const SEV = { high: 0, medium: 1, low: 2 };

async function fn(name, body) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!(r.status === 429 || String(d.llmStatus ?? '').startsWith('error_429')) || t === 3) return { status: r.status, d };
    await sleep(25_000);
  }
}

const docker = (args) => spawnSync('docker', args, { encoding: 'utf8', timeout: 900_000 });
const tail = (r) => ((r.stdout ?? '') + (r.stderr ?? '')).split('\n').slice(-12).join('\n');

const rows = [];
const T = { n: 0, invalid: 0, valid: 0, analysisFail: 0, localized: 0, pass1: 0, passK: 0, noPatch: 0 };

let streak = 0; // consecutive AI failures; 3 in a row = quota is gone, stop instead of burning retries
let aborted = false;
for (const c of cases) {
  if (streak >= 3) { aborted = true; break; }
  T.n++;
  const label = `${c.repo}@${c.fixSha.slice(0, 7)}`;
  const dir = mkdtempSync(join(tmpdir(), 'rp-real-'));
  const vol = `rp-real-nm-${Date.now()}`;
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', maxBuffer: 50_000_000 });
  const base = ['run', '--rm', '-v', `${resolve(dir)}:/work`, '-v', `${vol}:/work/node_modules`, '-w', '/work', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '512', '--memory', '2g'];
  const test = () => {
    const r = docker([...base, '--cpus', '2', '--network', 'none', 'node:22', 'sh', '-c', 'timeout 180 npm test']);
    return { passed: r.status === 0, out: tail(r) };
  };
  let reason = null;
  try {
    git('init', '-q'); git('remote', 'add', 'origin', `https://github.com/${c.repo}.git`);
    git('fetch', '-q', '--depth', '1', 'origin', c.fixSha); git('fetch', '-q', '--depth', '1', 'origin', c.parentSha);
    git('checkout', '-q', '-f', c.fixSha);
    if (!existsSync(join(dir, 'package.json'))) reason = 'no package.json';
    if (!reason) {
      const ins = docker([...base, '--cpus', '4', 'node:22', 'sh', '-c', 'npm install --ignore-scripts --no-audit --no-fund --no-package-lock']);
      if (ins.status !== 0) reason = 'npm install failed';
    }
    if (!reason && !test().passed) reason = 'control failed: tests do not pass at the real fix commit (offline sandbox)';
    if (!reason) {
      git('checkout', '-q', '-f', c.parentSha);
      for (const f of c.testFiles) git('checkout', c.fixSha, '--', f);
      if (test().passed) reason = 'tests do not fail at the buggy parent (overlay does not expose the bug)';
    }
  } catch (e) { reason = `git/docker error: ${String(e.message).split('\n')[0].slice(0, 80)}`; }

  if (reason) {
    T.invalid++;
    rows.push(`| ${label} | ${c.message.slice(0, 45)} | INVALID: ${reason} | - | - |`);
    docker(['volume', 'rm', '-f', vol]);
    continue;
  }
  T.valid++;

  // model side: uses only the buggy parent file, never the ground truth
  const parentText = execFileSync('git', ['show', `${c.parentSha}:${c.path}`], { cwd: dir, encoding: 'utf8', maxBuffer: 20_000_000 });
  const a = await fn('repo-analyze', { path: c.path, content: parentText, llm: true });
  await sleep(PACE);
  if (a.status !== 200 || a.d.llmStatus !== 'ok') { streak++; T.analysisFail++; rows.push(`| ${label} | ${c.message.slice(0, 45)} | AI analysis failed (${a.d.llmStatus ?? a.status}) | - | - |`); docker(['volume', 'rm', '-f', vol]); continue; }
  streak = 0;
  const findings = (a.d.findings ?? []).map((f, i) => ({ ...f, i })).sort((x, y) => (SEV[x.severity] ?? 3) - (SEV[y.severity] ?? 3) || x.i - y.i).slice(0, K);
  const near = (f) => c.buggyLines.some((l) => Math.abs(l - f.line) <= 3);
  const localized = (a.d.findings ?? []).some(near);
  if (localized) T.localized++;
  if (!findings.length) { T.noPatch++; rows.push(`| ${label} | ${c.message.slice(0, 45)} | no findings | - | - |`); docker(['volume', 'rm', '-f', vol]); continue; }

  const results = [];
  for (const f of findings) {
    const p = await fn('repo-patch', { path: c.path, content: parentText, line: f.line, title: f.title, rationale: f.rationale });
    await sleep(Math.round(PACE / 3));
    if (p.status !== 200) { results.push(`no patch (http ${p.status})`); continue; }
    git('checkout', c.parentSha, '--', c.path);
    const lines = readFileSync(join(dir, c.path), 'utf8').split('\n');
    const { startLine, endLine, newText } = p.d.edit;
    lines.splice(startLine - 1, endLine - startLine + 1, ...(newText === '' ? [] : newText.split('\n')));
    writeFileSync(join(dir, c.path), lines.join('\n'));
    const r = test();
    results.push(r.passed ? 'PASS' : 'fail');
  }
  const p1 = results[0] === 'PASS';
  const pK = results.includes('PASS');
  if (p1) T.pass1++;
  if (pK) T.passK++;
  rows.push(`| ${label} | ${c.message.slice(0, 45)} | ${localized ? 'localized' : 'missed'} | ${results.map((r, i) => `#${i + 1}:${r}`).join(' ')} | ${pK ? 'FIXED' : 'not fixed'} |`);
  docker(['volume', 'rm', '-f', vol]);
  console.error(`${label}: ${results.join(',')}`);
}

const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'n/a');
const md = `# Patch verification on real fixes in unseen repos (live, ${new Date().toISOString().slice(0, 10)})

Method: ${cases.length} real fix commits (JS repos, fix commit also changes tests; 2 of 11 eligible excluded by inspection before any model run: a test-only fix and a .d.ts types fix) from \`eval/unseen/bugs.json\`. A case is VALID only if (A) the project's tests pass at the real fix commit in the offline sandbox and (B) they fail at the buggy parent with the fix's test files overlaid. For valid cases the model sees only the buggy file; its top ${K} findings (severity order, not chosen with ground truth) each get a proposed patch, applied one at a time, tests re-run in Docker (install with --ignore-scripts, tests --network none). Re-run: \`node scripts/eval-unseen-patch.mjs ${MAX} ${K}\`.

| Case | Real fix | Localization | Patch candidates (tests) | Result |
|------|----------|--------------|--------------------------|--------|
${rows.join('\n')}

${aborted ? `> INCOMPLETE: stopped after 3 consecutive AI failures (free-tier quota); ${cases.length - T.n} case(s) not attempted.

` : ''}## Measured
- Cases attempted: ${T.n}; valid verification setups: ${T.valid}; INVALID (infrastructure/test-oracle problems, excluded from rates): ${T.invalid}
- Of valid cases: model analysis failed ${T.analysisFail}; no findings ${T.noPatch}
- Localization (any finding within +-3 lines of the real fix): ${pct(T.localized, T.valid - T.analysisFail)}
- Patch success pass@1 (first candidate makes the tests pass): ${pct(T.pass1, T.valid)}
- Patch success pass@${K} (any of top ${K} candidates makes the tests pass): ${pct(T.passK, T.valid)}

## Limits
Tiny sample; only JS projects with an offline-runnable \`npm test\`; dependency versions are resolved fresh (no lockfile) so some cases are invalid by design; passing the tests is not proof the patch is correct or complete; popular repos may be in the model's training data; a proposed patch that passes may still differ from the real fix.
`;
writeFileSync(join(root, 'docs/EVAL-UNSEEN-PATCH.md'), md);
console.log(md);
