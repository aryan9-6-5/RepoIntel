import { describe, expect, it } from 'vitest';
import { sortTree } from './tree';
import { buildTree } from '../../supabase/functions/_shared/overview';

describe('sortTree', () => {
  it('puts source folders first, then files, then dot-dirs and test/docs folders', () => {
    const t = buildTree(['.github/ci.yml', 'README.md', 'scripts/b.sh', 'test/a.test.ts', 'src/index.ts', 'docs/x.md', 'lib/util.ts', 'package.json']);
    expect(sortTree(t).map((n) => n.name)).toEqual(['lib', 'src', 'README.md', 'package.json', '.github', 'docs', 'scripts', 'test']);
  });
  it('sorts nested levels too and does not mutate the input', () => {
    const t = buildTree(['src/test/t.ts', 'src/app.ts', 'src/core/c.ts']);
    const before = JSON.stringify(t);
    expect(sortTree(t)[0].children!.map((n) => n.name)).toEqual(['core', 'app.ts', 'test']);
    expect(JSON.stringify(t)).toBe(before);
  });
});
