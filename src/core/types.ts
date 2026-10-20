/**
 * Shared core types. This module (and everything under src/core) must stay
 * framework-free and DOM-free so it can be unit-tested in Node and reused by a
 * future CLI.
 */

export interface Span {
  /** Absolute character offset, inclusive. */
  start: number;
  /** Absolute character offset, exclusive. */
  end: number;
}

export type QuoteStyle = 'none' | 'single' | 'double' | 'backtick';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type DiagnosticCode =
  | 'PARSE_BAD_KEY'
  | 'PARSE_NO_VALUE'
  | 'COLON_NO_SPACE'
  | 'DUP_KEY'
  | 'REF_UNRESOLVED'
  | 'SUSPECT_HASH_TRUNCATION'
  | 'NOT_TEXT'
  | 'TOO_LARGE'
  | 'MANY_KEYS'
  | 'MULTILINE';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  /** 1-based line number the diagnostic points at. */
  line: number;
  message: string;
  key?: string;
}

export interface VarOccurrence {
  key: string;
  /** The key exactly as written (for diagnostics). */
  keyRaw: string;
  /** dotenv-normalised value (trimmed, quotes stripped, \n expanded in double quotes). */
  value: string;
  /** The value exactly as written, including quotes. */
  valueRaw: string;
  quote: QuoteStyle;
  isExport: boolean;
  /** 1-based line where the assignment starts. */
  line: number;
  /** 1-based line where the assignment ends (same as `line` unless multiline). */
  endLine: number;
  /** Offsets of the whole logical line, including any trailing newline. */
  span: Span;
  /** Offsets of the raw value (quotes included). */
  valueSpan: Span;
  /** Offsets of the key itself. */
  keySpan: Span;
  trailingComment?: string;
  /** `${VAR}` / `$VAR` references found in the value. */
  refs: string[];
}

export interface ParsedFile {
  fileId: string;
  /** Every assignment, in source order, including duplicates. */
  occurrences: VarOccurrence[];
  /** Effective occurrence per key: the last assignment wins (dotenv semantics). */
  effective: Map<string, VarOccurrence>;
  /** Keys that only appear commented out, e.g. `# SENTRY_DSN=`. */
  commentedKeys: Set<string>;
  /** First-appearance order of effective keys. */
  order: string[];
  diagnostics: Diagnostic[];
  stats: {
    lines: number;
    bytes: number;
    keyCount: number;
    duplicateCount: number;
  };
}

export interface SourceLine {
  /** 1-based line number. */
  number: number;
  /** Offsets of the line content, excluding the line terminator. */
  span: Span;
  text: string;
}
