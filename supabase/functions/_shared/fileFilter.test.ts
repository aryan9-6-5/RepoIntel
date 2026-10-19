import { describe, expect, it } from 'vitest';
import { LIMITS, selectFiles, type TreeEntry } from './fileFilter.ts';

const f = (path: string, size = 100): TreeEntry => ({ path, type: 'blob', size, sha: 'sha-' + path });

describe('selectFiles', () => {
  it('keeps source files and drops binary, vendored, generated, lock and oversize files', () => {
    const r = selectFiles([
      f('src/app.ts'), f('README.md'), f('lib/util.py'),
      f('logo.png'), f('node_modules/x/index.js'), f('dist/bundle.js'),
      f('package-lock.json'), f('vendor/a.go'), f('src/app.min.js'),
      f('big.ts', LIMITS.maxFileBytes + 1), f('.git/config'),
      { path: 'src', type: 'tree', sha: 't' },
    ]);
    expect(r.files.map((x) => x.path)).toEqual(['README.md', 'lib/util.py', 'src/app.ts']);
    expect(r.skipped.oversize).toBe(1);
    expect(r.skipped.excluded).toBeGreaterThanOrEqual(7);
  });
  it('is deterministic regardless of input order', () => {
    const a = selectFiles([f('b.ts'), f('a.ts')]).files.map((x) => x.path);
    const b = selectFiles([f('a.ts'), f('b.ts')]).files.map((x) => x.path);
    expect(a).toEqual(b);
  });
  it('rejects path traversal and absolute paths', () => {
    expect(selectFiles([f('../etc/passwd.ts'), f('/abs.ts'), f('a/../b.ts')]).files).toEqual([]);
  });
  it('flags too many files and total bytes instead of silently truncating', () => {
    const many = Array.from({ length: LIMITS.maxFiles + 1 }, (_, i) => f(`s/f${i}.ts`));
    expect(selectFiles(many).error).toBe('too_many_files');
    const heavy = Array.from({ length: 200 }, (_, i) => f(`s/f${i}.ts`, LIMITS.maxFileBytes));
    expect(selectFiles(heavy).error).toBe('repo_too_large');
  });
});
