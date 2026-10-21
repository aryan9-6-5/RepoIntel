import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileCode2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { parseRepoRef } from '../../supabase/functions/_shared/repoUrl';
import type { Dependencies, Overview, TreeNode } from '../../supabase/functions/_shared/overview';
import { CodeViewer } from '@/components/CodeViewer';
import { FileTree } from '@/components/FileTree';
import { sortTree } from '@/lib/tree';
import { MarkdownContent } from '@/components/MarkdownContent';

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

export default function CodeAnalysis({ repo, onClose }: { repo: string; onClose: () => void }) {
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
        body: { repo, query: question, ask: true },
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

  const loadOverview = async (withSummary: boolean, repoTarget = repo) => {
    const r = await call<Explorer>('repo-overview', { repo: repoTarget, summary: withSummary }, 'overview');
    if (r) setExplorer(r);
  };

  const analyze = async (path: string) => {
    setProposal(null);
    setAnalysis(null);
    const r = await call<{ commitSha: string; findings: FindingT[]; llmStatus: string }>('repo-analyze', { repo, path, llm: true }, path);
    if (r) setAnalysis({ path, ...r });
  };

  const propose = async (f: FindingT) => {
    if (!analysis) return;
    const r = await call<Proposal>('repo-patch', { repo, path: analysis.path, line: f.line, title: f.title, rationale: f.rationale }, `fix-${f.line}`);
    if (r) setProposal(r);
  };

  const runIngest = async (targetRepo: string) => {
    setError(null);
    setResult(null);
    if (!parseRepoRef(targetRepo)) {
      setError('Enter a public GitHub repository as owner/repo or a github.com URL.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('repo-ingest', { body: { repo: targetRepo } });
      if (fnError) throw fnError;
      setResult(data as IngestSuccess);
      setExplorer(null);
      setSelected(null);
      setHl(null);
      void loadOverview(false, targetRepo);
    } catch (err) {
      setError(await readFunctionError(err));
    } finally {
      setLoading(false);
    }
  };

  // the parent mounts this per repo (key={repo}), so start once on mount
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void runIngest(repo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // open the entry point once the overview is in, so the viewer is never an empty box
  useEffect(() => {
    const entry = explorer?.overview.entryPoints[0];
    if (entry && !selected) setSelected(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explorer]);

  const tree = explorer ? sortTree(explorer.tree) : null;

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2 gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Repositories
        </Button>
        <h2 className="truncate font-mono text-lg font-semibold text-foreground">{repo}</h2>
        {result && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Fact label="branch" value={result.defaultBranch} />
            <Fact label="commit" value={result.commitSha.slice(0, 7)} mono />
            <Fact label="files" value={String(result.files.length)} />
            <Fact label="size" value={`${(result.totalBytes / 1024).toFixed(0)} KB`} />
            <div title={`${result.skipped.excluded} files excluded (binary, vendored, generated) and ${result.skipped.oversize} over the size limit`}>
              <dt className="inline">skipped </dt>
              <dd className="inline text-foreground">{result.skipped.excluded + result.skipped.oversize}</dd>
            </div>
          </dl>
        )}
      </header>

      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Importing {repo}...
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <>
          <form onSubmit={ask} className="flex gap-2">
            <Input className="h-11" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300}
              placeholder="Ask about this code" aria-label="Question" />
            <Button type="submit" size="lg" disabled={asking || !question.trim()}>
              {asking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ask
            </Button>
          </form>

          {answer && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
              <MarkdownContent content={answer.answer} />
              {answer.commitSha !== result.commitSha && (
                <p role="status" className="text-xs text-amber-700 dark:text-amber-500">The repository changed since you imported it: this answer uses the newer commit {answer.commitSha.slice(0, 7)} (imported {result.commitSha.slice(0, 7)}). Re-import to refresh the file list.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {answer.citations.valid.map((c) => (
                  <Button key={c} size="sm" variant="outline" className="font-mono text-xs" onClick={() => openRef(c)}>{c}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {answer.citations.grounded ? 'Citations verified against the code.' : 'No verified citations: treat as unsupported.'}
                {answer.citations.invalid.length > 0 && ` Ignored invalid: ${answer.citations.invalid.join(', ')}.`}
                {' '}Commit {answer.commitSha.slice(0, 7)}
                {answer.cached ? ', cached' : ''}{answer.ms != null ? `, ${answer.ms} ms` : ''}{answer.usage ? `, ${answer.usage.prompt + answer.usage.completion} tokens` : ''}.
              </p>
              {answer.snippets.map((s) => (
                <details key={s.path + s.start}>
                  <summary className="cursor-pointer font-mono text-xs text-primary">{s.path}:{s.start}-{s.end}</summary>
                  <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary mt-1 max-h-64 overflow-auto rounded bg-secondary/50 p-2 text-xs">{s.text}</pre>
                </details>
              ))}
            </div>
          )}

          {!explorer && busy === 'overview' && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading the repository...
            </p>
          )}
          {explorer && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
              <h3 className="font-semibold text-foreground">Overview</h3>
              <div className="flex flex-wrap gap-1.5">
                {explorer.overview.languages.slice(0, 5).map((l) => (
                  <span key={l.name} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-foreground">{l.name} <span className="font-medium">{l.files}</span></span>
                ))}
              </div>
              {explorer.overview.entryPoints.length > 0 && (
                <p className="text-muted-foreground">
                  Entry points:{' '}
                  {explorer.overview.entryPoints.map((p) => (
                    <button key={p} type="button" className="mr-3 inline-block min-h-[28px] font-mono text-xs text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:min-h-[24px]" onClick={() => { setSelected(p); setHl(null); }}>{p}</button>
                  ))}
                </p>
              )}
              {explorer.dependencies.map((d) => (
                <details key={d.source}>
                  <summary className="cursor-pointer text-foreground"><span className="font-mono text-xs">{d.source}</span>: {d.runtime.length} runtime, {d.dev.length} dev dependencies</summary>
                  <p className="mt-1 text-xs text-muted-foreground">{d.runtime.join(', ') || 'No runtime dependencies.'}</p>
                </details>
              ))}
              {explorer.summary ? (
                <div className="space-y-3 border-t border-border pt-3">
                  <MarkdownContent content={explorer.summary} />
                  <div className="flex flex-wrap gap-2">
                    {explorer.citations?.valid.map((c) => (
                      <Button key={c} size="sm" variant="outline" className="font-mono text-xs" onClick={() => openRef(c)}>{c}</Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {explorer.citations?.grounded ? 'Citations verified against the files read.' : 'No verified citations: treat as unsupported.'}
                    {explorer.citations && explorer.citations.invalid.length > 0 && ` Ignored invalid: ${explorer.citations.invalid.join(', ')}.`}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => loadOverview(true)}>
                    {busy === 'overview' ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Generate architecture summary
                  </Button>
                  {explorer.summaryError && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{explorer.summaryError}</p>}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <nav aria-label="Files" className="max-h-64 overflow-auto rounded-lg border border-border bg-card p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
              {tree ? (
                <FileTree nodes={tree} selected={selected} onSelect={(p) => { setSelected(p); setHl(null); }} />
              ) : (
                <ul className="text-sm text-muted-foreground">
                  {result.files.map((f) => (
                    <li key={f.sha + f.path}><button type="button" onClick={() => { setSelected(f.path); setHl(null); }} className="hover:text-primary">{f.path}</button></li>
                  ))}
                </ul>
              )}
            </nav>

            <div className="min-w-0 space-y-4">
              {selected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="truncate font-mono text-sm text-foreground">{selected}</span>
                    <Button size="sm" variant="outline" className="ml-auto" disabled={!!busy} onClick={() => analyze(selected)}>
                      {busy === selected ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Analyze'}
                    </Button>
                  </div>
                  <CodeViewer repoId={result.repoId} commitSha={result.commitSha} path={selected} highlight={hl} />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Select a file to view its source with line numbers.</p>
              )}

              {analysis && (
                <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
                  <h3 className="font-semibold text-foreground">Findings in <span className="font-mono text-xs">{analysis.path}</span></h3>
                  {analysis.llmStatus !== 'ok' && (
                    <p role="status" className="text-xs text-amber-700 dark:text-amber-500">
                      {analysis.llmStatus === 'error_429' ? 'AI analysis was rate limited by the free tier; only pattern checks ran. Try again in a minute.' : `AI analysis did not run (${analysis.llmStatus}); only pattern checks ran.`}
                    </p>
                  )}
                  {analysis.findings.length === 0 && <p className="text-muted-foreground">No findings{analysis.llmStatus === 'ok' ? '' : ' from the checks that ran'}. This is not proof the file is bug-free.</p>}
                  {analysis.findings.map((f) => (
                    <div key={f.rule + f.line + f.title} className="space-y-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
                      <p className="text-foreground">
                        <button type="button" className="inline-block min-h-[28px] font-mono text-xs text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setSelected(analysis.path); setHl([f.line, f.line]); }}>line {f.line}</button>
                        {' '}{f.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{f.severity} severity, {f.kind === 'static' ? 'pattern match' : 'unverified model hypothesis'}, {f.confidence} confidence</p>
                      <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary overflow-auto rounded bg-secondary/50 p-1.5 text-xs">{f.evidence}</pre>
                      <p className="text-xs text-muted-foreground">{f.rationale}</p>
                      {f.reproduction && (
                        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">How to check: </span>{f.reproduction}</p>
                      )}
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => propose(f)}>
                        {busy === `fix-${f.line}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Propose fix'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {proposal && (
                <div className="space-y-2 rounded-lg border border-primary/40 bg-card p-4 text-sm">
                  <h3 className="font-semibold text-foreground">Proposed patch <span className="text-xs font-normal text-muted-foreground">(unverified, nothing applied)</span></h3>
                  <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary max-h-72 overflow-auto rounded bg-secondary/50 p-2 text-xs">{proposal.diff}</pre>
                  <p className="text-xs text-muted-foreground">To test it in an isolated local Docker sandbox, save this as patch.json and run:</p>
                  <pre tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary overflow-auto rounded bg-secondary/50 p-2 text-xs">{`node scripts/verify-patch.mjs ${result.repoId} ${proposal.commitSha} patch.json "npm test"`}</pre>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(JSON.stringify({ path: proposal.path, edit: proposal.edit }, null, 2))}>
                    Copy patch.json
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="inline">{label} </dt>
      <dd className={`inline text-foreground ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
