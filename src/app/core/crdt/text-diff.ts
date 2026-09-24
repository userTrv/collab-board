/** Minimal single-range diff between two strings (common prefix/suffix), enough for typing. */
export interface TextChange {
  readonly index: number;
  readonly remove: number;
  readonly insert: string;
}

export function diffText(before: string, after: string): TextChange | null {
  if (before === after) return null;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before.charCodeAt(endB - 1) === after.charCodeAt(endA - 1)) {
    endB--;
    endA--;
  }
  return { index: start, remove: endB - start, insert: after.slice(start, endA) };
}

export type TextDelta = readonly { retain?: number; insert?: unknown; delete?: number }[];

/**
 * Maps a caret index through a remote Y.Text delta, so the local cursor stays on the same
 * character when someone else types before it.
 */
export function transformIndex(delta: TextDelta, index: number): number {
  let oldPos = 0; // position in the text *before* the delta
  let result = index;
  for (const op of delta) {
    if (oldPos > index) break;
    if (op.retain !== undefined) {
      oldPos += op.retain;
    } else if (op.insert !== undefined) {
      if (oldPos <= index) result += typeof op.insert === 'string' ? op.insert.length : 1;
    } else if (op.delete !== undefined) {
      if (oldPos < index) result -= Math.min(op.delete, index - oldPos);
      oldPos += op.delete;
    }
  }
  return Math.max(0, result);
}
