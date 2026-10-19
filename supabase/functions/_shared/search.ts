export interface Chunk {
  path: string;
  start: number; // 1-based inclusive
  end: number;
  text: string;
}

const STOP = new Set(['the', 'is', 'a', 'an', 'of', 'to', 'in', 'where', 'what', 'how', 'does', 'do', 'and', 'or', 'for', 'this', 'it']);

export function terms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length > 1 && !STOP.has(t)))];
}

/** Split into fixed-size line windows; line numbers match the original file exactly. */
export function chunkFile(path: string, text: string, size = 40): Chunk[] {
  const lines = text.split('\n');
  const out: Chunk[] = [];
  for (let i = 0; i < lines.length; i += size) {
    const slice = lines.slice(i, i + size);
    out.push({ path, start: i + 1, end: i + slice.length, text: slice.join('\n') });
  }
  return out;
}

/** Pick the paths most likely relevant to the query (path-term hits, README as fallback). */
export function rankPaths(paths: string[], query: string, limit: number): string[] {
  const ts = terms(query);
  const score = (p: string) => {
    const l = p.toLowerCase();
    return ts.filter((t) => l.includes(t)).length * 10 + (/^readme/i.test(p) ? 1 : 0) - p.split('/').length * 0.01;
  };
  return [...paths]
    .map((p) => [p, score(p)] as const)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([p]) => p);
}

/** Keyword-score chunks; zero-hit chunks are dropped so "no evidence" is explicit. */
export function searchChunks(chunks: Chunk[], query: string, limit: number): Chunk[] {
  const ts = terms(query);
  return chunks
    .map((c) => {
      const l = c.text.toLowerCase();
      return { c, s: ts.reduce((n, t) => n + (l.split(t).length - 1), 0) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.c.path + a.c.start < b.c.path + b.c.start ? -1 : 1))
    .slice(0, limit)
    .map((x) => x.c);
}
