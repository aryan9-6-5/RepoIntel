import { describe, expect, it } from 'vitest';
import { corsHeadersFor, validateSummarizeBody } from './validate.ts';

const repo = { name: 'r', description: 'd', language: 'TS', stargazers_count: 1, forks_count: 2, topics: ['a'], license: { name: 'MIT' }, updated_at: '2024-01-01T00:00:00Z' };

describe('validateSummarizeBody', () => {
  it('accepts a valid repo-summary and trims/limits strings', () => {
    const r = validateSummarizeBody({ type: 'repo-summary', repoData: { ...repo, description: 'x'.repeat(5000) } });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.type === 'repo-summary') expect(r.value.repoData.description!.length).toBeLessThanOrEqual(500);
  });
  it('rejects bad type, non-objects, missing fields and oversized lists', () => {
    expect(validateSummarizeBody(null).ok).toBe(false);
    expect(validateSummarizeBody({ type: 'nope' }).ok).toBe(false);
    expect(validateSummarizeBody({ type: 'repo-summary', repoData: { name: 5 } }).ok).toBe(false);
    const many = Array.from({ length: 500 }, () => ({ name: 'x', stargazers_count: 0 }));
    const r = validateSummarizeBody({ type: 'profile-summary', profileData: { user: { login: 'u', public_repos: 1, followers: 1 }, repositories: many } });
    expect(r.ok && r.value.type === 'profile-summary' && r.value.profileData.repositories.length).toBe(20);
  });
});

describe('corsHeadersFor', () => {
  it('echoes only allowlisted origins', () => {
    const allow = ['http://localhost:8080'];
    expect(corsHeadersFor('http://localhost:8080', allow)['Access-Control-Allow-Origin']).toBe('http://localhost:8080');
    expect(corsHeadersFor('https://evil.example', allow)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeadersFor(null, allow)['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
