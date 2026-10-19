#!/usr/bin/env node
// Build eval/real-bugs.json from real bug-fix commits (read-only GitHub API via the local `gh` CLI).
// A case = commit whose message starts with "fix", touching exactly ONE source file with a small diff.
// Ground truth = the pre-fix lines the fix deleted/changed (for pure additions: the line the fix inserts before).
// Re-run only to refresh the dataset; eval-real.mjs reads the frozen JSON so results stay reproducible.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const REPOS = [
  'expressjs/express', 'axios/axios', 'lodash/lodash', 'sindresorhus/got', 'psf/requests',
  'pallets/flask', 'pallets/click', 'tj/commander.js', 'chalk/chalk', 'uuidjs/uuid',
];
const PER_REPO = 4;
const PAGES = 6;
const EXT = /\.(js|mjs|ts|py)$/;
const SKIP = /(^|\/)(test|tests|__tests__|spec|docs?|examples?)\//i;

const gh = (path) => {
  const r = spawnSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 20_000_000 });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
};

/** Pre-fix line numbers touched by a unified-diff patch. */
function oldLines(patch) {
  const out = [];
  let old = 0;
  for (const l of patch.split('\n')) {
    const h = l.match(/^@@ -(\d+)(?:,\d+)? \+\d+/);
    if (h) { old = +h[1]; continue; }
    if (l.startsWith('-')) out.push(old++);
    else if (l.startsWith('+')) { if (!out.includes(old)) out.push(old); }
    else if (!l.startsWith('\\')) old++;
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

const cases = [];
for (const repo of REPOS) {
  let n = 0;
  for (let page = 1; page <= PAGES && n < PER_REPO; page++) {
  const list = gh(`repos/${repo}/commits?per_page=100&page=${page}`);
  for (const c of list ?? []) {
    if (n >= PER_REPO) break;
    if (!/^fix/i.test(c.commit.message.split('\n')[0]) || c.parents?.length !== 1) continue;
    const d = gh(`repos/${repo}/commits/${c.sha}`);
    if (!d || d.files?.length !== 1) continue;
    const f = d.files[0];
    if (!EXT.test(f.filename) || SKIP.test(f.filename) || f.status !== 'modified' || !f.patch) continue;
    if (f.additions + f.deletions < 1 || f.additions + f.deletions > 14) continue;
    const lines = oldLines(f.patch);
    if (!lines.length) continue;
    const raw = spawnSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/contents/${f.filename}?ref=${c.parents[0].sha}`], { encoding: 'utf8', maxBuffer: 20_000_000 });
    if (raw.status !== 0) continue;
    const total = raw.stdout.split('\n').length;
    if (total > 400 || total < 15 || lines[lines.length - 1] > 400) continue;
    cases.push({
      repo, fixSha: c.sha, parentSha: c.parents[0].sha, path: f.filename,
      message: c.commit.message.split('\n')[0].slice(0, 120), buggyLines: lines, fileLines: total,
    });
    n++;
    console.error(`+ ${repo} ${f.filename} ${lines.join(',')}`);
  }
  }
}
writeFileSync(new URL('../eval/real-bugs.json', import.meta.url), JSON.stringify(cases, null, 2));
console.error(`${cases.length} cases`);
