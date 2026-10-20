import { splitLines } from '../parse';
import { parseEnvFile } from '../parse';
import type { Diagnostic } from '../types';

/**
 * The `/mask` page reads **env files**, not spreadsheets (issue #13).
 *
 * A `.env` file has exactly two things per variable — a key and a value — and a
 * lot of things that are neither: banner comments, section headings, blank
 * lines between groups, and the occasional line that does not parse at all.
 * The page's job is to show the keys and hide the values, so the model here is
 * deliberately the smallest one that can do that:
 *
 *   - one entry per *key*, in file order;
 *   - comments and blank lines are not entries, but they are counted, because
 *     silently swallowing a third of a file is its own kind of bug;
 *   - the first line is a variable like any other. There is no header row to
 *     guess, which is what made the earlier CSV reading print a real value as a
 *     column title;
 *   - duplicate keys resolve the way `dotenv` resolves them (last one wins)
 *     with the count kept so the page can say so.
 *
 * Parsing itself is the compare engine's, so the two pages cannot disagree
 * about quoting, `export`, trailing comments or `${REF}` values.
 */

export interface EnvEntry {
  key: string;
  /** The winning value, dotenv-normalised (quotes stripped, escapes applied). */
  value: string;
  /** 1-based line of the winning assignment. */
  line: number;
  /** How many earlier assignments for this key were overridden. */
  duplicates: number;
}

export interface EnvSource {
  entries: EnvEntry[];
  lineEnding: '\n' | '\r\n';
  /** Lines that are part of the file but not variables. */
  skipped: { comments: number; blank: number; unreadable: number };
  diagnostics: Diagnostic[];
  /**
   * True when the text has no variables at all but does look like a
   * multi-column CSV. The page says so plainly instead of guessing a table.
   */
  looksLikeTable: boolean;
}

/** Diagnostics that mean "a line looked like it wanted to be a variable". */
const UNREADABLE = new Set(['PARSE_BAD_KEY', 'PARSE_NO_VALUE', 'COLON_NO_SPACE']);

export function readEnvSource(text: string): EnvSource {
  const parsed = parseEnvFile('mask', text);

  let comments = 0;
  let blank = 0;
  let firstContentLine: string | null = null;
  const lines = splitLines(text);
  // The splitter keeps the empty line that a trailing newline produces. It is
  // not a blank line in the file, and counting it would put "1 blank line" on
  // almost every file.
  const counted = /[\r\n]$/.test(text) ? lines.slice(0, -1) : lines;
  for (const line of counted) {
    const trimmed = line.text.trim();
    if (trimmed === '') {
      blank += 1;
      continue;
    }
    if (trimmed.startsWith('#')) {
      comments += 1;
      continue;
    }
    firstContentLine ??= trimmed;
  }

  const entries: EnvEntry[] = [];
  const overrides = new Map<string, number>();
  for (const key of parsed.order) {
    const occurrence = parsed.effective.get(key);
    if (!occurrence) continue;
    const duplicates = parsed.occurrences.filter((item) => item.key === key).length - 1;
    if (duplicates > 0) overrides.set(key, duplicates);
    entries.push({ key, value: occurrence.value, line: occurrence.line, duplicates });
  }

  const unreadableLines = new Set(
    parsed.diagnostics.filter((item) => UNREADABLE.has(item.code)).map((item) => item.line),
  );

  return {
    entries,
    lineEnding: text.includes('\r\n') ? '\r\n' : '\n',
    skipped: { comments, blank, unreadable: unreadableLines.size },
    diagnostics: parsed.diagnostics,
    looksLikeTable: entries.length === 0 && looksLikeWideRow(firstContentLine),
  };
}

/**
 * `a,b,c` with no `=` is a CSV, not an env file. Detecting it lets the page say
 * "this is not what this page does" rather than showing an empty table, and it
 * is the one place a delimiter is looked at — for a message, not a parse.
 */
function looksLikeWideRow(line: string | null): boolean {
  if (line === null || line.includes('=')) return false;
  return line.includes(',') || line.includes('\t') || line.split(';').length > 1;
}

/**
 * Quote a value only when env syntax requires it.
 *
 * A masked value is usually plain (`********`, `sk-p****`), but a key left
 * unmasked may hold anything, and the output has to be a file a shell and
 * `dotenv` both read back identically. Double quotes with `\n`, `\r`, `\"` and
 * `\\` escapes are the form both understand.
 */
export function formatValue(value: string): string {
  if (value === '') return '';
  const needsQuotes =
    value !== value.trim() ||
    /[\r\n]/.test(value) ||
    /[#"'`\\]/.test(value) ||
    // A leading quote inside an unquoted value would be read as an opening quote.
    /^\s*['"]/.test(value);
  if (!needsQuotes) return value;

  // Newlines only survive in double quotes, where `dotenv` expands `\n`/`\r`.
  if (/[\r\n]/.test(value)) {
    const escaped = value
      .replaceAll('"', '\\"')
      .replaceAll('\r', '\\r')
      .replaceAll('\n', '\\n');
    return `"${escaped}"`;
  }

  // Single quotes are taken verbatim by every dotenv, so this is the only form
  // that round-trips a value containing `#`, `"` or a backslash exactly.
  if (!value.includes("'")) return `'${value}'`;

  // A value with both a quote style's characters cannot be represented exactly;
  // double quotes with an escaped quote is the closest available.
  return `"${value.replaceAll('"', '\\"')}"`;
}

/** Write entries back as an env file, one `KEY=value` per line. */
export function serializeEnv(
  entries: ReadonlyArray<{ key: string; value: string }>,
  options: { lineEnding?: '\n' | '\r\n'; trailingNewline?: boolean } = {},
): string {
  const lineEnding = options.lineEnding ?? '\n';
  const trailingNewline = options.trailingNewline ?? true;
  const body = entries.map((entry) => `${entry.key}=${formatValue(entry.value)}`).join(lineEnding);
  if (body === '') return '';
  return trailingNewline ? `${body}${lineEnding}` : body;
}
