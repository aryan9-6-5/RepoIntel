export interface Edit {
  startLine: number; // 1-based inclusive
  endLine: number;
  newText: string; // replacement for the range ("" deletes it)
}

export const MAX_RANGE = 30;
export const MAX_NEW_CHARS = 2_000;

export type EditResult = { ok: true; patched: string; diff: string } | { ok: false; error: string };

/** Validate a model-proposed edit against the real file, apply it, and render a unified diff. */
export function applyEdit(path: string, text: string, e: Edit): EditResult {
  const lines = text.split('\n');
  if (![e.startLine, e.endLine].every(Number.isInteger) || e.startLine < 1 || e.endLine < e.startLine || e.endLine > lines.length)
    return { ok: false, error: 'Edit range is outside the file.' };
  if (e.endLine - e.startLine + 1 > MAX_RANGE) return { ok: false, error: `Edit touches more than ${MAX_RANGE} lines.` };
  if (typeof e.newText !== 'string' || e.newText.length > MAX_NEW_CHARS) return { ok: false, error: 'Replacement text too large.' };

  const oldBlock = lines.slice(e.startLine - 1, e.endLine);
  const newBlock = e.newText === '' ? [] : e.newText.split('\n');
  if (oldBlock.join('\n') === newBlock.join('\n')) return { ok: false, error: 'Edit changes nothing.' };

  const patched = [...lines.slice(0, e.startLine - 1), ...newBlock, ...lines.slice(e.endLine)].join('\n');
  const ctx = 3;
  const from = Math.max(1, e.startLine - ctx);
  const before = lines.slice(from - 1, e.startLine - 1);
  const after = lines.slice(e.endLine, e.endLine + ctx);
  const oldCount = before.length + oldBlock.length + after.length;
  const newCount = before.length + newBlock.length + after.length;
  const diff = [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${from},${oldCount} +${from},${newCount} @@`,
    ...before.map((l) => ' ' + l),
    ...oldBlock.map((l) => '-' + l),
    ...newBlock.map((l) => '+' + l),
    ...after.map((l) => ' ' + l),
  ].join('\n');
  return { ok: true, patched, diff };
}
