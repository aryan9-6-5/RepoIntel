#!/usr/bin/env node
// Verify a RepoPilot patch locally. Usage:
//   node scripts/verify-patch.mjs <owner/repo> <commitSha> <patch.json> [testCmd]
//   node scripts/verify-patch.mjs --local <dir> <patch.json> [testCmd]     (copy of a local project, no GitHub)
// patch.json = the repo-patch response ({ path, edit: { startLine, endLine, newText } }).
// Untrusted code only ever runs inside Docker: install with --ignore-scripts (only if a package-lock.json exists),
// tests with no network, capped CPU/memory/pids/time. Prints a JSON report; exit 0 only if the patched run passes.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const local = args[0] === '--local';
const [a, b, c, d] = local ? args.slice(1) : args;
const repo = local ? null : a;
const sha = local ? null : b;
const patchFile = local ? b : c;
const testCmd = (local ? c : d) ?? 'npm test';

const valid = local ? !!a && !!patchFile && existsSync(a) : /^[\w.-]+\/[\w.-]+$/.test(repo ?? '') && /^[0-9a-f]{40}$/.test(sha ?? '') && !!patchFile;
if (!valid) {
  console.error('Usage: node scripts/verify-patch.mjs <owner/repo> <40-char sha> <patch.json> [testCmd]\n   or: node scripts/verify-patch.mjs --local <dir> <patch.json> [testCmd]');
  process.exit(2);
}
const patch = JSON.parse(readFileSync(patchFile, 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'repopilot-'));

if (local) {
  cpSync(a, dir, { recursive: true, filter: (s) => !/node_modules|\.git([\\/]|$)/.test(s) });
} else {
  // Fetching source is host-side git only; nothing from the repo is executed on the host.
  const git = (...x) => execFileSync('git', x, { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('remote', 'add', 'origin', `https://github.com/${repo}.git`);
  git('fetch', '-q', '--depth', '1', 'origin', sha);
  git('checkout', '-q', 'FETCH_HEAD');
}

const vol = `repopilot-nm-${Date.now()}`; // node_modules on a Docker volume: much faster than a Windows bind mount
const base = ['run', '--rm', '-v', `${resolve(dir)}:/work`, '-v', `${vol}:/work/node_modules`, '-w', '/work', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '1g'];
const limits = (cpus) => ['--cpus', String(cpus)];
const docker = (x) => spawnSync('docker', x, { encoding: 'utf8', timeout: 900_000 });
const tail = (r) => ((r.stdout ?? '') + (r.stderr ?? '')).split('\n').slice(-25).join('\n');
const cleanup = () => spawnSync('docker', ['volume', 'rm', '-f', vol]);

// Install needs network (lifecycle scripts disabled); test runs have none. Skipped for dependency-free projects.
if (existsSync(join(dir, 'package-lock.json'))) {
  const install = docker([...base, ...limits(4), 'node:22', 'sh', '-c', 'npm ci --ignore-scripts --no-audit --no-fund']);
  if (install.status !== 0) {
    console.log(JSON.stringify({ verdict: 'inconclusive', reason: 'dependency install failed', output: tail(install) }, null, 2));
    cleanup();
    process.exit(1);
  }
}
const runTests = () => {
  const r = docker([...base, ...limits(2), '--network', 'none', 'node:22', 'sh', '-c', `timeout 120 ${testCmd}`]);
  return { exit: r.status, passed: r.status === 0, output: tail(r) };
};

const baseline = runTests();
const file = join(dir, patch.path);
const lines = readFileSync(file, 'utf8').split('\n');
const { startLine, endLine, newText } = patch.edit;
lines.splice(startLine - 1, endLine - startLine + 1, ...(newText === '' ? [] : newText.split('\n')));
writeFileSync(file, lines.join('\n'));
const patched = runTests();

const verdict = !baseline.passed && patched.passed ? 'fixes-failing-tests'
  : baseline.passed && patched.passed ? 'no-regression (baseline already passing, fix not demonstrated)'
  : baseline.passed && !patched.passed ? 'REGRESSION'
  : 'still-failing';
console.log(JSON.stringify({ target: local ? a : `${repo}@${sha}`, verdict, baseline, patched }, null, 2));
cleanup();
process.exit(patched.passed ? 0 : 1);
