import type { SourceLine } from '../types';

/**
 * Split text into physical lines, preserving absolute offsets.
 *
 * We never rewrite the input: every downstream feature (raw view, surgical
 * edits, diagnostics) works off these offsets. `\r\n`, `\n` and a lone `\r`
 * are all treated as line terminators, matching dotenv's normalisation.
 */
export function splitLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  let number = 1;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') {
      lines.push({
        number,
        span: { start, end: i },
        text: text.slice(start, i),
      });
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      i += 1;
      start = i;
      number += 1;
    } else {
      i += 1;
    }
  }

  // Trailing line (may be empty when the text ends with a newline).
  lines.push({ number, span: { start, end: text.length }, text: text.slice(start) });
  return lines;
}

/** Line index for offset lookup: binary search over already-sorted line starts. */
export function lineNumberAt(lines: SourceLine[], offset: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = lines[mid];
    if (!line) break;
    if (line.span.start <= offset) {
      found = line.number;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function countLines(text: string): number {
  if (text === '') return 0;
  const lines = splitLines(text);
  // A trailing newline does not create a real extra line.
  const last = lines[lines.length - 1];
  return last && last.text === '' ? lines.length - 1 : lines.length;
}
