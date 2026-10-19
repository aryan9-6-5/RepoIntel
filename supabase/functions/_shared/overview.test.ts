import { describe, expect, it } from 'vitest';
import { buildTree, overviewFromPaths, parseManifest } from './overview.ts';

describe('buildTree', () => {
  it('nests paths, dirs first then alphabetical', () => {
    const t = buildTree(['b.ts', 'src/z.ts', 'src/a/x.ts', 'README.md']);
    expect(t.map((n) => n.name)).toEqual(['src', 'README.md', 'b.ts']);
    expect(t[0].children!.map((n) => n.name)).toEqual(['a', 'z.ts']);
    expect(t[0].children![0].children![0].path).toBe('src/a/x.ts');
  });
});

describe('overviewFromPaths', () => {
  it('detects languages, entry points and config files', () => {
    const o = overviewFromPaths(['src/main.tsx', 'src/App.tsx', 'server.py', 'supabase/functions/q/index.ts', 'supabase/functions/_shared/x.ts', 'package.json', 'src/utils/index.ts']);
    expect(o.languages[0]).toEqual({ name: 'TypeScript', files: 5 });
    expect(o.entryPoints).toEqual(['server.py', 'src/main.tsx', 'supabase/functions/q/index.ts']);
    expect(o.configFiles).toEqual(['package.json']);
    expect(o.topDirs[0].name).toBe('src');
  });
});

describe('parseManifest', () => {
  it('parses package.json deps, scripts, main', () => {
    const d = parseManifest('package.json', '{"main":"a.js","dependencies":{"b":"1","a":"1"},"devDependencies":{"t":"1"},"scripts":{"start":"x"}}');
    expect(d).toMatchObject({ runtime: ['a', 'b'], dev: ['t'], main: 'a.js', scripts: { start: 'x' } });
  });
  it('parses requirements.txt and go.mod; invalid JSON returns null', () => {
    expect(parseManifest('requirements.txt', 'fastapi==0.1\n# c\nrequests>=2\n-r other.txt')?.runtime).toEqual(['fastapi', 'requests']);
    expect(parseManifest('go.mod', 'module x\nrequire (\n  github.com/a/b v1.2.3\n)')?.runtime).toEqual(['github.com/a/b']);
    expect(parseManifest('package.json', '{bad')).toBeNull();
    expect(parseManifest('README.md', 'x')).toBeNull();
  });
});
