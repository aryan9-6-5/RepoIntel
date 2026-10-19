export const LIMITS = {
  maxFiles: 3000,
  maxFileBytes: 200_000,
  maxTotalBytes: 20_000_000,
} as const;

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
}

export interface SelectResult {
  files: TreeEntry[];
  skipped: { excluded: number; oversize: number };
  totalBytes: number;
  error?: 'too_many_files' | 'repo_too_large';
}

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'build', 'out', 'target', '__pycache__',
  '.next', '.nuxt', 'coverage', '.venv', 'venv', '.idea', '.vscode', 'third_party', 'bower_components',
]);

const EXCLUDED_NAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'cargo.lock', 'poetry.lock',
  'composer.lock', 'gemfile.lock', 'go.sum',
]);

const SOURCE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'kt', 'rb', 'php', 'cs', 'c', 'h',
  'cc', 'cpp', 'hpp', 'swift', 'scala', 'sh', 'sql', 'json', 'toml', 'yaml', 'yml', 'md', 'html', 'css',
  'vue', 'svelte',
]);

function isSafePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  return !path.split('/').some((seg) => seg === '..' || seg === '');
}

function isEligible(path: string): boolean {
  const segs = path.split('/');
  const name = segs[segs.length - 1].toLowerCase();
  if (segs.slice(0, -1).some((s) => EXCLUDED_DIRS.has(s.toLowerCase()))) return false;
  if (EXCLUDED_NAMES.has(name) || /\.min\.(js|css)$/.test(name) || name.endsWith('.map')) return false;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  return SOURCE_EXT.has(ext);
}

/** Pure, deterministic selection of indexable files from a git tree. */
export function selectFiles(tree: TreeEntry[]): SelectResult {
  const out: SelectResult = { files: [], skipped: { excluded: 0, oversize: 0 }, totalBytes: 0 };
  for (const e of tree) {
    if (e.type !== 'blob') continue;
    if (!isSafePath(e.path) || !isEligible(e.path)) { out.skipped.excluded++; continue; }
    if ((e.size ?? 0) > LIMITS.maxFileBytes) { out.skipped.oversize++; continue; }
    out.files.push(e);
    out.totalBytes += e.size ?? 0;
  }
  out.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (out.files.length > LIMITS.maxFiles) out.error = 'too_many_files';
  else if (out.totalBytes > LIMITS.maxTotalBytes) out.error = 'repo_too_large';
  return out;
}
