import { describe, expect, it } from 'vitest';
import { importSpecs, normalize, pickContext, resolveImport } from './imports.ts';

describe('importSpecs', () => {
  it('finds ES, CommonJS, side-effect and python relative imports; ignores packages', () => {
    const t = `import a from './a';\nimport { b } from "../lib/b.js";\nconst c = require('./c');\nimport './side';\nimport x from 'react';\nexport * from './re';\nfrom .utils import f\nfrom ..pkg.mod import g\nfrom os import path`;
    expect(importSpecs(t).sort()).toEqual(['../lib/b.js', './a', './c', './re', './side', 'py:1:utils', 'py:2:pkg.mod'].sort());
  });
});

describe('resolveImport / pickContext', () => {
  const all = ['src/app.ts', 'src/lib/index.ts', 'src/util.ts', 'src/data.json', 'pkg/__init__.py', 'pkg/sub/run.py', 'pkg/helpers.py', 'pkg/sub/inner.py'];
  it('tries extensions and index files; rejects escapes', () => {
    expect(resolveImport('src/app.ts', './util', new Set(all))).toBe('src/util.ts');
    expect(resolveImport('src/app.ts', './lib', new Set(all))).toBe('src/lib/index.ts');
    expect(resolveImport('src/app.ts', '../../../x', new Set(all))).toBeNull();
    expect(resolveImport('src/app.ts', './missing', new Set(all))).toBeNull();
  });
  it('resolves python relative imports by dot depth', () => {
    expect(resolveImport('pkg/sub/run.py', 'py:2:helpers', new Set(all))).toBe('pkg/helpers.py');
    expect(resolveImport('pkg/sub/run.py', 'py:1:inner', new Set(all))).toBe('pkg/sub/inner.py');
  });
  it('picks distinct existing files, never itself, capped', () => {
    const text = `import a from './util'; import b from './util'; import c from './lib'; import d from './app'; import e from './nope'`;
    expect(pickContext(text, 'src/app.ts', all, 3)).toEqual(['src/util.ts', 'src/lib/index.ts']);
    expect(pickContext(text, 'src/app.ts', all, 1)).toEqual(['src/util.ts']);
  });
  it('normalize handles dots', () => {
    expect(normalize('a/./b/../c')).toBe('a/c');
    expect(normalize('../a')).toBeNull();
  });
});
