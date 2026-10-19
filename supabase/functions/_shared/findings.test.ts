import { describe, expect, it } from 'vitest';
import { score, staticChecks, validateHypotheses } from './findings.ts';

// Seeded benchmark: line numbers are the ground truth labels.
const SEEDED = [
  'export function run(input) {',
  '  return eval(input);',
  '}',
  'const apiKey = "EXAMPLE_NOT_A_REAL_KEY";',
  'try { risky(); } catch (e) {}',
  'el.innerHTML = userText;',
  'if (user = admin) { grant(); }',
  '// eval(commentedOut)',
  'const safe = JSON.parse(input);',
].join('\n');

const LABELS = [
  { rule: 'eval', line: 2 },
  { rule: 'hardcoded-secret', line: 4 },
  { rule: 'empty-catch', line: 5 },
  { rule: 'html-injection', line: 6 },
  { rule: 'loose-equality-null', line: 7 },
];

describe('staticChecks benchmark', () => {
  it('finds all seeded bugs with no false positives (comments and safe code ignored)', () => {
    const s = score(staticChecks(SEEDED), LABELS);
    expect(s).toMatchObject({ tp: 5, fp: 0, fn: 0, precision: 1, recall: 1 });
  });
  it('is deterministic', () => {
    expect(staticChecks(SEEDED)).toEqual(staticChecks(SEEDED));
  });
});

describe('validateHypotheses', () => {
  it('drops findings pointing at non-existent lines and labels the rest unverified', () => {
    const r = validateHypotheses([{ line: 2, title: 'x', severity: 'high' }, { line: 999, title: 'bad' }, 'junk'], SEEDED);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'hypothesis', confidence: 'low', evidence: 'return eval(input);' });
  });
});
