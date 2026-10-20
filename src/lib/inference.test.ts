import { describe, expect, it } from 'vitest';
import { splitInference } from './inference';

describe('splitInference', () => {
  it('keeps Markdown (tables, lists) together and pulls out standalone Inference lines', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n**Inference:** probably uses a cache.\n- item one\n- item two';
    expect(splitInference(md)).toEqual([
      { inference: false, text: '| a | b |\n|---|---|\n| 1 | 2 |' },
      { inference: true, text: 'probably uses a cache.' },
      { inference: false, text: '- item one\n- item two' },
    ]);
  });
  it('returns one plain part when there is no Inference line, and nothing for empty input', () => {
    expect(splitInference('just text [a.ts:1-2]')).toEqual([{ inference: false, text: 'just text [a.ts:1-2]' }]);
    expect(splitInference('')).toEqual([{ inference: false, text: '' }]);
  });
  it('does not treat a bullet that mentions inference as an inference line', () => {
    expect(splitInference('- Inference: in a list item').every((p) => !p.inference)).toBe(true);
  });
});
