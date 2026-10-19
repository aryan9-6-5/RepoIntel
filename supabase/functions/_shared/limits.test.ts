import { describe, expect, it } from 'vitest';
import { TtlCache, rateLimited } from './limits.ts';

describe('rateLimited', () => {
  it('blocks after max calls in the window and recovers after it', () => {
    const k = 'ip-test';
    for (let i = 0; i < 3; i++) expect(rateLimited(k, 3, 1000, 1000 + i)).toBe(false);
    expect(rateLimited(k, 3, 1000, 1010)).toBe(true);
    expect(rateLimited(k, 3, 1000, 5000)).toBe(false);
  });
});

describe('TtlCache', () => {
  it('expires entries', () => {
    const c = new TtlCache<number>(100);
    c.set('a', 1, 0);
    expect(c.get('a', 50)).toBe(1);
    expect(c.get('a', 150)).toBeUndefined();
  });
});
