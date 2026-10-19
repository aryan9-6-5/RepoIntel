import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  repoId: string; // owner/repo
  commitSha: string;
  path: string;
  highlight?: [number, number] | null;
}

const MAX_RENDER_LINES = 3000;

/** Read-only viewer. File text is untrusted: rendered as plain text, never executed or parsed as HTML. */
export function CodeViewer({ repoId, commitSha, path, highlight }: Props) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines(null);
    setError(null);
    const url = `https://raw.githubusercontent.com/${repoId}/${commitSha}/${path.split('/').map(encodeURIComponent).join('/')}`;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => !cancelled && setLines(t.split('\n')))
      .catch(() => !cancelled && setError('Could not load this file.'));
    return () => {
      cancelled = true;
    };
  }, [repoId, commitSha, path]);

  useEffect(() => {
    hlRef.current?.scrollIntoView({ block: 'center' });
  }, [lines, highlight?.[0], highlight?.[1]]);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!lines) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading file" />;

  return (
    <div className="max-h-[32rem] overflow-auto rounded border border-border bg-secondary/30 font-mono text-xs" aria-label={`Source of ${path}`}>
      {lines.slice(0, MAX_RENDER_LINES).map((l, i) => {
        const n = i + 1;
        const on = highlight && n >= highlight[0] && n <= highlight[1];
        return (
          <div key={n} ref={on && n === highlight![0] ? hlRef : undefined} className={`flex ${on ? 'bg-primary/20' : ''}`}>
            <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground">{n}</span>
            <span className="whitespace-pre pr-2 text-foreground">{l}</span>
          </div>
        );
      })}
      {lines.length > MAX_RENDER_LINES && <p className="p-2 text-muted-foreground">Showing first {MAX_RENDER_LINES} of {lines.length} lines.</p>}
    </div>
  );
}
