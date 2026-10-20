#!/usr/bin/env node
// Build the UNSEEN-repo benchmark datasets (read-only GitHub API via the local `gh` CLI), then freeze them:
//   eval/unseen/queries.json : retrieval/Q&A cases auto-derived from documented functions (no hand labeling)
//   eval/unseen/bugs.json    : real bug-fix commits (single source file; optionally with tests changed in the same commit)
// "Unseen" = none of these repos were used for tuning or earlier benchmarks.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const HELDOUT = process.argv.includes('--heldout'); // fresh repos + different seed, queries only; never used for tuning
const REPOS = HELDOUT ? [
  { repo: 'jshttp/mime-types', lang: 'js' },
  { repo: 'pallets-eco/blinker', lang: 'py' },
  { repo: 'sindresorhus/ky', lang: 'js' },
  { repo: 'python-attrs/attrs', lang: 'py' },
] : [
  { repo: 'jshttp/cookie', lang: 'js' },
  { repo: 'expressjs/cors', lang: 'js' },
  { repo: 'mde/ejs', lang: 'js' },
  { repo: 'jshttp/negotiator', lang: 'js' },
  { repo: 'sindresorhus/p-limit', lang: 'js' },
  { repo: 'pallets/itsdangerous', lang: 'py' },
];
const SEED = HELDOUT ? 7 : 20261019; // fixed: same selection every run
const QUERIES_PER_REPO = 8;
const BUGS_PER_REPO = 6;
const EXT = { js: /\.(js|mjs|cjs|ts)$/, py: /\.py$/ };
const AUX = /(^|\/)(tests?|__tests__|spec|docs?|examples?|benchmarks?|fixtures?|bench|scripts|jakelib)\/|\.bench\.[a-z]+$|(^|\/)\.[^/]+\//i;

const gh = (path, raw = false) => {
  const r = spawnSync('gh', ['api', ...(raw ? ['-H', 'Accept: application/vnd.github.raw'] : []), path], { encoding: 'utf8', maxBuffer: 30_000_000 });
  if (r.status !== 0) return null;
  if (raw) return r.stdout;
  try { return JSON.parse(r.stdout); } catch { return null; }
};

let s = SEED;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Documented functions: [{name, line (1-based def line), doc (first sentence of preceding comment/docstring)}] */
function documented(text, lang) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lang === 'py'
      ? lines[i].match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/) || lines[i].match(/^class\s+([A-Za-z_]\w*)/)
      : lines[i].match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/) || lines[i].match(/^\s*(?:exports\.|module\.exports\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/);
    if (!m || m[1].startsWith('_')) continue;
    let doc = '';
    if (lang === 'py') {
      const d = (lines[i + 1] ?? '').match(/^\s*(?:r|u)?("""|''')(.*)$/);
      if (d) doc = d[2].replace(/("""|''')\s*$/, '').trim();
    } else {
      let j = i - 1;
      const parts = [];
      while (j >= 0 && /^\s*(\*|\/\*\*|\/\/|\*\/)/.test(lines[j])) { parts.unshift(lines[j].replace(/^\s*(\/\*\*|\*\/|\*|\/\/)\s?/, '').trim()); j--; }
      doc = parts.find((p) => p && !p.startsWith('@')) ?? '';
    }
    doc = doc.replace(/`/g, '').split(/(?<=[.!?])\s/)[0].trim();
    if (doc.split(/\s+/).length >= 6 && doc.length <= 160) out.push({ name: m[1], line: i + 1, doc, kind: 'doc' });
    else if (m[1].length >= 6) {
      // undocumented: symbol-style query from the identifier (camelCase / snake_case split)
      const words = m[1].replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_$]+/g, ' ').toLowerCase().trim();
      if (words.includes(' ')) out.push({ name: m[1], line: i + 1, doc: `how does ${words} work`, kind: 'symbol' });
    }
  }
  return out;
}

const queries = [];
const bugs = [];
for (const { repo, lang } of REPOS) {
  const meta = gh(`repos/${repo}`);
  const branch = meta?.default_branch;
  const tree = gh(`repos/${repo}/git/trees/${branch}?recursive=1`);
  if (!tree) { console.error('skip', repo); continue; }
  const head = tree.sha;
  const commit = gh(`repos/${repo}/commits/${branch}`)?.sha;
  const files = tree.tree.filter((e) => e.type === 'blob' && EXT[lang].test(e.path) && !AUX.test(e.path) && (e.size ?? 0) < 120_000);
  let n = 0;
  for (const f of shuffle(files)) {
    if (n >= QUERIES_PER_REPO) break;
    const text = gh(`repos/${repo}/contents/${f.path}?ref=${commit}`, true);
    if (!text) continue;
    const docs = documented(text, lang);
    if (!docs.length) continue;
    const pool = docs.some((x) => x.kind === 'doc') ? docs.filter((x) => x.kind === 'doc') : docs;
    const d = pool[Math.floor(rnd() * pool.length)];
    queries.push({ repo, commit, path: f.path, symbol: d.name, defLine: d.line, query: d.doc, kind: d.kind });
    n++;
  }
  console.error(`${repo}: ${n} queries @ ${commit?.slice(0, 7)}`);

  if (HELDOUT) continue;
  // real bug fixes: single source file changed (+ any test files), small source diff
  let b = 0;
  for (let page = 1; page <= 8 && b < BUGS_PER_REPO; page++) {
    for (const c of gh(`repos/${repo}/commits?per_page=100&page=${page}`) ?? []) {
      if (b >= BUGS_PER_REPO) break;
      if (!/^(fix|bug)/i.test(c.commit.message.split('\n')[0]) || c.parents?.length !== 1) continue;
      const d = gh(`repos/${repo}/commits/${c.sha}`);
      const src = (d?.files ?? []).filter((x) => EXT[lang].test(x.filename) && !AUX.test(x.filename) && !/test|spec/i.test(x.filename));
      const tests = (d?.files ?? []).filter((x) => AUX.test(x.filename) || /test|spec/i.test(x.filename));
      if (src.length !== 1 || src[0].status !== 'modified' || !src[0].patch) continue;
      if (d.files.length - tests.length !== 1 || src[0].additions + src[0].deletions > 14 || src[0].additions + src[0].deletions < 1) continue;
      const lines = []; let old = 0;
      for (const l of src[0].patch.split('\n')) {
        const h = l.match(/^@@ -(\d+)(?:,\d+)? \+\d+/);
        if (h) { old = +h[1]; continue; }
        if (l.startsWith('-')) lines.push(old++); else if (l.startsWith('+')) { if (!lines.includes(old)) lines.push(old); } else if (!l.startsWith('\\')) old++;
      }
      const raw = gh(`repos/${repo}/contents/${src[0].filename}?ref=${c.parents[0].sha}`, true);
      const total = raw?.split('\n').length ?? 0;
      if (!lines.length || total < 15 || total > 400 || lines[lines.length - 1] > 400) continue;
      bugs.push({
        repo, lang, fixSha: c.sha, parentSha: c.parents[0].sha, path: src[0].filename,
        message: c.commit.message.split('\n')[0].slice(0, 120), buggyLines: [...new Set(lines)].sort((x, y) => x - y), fileLines: total,
        testFiles: tests.filter((x) => x.status !== 'removed').map((x) => x.filename),
      });
      b++;
    }
  }
  console.error(`${repo}: ${b} bug fixes`);
}
mkdirSync(new URL('../eval/unseen/', import.meta.url), { recursive: true });
if (HELDOUT) writeFileSync(new URL('../eval/unseen/heldout-queries.json', import.meta.url), JSON.stringify(queries, null, 2));
else {
  writeFileSync(new URL('../eval/unseen/queries.json', import.meta.url), JSON.stringify(queries, null, 2));
  writeFileSync(new URL('../eval/unseen/bugs.json', import.meta.url), JSON.stringify(bugs, null, 2));
}
console.error(`${queries.length} queries, ${bugs.length} bugs`);
