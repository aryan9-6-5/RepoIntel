#!/usr/bin/env node
// Retrieval + Q&A + citation correctness on UNSEEN repos. Usage: node scripts/eval-unseen-qa.mjs [qa-per-repo=4]
// Cases: eval/unseen/queries.json (auto-derived; ground truth = the file/line of the function the query came from).
//  retrieval hit  : the defining file is among the snippets returned by repo-query (top 8 chunks)
//  line hit       : a returned snippet from that file covers the definition line
//  Q&A correctness: answer has >=1 verified citation AND some cited range overlaps the definition's neighborhood (+-30 lines)
// Writes docs/EVAL-UNSEEN.md. Live HEAD may have moved since the dataset commit; this is recorded, not hidden.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const QA_PER_REPO = Number(process.argv[2] ?? 4);
const DATASET = process.argv[3] ?? 'eval/unseen/queries.json';
const REPORT = process.argv[4] ?? 'docs/EVAL-UNSEEN.md';
// Free-tier Groq allows 8000 tokens/min and one Q&A call uses ~3.9k, so pace Q&A calls (override with EVAL_QA_PACE_MS)
const QA_PACE = Number(process.env.EVAL_QA_PACE_MS ?? 35_000);
const queries = JSON.parse(readFileSync(join(root, DATASET), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(body) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/repo-query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status !== 429 || t === 3) return { status: r.status, d };
    await sleep(25_000);
  }
}

const per = {};
const tokens = []; // prompt+completion tokens per answered question (free tier allows 8000/min)
const rows = [];
const qaSeen = {};
let qaHeadMoved = 0;
for (const q of queries) {
  const k = (per[q.repo] ??= { n: 0, hit: 0, lineHit: 0, qa: 0, qaGrounded: 0, qaCorrect: 0, qaInvalid: 0, qaFail: 0, symbol: { n: 0, hit: 0 }, doc: { n: 0, hit: 0 } });
  const r = await call({ repo: q.repo, query: q.query });
  await sleep(1500);
  const sn = r.d.snippets ?? [];
  const inFile = sn.filter((s) => s.path === q.path);
  const hit = inFile.length > 0;
  const lineHit = inFile.some((s) => s.start <= q.defLine && q.defLine <= s.end);
  if (r.d.commitSha && q.commit && r.d.commitSha.slice(0, 7) !== q.commit.slice(0, 7)) qaHeadMoved++;
  k.n++; k.hit += hit; k.lineHit += lineHit; k[q.kind].n++; k[q.kind].hit += hit;
  let qa = '-';
  qaSeen[q.repo] = qaSeen[q.repo] ?? 0;
  if (hit && qaSeen[q.repo] < QA_PER_REPO) {
    qaSeen[q.repo]++;
    const a = await call({ repo: q.repo, query: q.kind === 'doc' ? `${q.query}` : q.query, ask: true });
    await sleep(QA_PACE);
    k.qa++;
    if (a.status !== 200 || !a.d.citations) { k.qaFail++; qa = `API fail (http ${a.status})`; }
    else {
      const c = a.d.citations;
      k.qaInvalid += c.invalid.length;
      if (a.d.usage) tokens.push(a.d.usage.prompt + a.d.usage.completion);
      if (c.grounded) k.qaGrounded++;
      const near = c.valid.some((v) => { const m = v.match(/^(.+):(\d+)-(\d+)$/); return m && m[1] === q.path && +m[3] >= q.defLine - 30 && +m[2] <= q.defLine + 30; });
      if (near) k.qaCorrect++;
      qa = `${c.grounded ? 'grounded' : 'UNGROUNDED'}, ${near ? 'cites the right place' : 'cites elsewhere/none'}, ${c.invalid.length} invalid`;
    }
  }
  rows.push(`| ${q.repo.split('/')[1]} | ${q.kind} | ${q.query.slice(0, 55)} | ${q.path}:${q.defLine} | ${hit ? (lineHit ? 'HIT+line' : 'HIT file') : 'MISS'} | ${qa} |`);
}
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'n/a');
const T = Object.values(per).reduce((t, k) => { for (const f of ['n', 'hit', 'lineHit', 'qa', 'qaGrounded', 'qaCorrect', 'qaInvalid', 'qaFail']) t[f] = (t[f] ?? 0) + k[f]; for (const g of ['symbol', 'doc']) { t[g] ??= { n: 0, hit: 0 }; t[g].n += k[g].n; t[g].hit += k[g].hit; } return t; }, {});
const byRepo = Object.entries(per).map(([r, k]) => `| ${r} | ${pct(k.hit, k.n)} | ${pct(k.lineHit, k.n)} | ${pct(k.qaGrounded, k.qa)} | ${pct(k.qaCorrect, k.qa)} | ${k.qaInvalid} |`).join('\n');
const md = `# Unseen-repo retrieval, Q&A and citation benchmark (live, ${new Date().toISOString().slice(0, 10)})

Method: for each repo, functions were sampled with a fixed seed (\`scripts/build-unseen.mjs\`, frozen in \`eval/unseen/queries.json\`). Query = the function's own doc comment ("doc" kind, semantic) or, when undocumented, its identifier turned into words ("symbol" kind). Ground truth = the file and line that define it; no hand labeling. Q&A is run only when retrieval found the file (so Q&A scores are conditional on retrieval success). Re-run: \`node scripts/eval-unseen-qa.mjs\`.

| Repo | Kind | Query | Truth | Retrieval | Q&A |
|------|------|-------|-------|-----------|-----|
${rows.join('\n')}

## Measured
- Retrieval, defining file in top-8 snippets: ${pct(T.hit, T.n)} (doc-comment queries ${pct(T.doc.hit, T.doc.n)}; identifier queries ${pct(T.symbol.hit, T.symbol.n)})
- Retrieval, a snippet covers the definition line: ${pct(T.lineHit, T.n)}
- Q&A answers with >=1 verified citation (given retrieval hit): ${pct(T.qaGrounded, T.qa)}
- Q&A answers whose citation lands within +-30 lines of the true definition: ${pct(T.qaCorrect, T.qa)}
- Invalid (hallucinated) citations caught by verification: ${T.qaInvalid}; Q&A API failures: ${T.qaFail}
- Tokens per answered question (prompt + completion): ${tokens.length ? `mean ${Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)}, max ${Math.max(...tokens)}, n=${tokens.length}` : 'n/a'} (free-tier budget: 8000 tokens per minute)
- Queries run where live HEAD differs from the dataset commit: ${qaHeadMoved}

| Repo | File hit | Line hit | Grounded | Cites right place | Invalid cites |
|------|----------|----------|----------|-------------------|---------------|
${byRepo}

## Limits
Small samples per repo; queries are proxies (a doc comment is not how real users ask questions); "cites the right place" checks location, not whether the prose is correct; popular repos may be in the model's training data; Groq free tier can 429 (retried, failures counted).
`;
writeFileSync(join(root, REPORT), md);
console.log(md);
