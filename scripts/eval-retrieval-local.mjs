#!/usr/bin/env node
// Offline retrieval benchmark: runs the SAME pipeline code as repo-query (ingest -> rankPaths -> fetch -> chunk -> searchChunks)
// in Node against GitHub (read via the local `gh` CLI). No Groq, no deployment. Needs: node --experimental-strip-types.
// Usage: node --experimental-strip-types scripts/eval-retrieval-local.mjs <queries.json> [maxFiles=24] [searchModule=supabase/functions/_shared/search.ts]
// The optional searchModule lets you compare an older ranker (e.g. `git show HEAD:...search.ts > old.ts`) on identical cases.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const [queriesFile, maxFilesArg, searchArg] = process.argv.slice(2);
if (!queriesFile) { console.error('usage: queries.json [maxFiles] [searchModule]'); process.exit(2); }
const MAX_FILES = Number(maxFilesArg ?? 24);
const { rankPaths, chunkFile, searchChunks } = await import(pathToFileURL(resolve(root, searchArg ?? 'supabase/functions/_shared/search.ts')).href);
const { ingestRepo } = await import(pathToFileURL(resolve(root, 'supabase/functions/_shared/ingest.ts')).href);
const { parseRepoRef } = await import(pathToFileURL(resolve(root, 'supabase/functions/_shared/repoUrl.ts')).href);

const gh = (path, raw) => spawnSync('gh', ['api', ...(raw ? ['-H', 'Accept: application/vnd.github.raw'] : []), path], { encoding: 'utf8', maxBuffer: 30_000_000 });
async function ghFetch(url) {
  const u = new URL(url);
  if (u.hostname === 'api.github.com') { const r = gh(u.pathname.slice(1) + u.search); return new Response(r.stdout, { status: r.status === 0 ? 200 : 404 }); }
  const [, owner, repo, sha, ...rest] = u.pathname.split('/');
  const r = gh(`repos/${owner}/${repo}/contents/${rest.join('/')}?ref=${sha}`, true);
  return new Response(r.stdout, { status: r.status === 0 ? 200 : 404 });
}

const cases = JSON.parse(readFileSync(resolve(root, queriesFile), 'utf8'));
const trees = new Map();
const per = {};
const tot = { n: 0, hit: 0, line: 0, doc: [0, 0], symbol: [0, 0] };
const misses = [];
for (const q of cases) {
  const ref = parseRepoRef(q.repo);
  if (!trees.has(q.repo)) trees.set(q.repo, await ingestRepo(ref, ghFetch));
  const ing = trees.get(q.repo);
  if (!ing.ok) { console.error('ingest failed', q.repo, ing.message); continue; }
  const paths = rankPaths(ing.files.map((f) => f.path), q.query, MAX_FILES);
  const chunks = [];
  for (const p of paths) {
    const r = await ghFetch(`https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${q.commit ?? ing.commitSha}/${p}`);
    if (r.ok) chunks.push(...chunkFile(p, await r.text()));
  }
  const sn = searchChunks(chunks, q.query, 8);
  const inFile = sn.filter((s) => s.path === q.path);
  const hit = inFile.length > 0;
  const line = inFile.some((s) => s.start <= q.defLine && q.defLine <= s.end);
  const k = (per[q.repo] ??= { n: 0, hit: 0, line: 0 });
  k.n++; k.hit += hit; k.line += line;
  tot.n++; tot.hit += hit; tot.line += line; tot[q.kind][0] += hit; tot[q.kind][1]++;
  if (!hit) misses.push(`${q.repo.split('/')[1]} | ${q.kind} | ${q.query.slice(0, 50)} | truth ${q.path} | rank of truth file among candidates: ${paths.indexOf(q.path) < 0 ? 'NOT FETCHED' : 'fetched'}`);
}
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'n/a');
console.log(JSON.stringify({
  maxFiles: MAX_FILES, module: searchArg ?? 'current',
  file_hit: pct(tot.hit, tot.n), line_hit: pct(tot.line, tot.n), doc: pct(...tot.doc), symbol: pct(...tot.symbol),
  perRepo: Object.fromEntries(Object.entries(per).map(([r, k]) => [r, `${k.hit}/${k.n} file, ${k.line}/${k.n} line`])),
  misses,
}, null, 2));
