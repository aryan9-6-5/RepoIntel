// Resolve a file's relative imports to other files in the repo (JS/TS and Python). Pure; no network.

/** Normalize a posix path, resolving "." and "..". Returns null if it escapes the root. */
export function normalize(p: string): string | null {
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (!out.length) return null; out.pop(); } else out.push(seg);
  }
  return out.join('/');
}

const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const JS_EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.mjs'];

/** Relative import specifiers found in source text. JS: './x'; Python: '.'-prefixed modules encoded as 'py:<dots>:<module>'. */
export function importSpecs(text: string): string[] {
  const out = new Set<string>();
  const js = /(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|import\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const m of text.matchAll(js)) out.add((m[1] ?? m[2] ?? m[3])!);
  for (const m of text.matchAll(/^\s*from\s+(\.+)([\w.]*)\s+import/gm)) out.add(`py:${m[1].length}:${m[2]}`);
  return [...out];
}

export function resolveImport(from: string, spec: string, all: Set<string>): string | null {
  if (spec.startsWith('py:')) {
    const [, dots, mod] = spec.split(':');
    let base = dirOf(from);
    for (let i = 1; i < Number(dots); i++) base = dirOf(base);
    const rel = mod.split('.').filter(Boolean).join('/');
    const stem = normalize(`${base}/${rel}`);
    if (stem === null) return null;
    for (const c of [`${stem}.py`, `${stem}/__init__.py`]) if (all.has(c)) return c;
    return null;
  }
  const stem = normalize(`${dirOf(from)}/${spec}`);
  if (stem === null) return null;
  for (const e of JS_EXT) if (all.has(stem + e)) return stem + e;
  return null;
}

/** Up to `max` distinct repo files this file imports (never itself). Order = first appearance in the source. */
export function pickContext(text: string, from: string, all: string[], max = 3): string[] {
  const set = new Set(all);
  const out: string[] = [];
  for (const s of importSpecs(text)) {
    const r = resolveImport(from, s, set);
    if (r && r !== from && !out.includes(r)) out.push(r);
    if (out.length >= max) break;
  }
  return out;
}
