/**
 * dotenv-compatible value semantics.
 *
 * The regex and the post-processing below are a faithful port of dotenv v18
 * (`lib/main.js`, classic parser — the default), which is BSD-2-Clause. Keeping
 * the exact expression is deliberate: the conformance suite in
 * `tests/unit/dotenv-conformance.test.ts` asserts that our parse equals
 * `dotenv.parse()` for every fixture, so any "improvement" here would be caught.
 *
 * Why vendored instead of importing `dotenv`: it is a Node library (its browser
 * field stubs out `fs`) and importing it would drag Node shims into the bundle.
 * See docs/PRD.md §12.1.
 */

/** The `d` flag gives us match indices, which we need for surgical edits. */
export const DOTENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gmd;

/** Same grammar, non-global, for testing a single line (e.g. a commented assignment). */
export const DOTENV_LINE_SINGLE =
  /^(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/md;

/** Normalise a raw value exactly like dotenv does. */
export function normalizeValue(raw: string): string {
  // dotenv normalises line endings for the whole file before parsing, so a
  // CRLF inside a multiline quoted value arrives as a bare LF.
  let value = raw.replace(/\r\n?/g, '\n').trim();
  const maybeQuote = value[0];
  // Strip one pair of matching surrounding quotes.
  value = value.replace(/^(['"`])([\s\S]*)\1$/gm, '$2');
  // Newlines are only expanded inside double quotes.
  if (maybeQuote === '"') {
    value = value.replace(/\\n/g, '\n');
    value = value.replace(/\\r/g, '\r');
  }
  return value;
}

export function detectQuote(raw: string): 'none' | 'single' | 'double' | 'backtick' {
  const trimmed = raw.trim();
  const first = trimmed[0];
  if (first === "'") return 'single';
  if (first === '"') return 'double';
  if (first === '`') return 'backtick';
  return 'none';
}

/**
 * `${VAR}` and `$VAR` references. dotenv itself does not expand these (that
 * moved to dotenvx / dotenv-expand), so we only record them: an unresolved
 * reference in the same file is a useful hint, never a value rewrite.
 */
const REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

export function extractRefs(value: string): string[] {
  const refs: string[] = [];
  REFERENCE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REFERENCE.exec(value)) !== null) {
    const name = match[1] ?? match[2];
    if (name && !refs.includes(name)) refs.push(name);
  }
  return refs;
}
