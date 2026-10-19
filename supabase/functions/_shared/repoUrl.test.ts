import { describe, expect, it } from 'vitest';
import { parseRepoRef, repoId } from './repoUrl.ts';

describe('parseRepoRef', () => {
  it('parses owner/repo shorthand', () => {
    expect(parseRepoRef('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
  });
  it('parses https URLs, .git suffix, trailing paths and slashes', () => {
    expect(parseRepoRef('https://github.com/aryan9-6-5/RepoIntel.git')).toEqual({ owner: 'aryan9-6-5', repo: 'RepoIntel' });
    expect(parseRepoRef('https://github.com/a/b/tree/main/src')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseRepoRef('  github.com/a/b/  ')).toEqual({ owner: 'a', repo: 'b' });
  });
  it('rejects non-GitHub hosts, bad names, and traversal', () => {
    for (const bad of ['', 'https://gitlab.com/a/b', 'a', 'a/b/c d', '../x', 'a/..', 'http://evil.com/github.com/a/b', '-a/b', 'a/' + 'x'.repeat(101)]) {
      expect(parseRepoRef(bad), bad).toBeNull();
    }
  });
});

describe('repoId', () => {
  it('is deterministic and case-insensitive', () => {
    expect(repoId({ owner: 'Facebook', repo: 'React' })).toBe('facebook/react');
  });
});
