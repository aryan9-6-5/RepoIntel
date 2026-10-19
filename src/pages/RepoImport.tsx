import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCode2, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { parseRepoRef } from '../../supabase/functions/_shared/repoUrl';

interface IngestFile {
  path: string;
  size?: number;
  sha: string;
}

interface Answer {
  answer: string;
  commitSha: string;
  snippets: { path: string; start: number; end: number; text: string }[];
  citations: { valid: string[]; invalid: string[]; grounded: boolean };
}

interface FindingT {
  rule: string; title: string; line: number; severity: string; kind: 'static' | 'hypothesis';
  confidence: string; evidence: string; rationale: string;
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
        <Link to="/" className="text-sm text-primary hover:underline">
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
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
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
              <p className="whitespace-pre-wrap text-foreground">{answer.answer}</p>
              <p className="text-xs text-muted-foreground">
                {answer.citations.grounded ? `Verified citations: ${answer.citations.valid.join(', ')}` : 'No verified citations: treat as unsupported.'}
                {answer.citations.invalid.length > 0 && ` Invalid (ignored): ${answer.citations.invalid.join(', ')}`}
                {' '}Commit {answer.commitSha.slice(0, 7)}.
              </p>
              {answer.snippets.map((s) => (
                <details key={s.path + s.start}>
                  <summary className="cursor-pointer text-primary">{s.path}:{s.start}-{s.end}</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-secondary/50 p-2 text-xs">{s.text}</pre>
                </details>
              ))}
            </div>
          )}
          {analysis && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-semibold text-foreground">Findings: {analysis.path} @ {analysis.commitSha.slice(0, 7)}</p>
              {analysis.findings.length === 0 && <p className="text-muted-foreground">No findings. This is not proof the file is bug-free.</p>}
              {analysis.findings.map((f) => (
                <div key={f.rule + f.line + f.title} className="rounded border border-border p-2">
                  <p className="text-foreground">
                    line {f.line}: {f.title} <span className="text-xs text-muted-foreground">[{f.severity}, {f.kind === 'static' ? 'pattern match' : 'unverified model hypothesis'}, confidence {f.confidence}]</span>
                  </p>
                  <pre className="my-1 overflow-auto rounded bg-secondary/50 p-1 text-xs">{f.evidence}</pre>
                  <p className="text-xs text-muted-foreground">{f.rationale}</p>
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
              <pre className="max-h-72 overflow-auto rounded bg-secondary/50 p-2 text-xs">{proposal.diff}</pre>
              <p className="text-xs text-muted-foreground">
                To verify in an isolated local Docker sandbox, save this response as patch.json and run:
              </p>
              <pre className="overflow-auto rounded bg-secondary/50 p-2 text-xs">{`node scripts/verify-patch.mjs ${result.repoId} ${proposal.commitSha} patch.json "npm test"`}</pre>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(JSON.stringify({ path: proposal.path, edit: proposal.edit }, null, 2))}>
                Copy patch.json
              </Button>
            </div>
          )}
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
            {result.files.map((f) => (
              <li key={f.sha + f.path} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
                <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-foreground">{f.path}</span>
                <span className="ml-auto shrink-0 text-xs">{f.size ?? 0} B</span>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => analyze(f.path)}>
                  {busy === f.path ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Analyze'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
