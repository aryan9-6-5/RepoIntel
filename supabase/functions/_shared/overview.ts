export interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[]; // present for directories
}

/** Nested, sorted (dirs first, then A-Z) tree from flat file paths. */
export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const p of paths) {
    let node = root;
    const segs = p.split('/');
    segs.forEach((seg, i) => {
      const path = segs.slice(0, i + 1).join('/');
      node.children ??= [];
      let next = node.children.find((c) => c.name === seg);
      if (!next) {
        next = i === segs.length - 1 ? { name: seg, path } : { name: seg, path, children: [] };
        node.children.push(next);
      }
      node = next;
    });
  }
  const sort = (n: TreeNode) => {
    n.children?.sort((a, b) => Number(!!b.children) - Number(!!a.children) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    n.children?.forEach(sort);
  };
  sort(root);
  return root.children ?? [];
}

const LANG: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', rb: 'Ruby', php: 'PHP', cs: 'C#', c: 'C', h: 'C',
  cc: 'C++', cpp: 'C++', hpp: 'C++', swift: 'Swift', scala: 'Scala', sh: 'Shell', sql: 'SQL', vue: 'Vue', svelte: 'Svelte',
};

const ENTRY = /^(?:(?:src|app|cmd\/[^/]+|lib)\/)?(?:main|index|app|server|cli)\.(?:ts|tsx|js|jsx|mjs|py|go|rs)$/;
const FUNCTION_ENTRY = /^supabase\/functions\/[^/_][^/]*\/index\.ts$/;
const CONFIG = new Set([
  'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'tailwind.config.ts', 'tailwind.config.js',
  'dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'pyproject.toml', 'requirements.txt', 'setup.py', 'go.mod',
  'cargo.toml', 'makefile', 'eslint.config.js', '.eslintrc.json', 'vitest.config.ts', 'jest.config.js', 'config.toml',
]);

export interface Overview {
  languages: { name: string; files: number }[];
  topDirs: { name: string; files: number }[];
  entryPoints: string[];
  configFiles: string[];
  fileCount: number;
}

/** Deterministic facts derived only from file paths. */
export function overviewFromPaths(paths: string[]): Overview {
  const langs = new Map<string, number>();
  const dirs = new Map<string, number>();
  for (const p of paths) {
    const ext = p.includes('.') ? p.slice(p.lastIndexOf('.') + 1).toLowerCase() : '';
    if (LANG[ext]) langs.set(LANG[ext], (langs.get(LANG[ext]) ?? 0) + 1);
    const top = p.includes('/') ? p.split('/')[0] : '(root)';
    dirs.set(top, (dirs.get(top) ?? 0) + 1);
  }
  const rank = (m: Map<string, number>) =>
    [...m].map(([name, files]) => ({ name, files })).sort((a, b) => b.files - a.files || (a.name < b.name ? -1 : 1));
  return {
    languages: rank(langs),
    topDirs: rank(dirs),
    entryPoints: paths.filter((p) => ENTRY.test(p) || FUNCTION_ENTRY.test(p)).sort(),
    configFiles: paths.filter((p) => CONFIG.has(p.split('/').pop()!.toLowerCase())).sort(),
    fileCount: paths.length,
  };
}

export interface Dependencies {
  source: string;
  runtime: string[];
  dev: string[];
  scripts?: Record<string, string>;
  main?: string;
}

/** Parse a manifest's content. Supports package.json, requirements.txt, go.mod. Returns null if unsupported/invalid. */
export function parseManifest(path: string, text: string): Dependencies | null {
  const name = path.split('/').pop()!.toLowerCase();
  try {
    if (name === 'package.json') {
      const j = JSON.parse(text);
      return {
        source: path,
        runtime: Object.keys(j.dependencies ?? {}).sort(),
        dev: Object.keys(j.devDependencies ?? {}).sort(),
        scripts: j.scripts && typeof j.scripts === 'object' ? j.scripts : undefined,
        main: typeof j.main === 'string' ? j.main : undefined,
      };
    }
    if (name === 'requirements.txt') {
      const runtime = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('-'))
        .map((l) => l.split(/[=<>~!;[ ]/)[0]).filter(Boolean);
      return { source: path, runtime: [...new Set(runtime)].sort(), dev: [] };
    }
    if (name === 'go.mod') {
      const runtime = [...text.matchAll(/^\s*(?:require\s+)?([\w.\-/]+\.[\w.\-/]+)\s+v[\w.\-+]+/gm)].map((m) => m[1]);
      return { source: path, runtime: [...new Set(runtime)].sort(), dev: [] };
    }
  } catch {
    return null;
  }
  return null;
}
