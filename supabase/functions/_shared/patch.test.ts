import { describe, expect, it } from 'vitest';
import { applyEdit } from './patch.ts';

const src = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n');

describe('applyEdit', () => {
  it('replaces a range and renders a unified diff with context', () => {
    const r = applyEdit('x.ts', src, { startLine: 4, endLine: 4, newText: 'D!' });
    expect(r.ok && r.patched).toBe('a\nb\nc\nD!\ne\nf\ng');
    expect(r.ok && r.diff).toBe(['--- a/x.ts', '+++ b/x.ts', '@@ -1,7 +1,7 @@', ' a', ' b', ' c', '-d', '+D!', ' e', ' f', ' g'].join('\n'));
  });
  it('supports deletion', () => {
    const r = applyEdit('x.ts', src, { startLine: 2, endLine: 3, newText: '' });
    expect(r.ok && r.patched).toBe('a\nd\ne\nf\ng');
  });
  it('rejects out-of-range, no-op, oversized and malformed edits', () => {
    expect(applyEdit('x', src, { startLine: 0, endLine: 1, newText: 'q' }).ok).toBe(false);
    expect(applyEdit('x', src, { startLine: 5, endLine: 99, newText: 'q' }).ok).toBe(false);
    expect(applyEdit('x', src, { startLine: 1, endLine: 1, newText: 'a' }).ok).toBe(false);
    expect(applyEdit('x', src, { startLine: 1, endLine: 1, newText: 'x'.repeat(5000) }).ok).toBe(false);
    expect(applyEdit('x', src, { startLine: 1.5, endLine: 2, newText: 'q' }).ok).toBe(false);
  });
});
