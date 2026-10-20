import { describe, expect, it } from 'vitest';
import { chunkFile, isAuxPath, rankPaths, searchChunks } from './search.ts';

describe('chunkFile', () => {
  it('keeps exact 1-based line ranges that reproduce the source', () => {
    const text = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join('\n');
    const chunks = chunkFile('a.ts', text, 40);
    expect(chunks[0]).toMatchObject({ path: 'a.ts', start: 1, end: 40 });
    expect(chunks[2]).toMatchObject({ start: 81, end: 100 });
    for (const c of chunks) expect(c.text).toBe(text.split('\n').slice(c.start - 1, c.end).join('\n'));
  });
});

describe('rankPaths', () => {
  it('prefers paths matching query terms, deterministically', () => {
    const paths = ['src/auth/login.ts', 'src/util.ts', 'README.md'];
    expect(rankPaths(paths, 'where is login handled', 2)).toEqual(['src/auth/login.ts', 'src/util.ts']);
  });
});

describe('rankPaths abbreviations', () => {
  it('matches a term that abbreviates a path word', () => {
    expect(rankPaths(['lib/util.js', 'lib/response.js', 'lib/application.js'], 'res.cookie options', 1)).toEqual(['lib/response.js']);
    expect(rankPaths(['lib/util.js', 'lib/response.js', 'lib/application.js'], 'app.use middleware', 1)).toEqual(['lib/application.js']);
  });
});

describe('no path match: source files outrank CI, config and dot-directories', () => {
  it('reproduces the itsdangerous failure (CI yaml and README used to win)', () => {
    const paths = ['.github/workflows/publish.yaml', '.devcontainer/devcontainer.json', 'README.md', 'pyproject.toml', 'src/pkg/exc.py', 'src/pkg/signer.py', 'src/pkg/timed.py'];
    expect(rankPaths(paths, 'Raised if a signature timestamp is older than max_age.', 3).sort()).toEqual(['src/pkg/exc.py', 'src/pkg/signer.py', 'src/pkg/timed.py']);
  });
  it('treats dot-directories and benchmark files as auxiliary', () => {
    expect(isAuxPath('.github/workflows/ci.yml')).toBe(true);
    expect(isAuxPath('src/parse.bench.ts')).toBe(true);
    expect(isAuxPath('src/parse.ts')).toBe(false);
  });
});

describe('test files rank below source', () => {
  it('prefers source over a same-named test path', () => {
    expect(rankPaths(['test/res.cookie.js', 'lib/response.js'], 'res.cookie', 1)).toEqual(['lib/response.js']);
  });
});

describe('searchChunks resists repetition', () => {
  it('a changelog repeating a term does not outrank source covering all terms', () => {
    const cs = [
      { path: 'History.md', start: 1, end: 5, text: 'res.cookie res.cookie res.cookie res.cookie res.cookie res.cookie' },
      { path: 'lib/response.js', start: 1, end: 5, text: 'res.cookie = function (name, value, options) { set cookie options }' },
    ];
    expect(searchChunks(cs, 'res.cookie set cookie options', 1)[0].path).toBe('lib/response.js');
  });
});

describe('searchChunks', () => {
  it('ranks chunks by term hits and returns nothing without evidence', () => {
    const cs = [
      { path: 'a.ts', start: 1, end: 2, text: 'function login(user) {}' },
      { path: 'b.ts', start: 1, end: 2, text: 'unrelated code' },
    ];
    expect(searchChunks(cs, 'login user', 5).map((c) => c.path)).toEqual(['a.ts']);
    expect(searchChunks(cs, 'zzzz', 5)).toEqual([]);
  });
});
