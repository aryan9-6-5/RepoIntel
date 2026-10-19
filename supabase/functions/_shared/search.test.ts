import { describe, expect, it } from 'vitest';
import { chunkFile, rankPaths, searchChunks } from './search.ts';

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
    expect(rankPaths(paths, 'where is login handled', 2)).toEqual(['src/auth/login.ts', 'README.md']);
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
