import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCode2, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { parseRepoRef } from '../../supabase/functions/_shared/repoUrl';
import type { Dependencies, Overview, TreeNode } from '../../supabase/functions/_shared/overview';
import { CodeViewer } from '@/components/CodeViewer';
import { FileTree } from '@/components/FileTree';

interface Explorer {
  overview: Overview;
  dependencies: Dependencies[];
  tree: TreeNode[];
  summary?: string;
  summaryError?: string;
  citations?: { valid: string[]; invalid: string[]; grounded: boolean };
}

interface IngestFile {
  path: string;
  size?: number;
  sha: string;
}

interface Answer {
  usage?: { prompt: number; completion: number };
  ms?: number;
  cached?: boolean;
  answer: string;
  commitSha: string;
  snippets: { path: string; start: number; end: number; text: string }[];
  citations: { valid: string[]; invalid: string[]; grounded: boolean };
}

interface FindingT {
  rule: string; title: string; line: number; severity: string; kind: 'static' | 'hypothesis';
  confidence: string; evidence: string; rationale: string; reproduction?: string;
}

interface Proposal { path: string; commitSha: string; diff: string; edit: { startLine: number; endLine: number; newText: string } }

interface IngestSuccess {
  repoId: string;
  defaultBranch: string;
  commitSha: string;
  htmlUrl: string;
  files: IngestFile[];
  skipped: { excluded: number; oversize: number };
  totalBytes: number;
}

/** Renders model text; lines the model marks "Inference:" are visibly separated from claims that cite code. */
function AnswerText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-foreground">
      {text.split('\n').map((line, i) =>
        /^\s*(\*\*)?Inference:/i.test(line) ? (
          <p key={i} className="whitespace-pre-wrap rounded border border-amber-500/40 bg-amber-500/10 p-1.5">
            <span className="mr-1 rounded bg-amber-500/20 px-1 text-xs font-medium text-amber-500">Inference, not shown in the code</span>
            {line.replace(/^\s*(\*\*)?Inference:(\*\*)?\s*/i, '')}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-wrap">{line}</p>
        ),
      )}
    </div>
  );
}

async function readFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      /* fall through */
    }
  }
  return 'Could not import the repository. Please try again.';
}

export default function RepoImport() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestSuccess | null>(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAnswer(null);
    setAsking(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('repo-query', {
        body: { repo: input, query: question, ask: true },
      });
      if (fnError) throw fnError;
      setAnswer(data as Answer);
    } catch (err) {
      setError(await readFunctionError(err));
    } finally {
      setAsking(false);
    }
  };

  const [analysis, setAnalysis] = useState<{ path: string; commitSha: string; findings: FindingT[]; llmStatus: string } | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const call = async <T,>(name: string, body: object, label: string): Promise<T | null> => {
    setError(null);
    setBusy(label);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(name, { body });
      if (fnError) throw fnError;
      return data as T;
    } catch (err) {
      setError(await readFunctionError(err));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const [explorer, setExplorer] = useState<Explorer | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hl, setHl] = useState<[number, number] | null>(null);

  const openRef = (ref: string) => {
    const m = ref.match(/^(.+):(\d+)-(\d+)$/);
    if (!m) return;
    setSelected(m[1]);
    setHl([+m[2], +m[3]]);
  };

  const loadOverview = async (withSummary: boolean) => {
    const r = await call<Explorer>('repo-overview', { repo: input, summary: withSummary }, 'overview');
    if (r) setExplorer(r);
  };

  const analyze = async (path: string) => {
    setProposal(null);
    setAnalysis(null);
    const r = await call<{ commitSha: string; findings: FindingT[]; llmStatus: string }>('repo-analyze', { repo: input, path, llm: true }, path);
    if (r) setAnalysis({ path, ...r });
  };

  const propose = async (f: FindingT) => {
    if (!analysis) return;
    const r = await call<Proposal>('repo-patch', { repo: input, path: analysis.path, line: f.line, title: f.title, rationale: f.rationale }, `fix-${f.line}`);
    if (r) setProposal(r);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!parseRepoRef(input)) {
      setError('Enter a public GitHub repository as owner/repo or a github.com URL.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('repo-ingest', { body: { repo: input } });
      if (fnError) throw fnError;
      setResult(data as IngestSuccess);
      setExplorer(null);
      setSelected(null);
      setHl(null);
      void loadOverview(false);
    } catch (err) {
      setError(await readFunctionError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Import a repository</h1>
        <Link to="/" className="inline-flex min-h-[40px] items-center text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:min-h-[28px]">
          Profile explorer
        </Link>
      </div>

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repo or https://github.com/owner/repo"
          aria-label="GitHub repository"
          maxLength={300}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Import
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {result && (
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p className="font-semibold text-foreground">{result.repoId}</p>
            <p className="text-muted-foreground">
              branch {result.defaultBranch} @ {result.commitSha.slice(0, 7)} - {result.files.length} files (
              {(result.totalBytes / 1024).toFixed(0)} KB) - {result.skipped.excluded} excluded, {result.skipped.oversize} oversized
            </p>
          </div>
          <form onSubmit={ask} className="flex gap-2">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300}
              placeholder="Ask about this code, e.g. where is rate limiting handled?" aria-label="Question" />
            <Button type="submit" disabled={asking || !question.trim()}>
              {asking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ask
            </Button>
          </form>
          {answer && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
              <AnswerText text={answer.answer} />
              {result && answer.commitSha !== result.commitSha && (
                <p role="status" className="text-xs text-amber-500">The repository changed since you imported it: this answer uses the newer commit {answer.commitSha.slice(0, 7)} (imported {result.commitSha.slice(0, 7)}). Re-import to refresh the file list.</p>
              )}
              <p className="text-xs text-muted-foreground">
                {answer.citations.grounded ? `Verified citations: ${answer.citations.valid.join(', ')}` : 'No verified citations: treat as unsupported.'}
                {answer.citations.invalid.length > 0 && ` Invalid (ignored): ${answer.citations.invalid.join(', ')}`}
                {' '}Commit {answer.commitSha.slice(0, 7)}.
                {' '}{answer.cached ? 'Cached answer. ' : ''}{answer.ms != null ? `${answer.ms} ms` : ''}{answer.usage ? `, ${answer.usage.prompt + answer.usage.completion} tokens` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {answer.citations.valid.map((c) => (
                  <Button key={c} size="sm" variant="outline" onClick={() => openRef(c)}>{c}</Button>
                ))}
              </div>
              {answer.snippets.map((s) => (
                <details key={s.path + s.start}>
                  <summary className="cursor-pointer text-primary">{s.path}:{s.start}-{s.end}</summary>
                  <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary mt-1 max-h-64 overflow-auto rounded bg-secondary/50 p-2 text-xs">{s.text}</pre>
                </details>
              ))}
            </div>
          )}
          {analysis && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-semibold text-foreground">Findings: {analysis.path} @ {analysis.commitSha.slice(0, 7)}</p>
              {analysis.llmStatus !== 'ok' && (
                <p role="status" className="text-xs text-amber-500">
                  {analysis.llmStatus === 'error_429' ? 'AI analysis was rate limited by the free tier; only pattern checks ran. Try again in a minute.' : `AI analysis did not run (${analysis.llmStatus}); only pattern checks ran.`}
                </p>
              )}
              {analysis.findings.length === 0 && <p className="text-muted-foreground">No findings{analysis.llmStatus === 'ok' ? '' : ' from the checks that ran'}. This is not proof the file is bug-free.</p>}
              {analysis.findings.map((f) => (
                <div key={f.rule + f.line + f.title} className="rounded border border-border p-2">
                  <p className="text-foreground">
                    <button type="button" className="inline-block min-h-[28px] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setSelected(analysis.path); setHl([f.line, f.line]); }}>line {f.line}</button>: {f.title} <span className="text-xs text-muted-foreground">[{f.severity}, {f.kind === 'static' ? 'pattern match' : 'unverified model hypothesis'}, confidence {f.confidence}]</span>
                  </p>
                  <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary my-1 overflow-auto rounded bg-secondary/50 p-1 text-xs">{f.evidence}</pre>
                  <p className="text-xs text-muted-foreground">{f.rationale}</p>
                  {f.reproduction && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">How to check: </span>{f.reproduction}</p>
                  )}
                  <Button size="sm" variant="outline" className="mt-1" disabled={!!busy} onClick={() => propose(f)}>
                    {busy === `fix-${f.line}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Propose fix'}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {proposal && (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-card p-4 text-sm">
              <p className="font-semibold text-foreground">Proposed patch (unverified, nothing applied)</p>
              <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary max-h-72 overflow-auto rounded bg-secondary/50 p-2 text-xs">{proposal.diff}</pre>
              <p className="text-xs text-muted-foreground">
                To verify in an isolated local Docker sandbox, save this response as patch.json and run:
              </p>
              <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary overflow-auto rounded bg-secondary/50 p-2 text-xs">{`node scripts/verify-patch.mjs ${result.repoId} ${proposal.commitSha} patch.json "npm test"`}</pre>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(JSON.stringify({ path: proposal.path, edit: proposal.edit }, null, 2))}>
                Copy patch.json
              </Button>
            </div>
          )}
          {explorer && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-semibold text-foreground">Overview (derived from the file list and manifests)</p>
              <p className="text-muted-foreground">
                {explorer.overview.fileCount} files - {explorer.overview.languages.slice(0, 4).map((l) => `${l.name} ${l.files}`).join(', ') || 'no known languages'}
              </p>
              <p className="text-muted-foreground">
                Entry points:{' '}
                {explorer.overview.entryPoints.length === 0 ? 'none detected' : explorer.overview.entryPoints.map((p) => (
                  <button key={p} type="button" className="mr-2 inline-block min-h-[28px] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:min-h-[24px]" onClick={() => { setSelected(p); setHl(null); }}>{p}</button>
                ))}
              </p>
              {explorer.dependencies.map((d) => (
                <details key={d.source}>
                  <summary className="cursor-pointer text-foreground">{d.source}: {d.runtime.length} runtime, {d.dev.length} dev dependencies</summary>
                  <p className="mt-1 text-xs text-muted-foreground">{d.runtime.join(', ')}</p>
                </details>
              ))}
              {explorer.summary ? (
                <div className="space-y-1">
                  <p className="whitespace-pre-wrap text-foreground">{explorer.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {explorer.citations?.valid.map((c) => (
                      <Button key={c} size="sm" variant="outline" onClick={() => openRef(c)}>{c}</Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {explorer.citations?.grounded ? 'Citations verified against the files read.' : 'No verified citations: treat as unsupported.'}
                    {explorer.citations && explorer.citations.invalid.length > 0 && ` Invalid (ignored): ${explorer.citations.invalid.join(', ')}`}
                  </p>
                </div>
              ) : (
                <>
                  {explorer.summaryError && <p role="alert" className="text-xs text-red-400">{explorer.summaryError}</p>}
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => loadOverview(true)}>
                    {busy === 'overview' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate architecture summary'}
                  </Button>
                </>
              )}
            </div>
          )}
          {!explorer && busy === 'overview' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading overview" />}
          <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
            <nav aria-label="Files" className="max-h-[32rem] overflow-auto rounded-lg border border-border bg-card p-2">
              {explorer ? (
                <FileTree nodes={explorer.tree} selected={selected} onSelect={(p) => { setSelected(p); setHl(null); }} />
              ) : (
                <ul className="text-sm text-muted-foreground">
                  {result.files.map((f) => (
                    <li key={f.sha + f.path}><button type="button" onClick={() => { setSelected(f.path); setHl(null); }} className="hover:text-primary">{f.path}</button></li>
                  ))}
                </ul>
              )}
            </nav>
            <div className="min-w-0 space-y-2">
              {selected ? (
                <>
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 text-primary" />
                    <span className="truncate text-sm text-foreground">{selected}</span>
                    <Button size="sm" variant="outline" className="ml-auto" disabled={!!busy} onClick={() => analyze(selected)}>
                      {busy === selected ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Analyze'}
                    </Button>
                  </div>
                  <CodeViewer repoId={result.repoId} commitSha={result.commitSha} path={selected} highlight={hl} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a file to view its source with line numbers.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
