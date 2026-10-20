import type { QuoteStyle, Span } from '../types';
import { splitLines } from '../parse';

/**
 * Surgical text edits (docs/PRD.md §12.13).
 *
 * The table never regenerates a file. Comments, blank lines, ordering, quoting
 * and line endings belong to the user, so every action is expressed as a patch
 * against the original text. That is also what makes undo trivial: keep the
 * previous string.
 */

export type TextPatch =
  | { kind: 'replaceValue'; span: Span; nextValue: string; quote: QuoteStyle }
  | { kind: 'insertKey'; key: string; value?: string; comment?: string }
  | { kind: 'removeKey'; span: Span }
  | { kind: 'uncomment'; line: number };

export interface PatchResult {
  text: string;
  /** Human-readable notes for the UI (e.g. "quoted because the value contains #"). */
  notes: string[];
}

const PATCH_HEADER = '# Added by EnvCompare';

export function applyPatch(text: string, patch: TextPatch): PatchResult {
  switch (patch.kind) {
    case 'replaceValue':
      return replaceValue(text, patch.span, patch.nextValue, patch.quote);
    case 'insertKey':
      return insertKey(text, patch.key, patch.value, patch.comment);
    case 'removeKey':
      return removeLine(text, patch.span);
    case 'uncomment':
      return uncomment(text, patch.line);
  }
}

export function applyPatches(text: string, patches: TextPatch[]): PatchResult {
  let current = text;
  const notes: string[] = [];
  for (const patch of patches) {
    const result = applyPatch(current, patch);
    current = result.text;
    notes.push(...result.notes);
  }
  return { text: current, notes };
}

function replaceValue(text: string, span: Span, value: string, quote: QuoteStyle): PatchResult {
  const rendered = renderValue(value, quote);
  return {
    text: text.slice(0, span.start) + rendered.text + text.slice(span.end),
    notes: rendered.note ? [rendered.note] : [],
  };
}

/**
 * Render a value so that re-parsing it yields exactly `value`.
 *
 * dotenv only strips the outer quotes and expands `\n` / `\r` inside double
 * quotes — it does not unescape `\\`, `\'` or `\"`. So the safest rendering is to
 * pick a quote style the content does not collide with, and only fall back to
 * escaping (lossy for a literal backslash) when nothing else works. The
 * original quote style is preserved whenever it can hold the new value.
 */
export function renderValue(
  value: string,
  preferred: QuoteStyle = 'none',
): { text: string; note?: string } {
  if (value === '') {
    return { text: preferred === 'none' ? '' : quoteWith(value, preferred).text };
  }

  if (preferred !== 'none' && canUse(value, preferred)) {
    return quoteWith(value, preferred);
  }
  if (canUse(value, 'none')) {
    return { text: value };
  }
  // Lossless options first; the escaping path (double quotes) comes last.
  for (const style of ['single', 'backtick', 'double'] as const) {
    if (canUse(value, style)) {
      return quoteWith(value, style, 'Quoted the value so it stays one value when read back.');
    }
  }
  // Contains both quote types, a backtick, a newline and an escape sequence:
  // escape into double quotes and be explicit that it is best-effort.
  return quoteWith(
    value,
    'double',
    'This value contains several kinds of quotes, so it was escaped — check the line.',
  );
}

function quoteWith(value: string, style: QuoteStyle, note?: string): { text: string; note?: string } {
  const withNote = (text: string) => (note ? { text, note } : { text });
  switch (style) {
    case 'double':
      return withNote(
        `"${value
          .replace(/\r\n?/g, '\n')
          .replace(/\n/g, '\\n')
          .replace(/"/g, '\\"')}"`,
      );
    case 'single':
      return withNote(`'${value.replace(/'/g, "\\'")}'`);
    case 'backtick':
      return withNote(`\`${value.replace(/`/g, '\\`')}\``);
    case 'none':
      return withNote(value);
  }
}

/**
 * Can `value` round-trip through `style` unchanged?
 *
 * - `none`: only when it has nothing a parser would reinterpret.
 * - `double`: unless the value contains a literal `\n` / `\r` / `\"` sequence,
 *   which dotenv would expand or swallow.
 * - `single` / `backtick`: unless it contains their own quote character or a
 *   raw newline (we prefer escaped newlines in double quotes).
 */
function canUse(value: string, style: QuoteStyle): boolean {
  const literalEscape = /\\[nr"]/.test(value);
  switch (style) {
    case 'double':
      return !literalEscape;
    case 'single':
      return !value.includes("'") && !/[\n\r]/.test(value);
    case 'backtick':
      return !value.includes('`') && !/[\n\r]/.test(value);
    case 'none':
      return (
        value !== '' &&
        !/[#\n\r"]/.test(value) &&
        !/^\s|\s$/.test(value) &&
        !literalEscape
      );
  }
}

function insertKey(text: string, key: string, value = '', comment?: string): PatchResult {
  const eol = detectEol(text);
  const header = comment ?? PATCH_HEADER;
  let next = text;

  if (next.length > 0 && !next.endsWith('\n') && !next.endsWith('\r')) {
    next += eol;
  }
  // One blank line before the new block, so the addition is visually separate.
  if (next.length > 0 && !/\n[ \t]*\r?\n$/.test(next)) {
    next += eol;
  }
  next += `${header}${eol}${key}=${value}${eol}`;
  return { text: next, notes: [] };
}

function removeLine(text: string, span: Span): PatchResult {
  let start = span.start;
  let end = span.end;
  // The span already includes the trailing newline for a normal line. When the
  // removed line is the last one (no trailing newline), also drop the preceding
  // newline so we do not leave a trailing blank line behind.
  if (end >= text.length && start > 0 && text[start - 1] === '\n') {
    start -= 1;
    if (text[start - 1] === '\r') start -= 1;
  }
  return { text: text.slice(0, start) + text.slice(end), notes: [] };
}

function uncomment(text: string, lineNumber: number): PatchResult {
  const lines = splitLines(text);
  const line = lines[lineNumber - 1];
  if (!line) return { text, notes: [] };
  const replaced = line.text.replace(/^(\s*)#+\s?/, '$1');
  if (replaced === line.text) return { text, notes: [] };
  return {
    text: text.slice(0, line.span.start) + replaced + text.slice(line.span.end),
    notes: [],
  };
}

/** The dominant line ending of a file, so edits never mix conventions. */
export function detectEol(text: string): '\r\n' | '\n' {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  return crlf > lf ? '\r\n' : '\n';
}
