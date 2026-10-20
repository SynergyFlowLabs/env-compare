/**
 * Placeholder detection (docs/PRD.md §12.9).
 *
 * Two tiers, deliberately:
 *  - **high confidence** turns a value into the `placeholder` state (a warning),
 *  - **low confidence** never changes state; it is only ever a quiet hint.
 *
 * A false positive here is expensive: telling someone their valid local value is
 * "still the example" teaches them to ignore every warning we show. So the
 * high-confidence list only contains strings nobody sets on purpose.
 */

const HIGH_CONFIDENCE_EXACT = new Set([
  'changeme',
  'change_me',
  'change-me',
  'replace_me',
  'replaceme',
  'replace-me',
  'todo',
  'tbd',
  'fixme',
  'null',
  'undefined',
  'none',
  '...',
  '…',
  'xxx',
  'xxxx',
  '*****',
  '****',
  '----',
  'your-key-here',
  'your_key_here',
  'your-api-key',
  'your_api_key',
  'your-token',
  'your_token',
  'your-secret',
  'your_secret',
  'your-password',
  'your_password',
  'api-key-here',
  'insert-key-here',
  'insert_key_here',
  'add-your-key',
  'add_your_key',
]);

const LOW_CONFIDENCE_EXACT = new Set([
  'test',
  'testing',
  'dummy',
  'fake',
  'example',
  'dev',
  'development',
  'localhost',
  '127.0.0.1',
  'password',
  'admin',
  'demo',
  'sample',
]);

/** `your-...` / `your_...` followed by a credential-ish noun. */
const YOUR_PHRASING =
  /^yours?[-_ ](api|key|token|secret|password|pass|id|client|project|url|domain|anon|service|access|private)/;

/** Whole-value braces/brackets: `<YOUR_KEY>`, `{{TOKEN}}`, `[INSERT_KEY]`. */
const TEMPLATE_BRACKETS = /^(?:<[^<>]*>|\{\{[^{}]*\}\}|\[[^[\]]*\])$/;

/** `<ADD_...>`, `INSERT_..._HERE`, `__SECRET__`. */
const SENTINEL = /^(?:__[A-Z0-9_]*__|<ADD[^<>]*>|INSERT_[A-Z0-9_]*_HERE)$/;

/** An unexpanded reference used *as* the value, e.g. `KEY=${OTHER_KEY}`. */
const WHOLE_REFERENCE = /^\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)$/;

/** `sk_test_xxxxxxxx`, `x{8,}`, `0{8,}`, `your-project-ref`. */
const MASKED_TOKEN = /^(?:[a-z]{2,4}_(?:test|live)_x+|[xX0]{8,}|your[-_]?project[-_]?ref)$/;

/** Values that end in an obvious run of placeholder characters. */
const TRAILING_PLACEHOLDER = /(?:x{4,}|0{4,}|\.{3,}|…)$/;

export function isHighConfidencePlaceholder(value: string): boolean {
  const v = value.trim();
  if (v === '') return false;
  const lower = v.toLowerCase();

  if (HIGH_CONFIDENCE_EXACT.has(lower)) return true;
  if (YOUR_PHRASING.test(lower)) return true;
  if (TEMPLATE_BRACKETS.test(v)) return true;
  if (SENTINEL.test(v)) return true;
  if (WHOLE_REFERENCE.test(v)) return true;
  if (MASKED_TOKEN.test(lower)) return true;
  // e.g. `sk_test_xxxxxxxxxxxx`, `re_xxxxxxxxxxxx`: a real token, then a long
  // run of placeholder characters. Only when nothing but fillers follow.
  if (/(?:^|[_-])[x0]{6,}$/i.test(v)) return true;
  if (TRAILING_PLACEHOLDER.test(lower) && /[x0]{4,}$/.test(lower) && v.length >= 8) return true;
  return false;
}

/** Values that *might* be a leftover example. Never changes state. */
export function isLowConfidencePlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === '') return false;
  return LOW_CONFIDENCE_EXACT.has(v) || /^<.*>$/.test(v);
}
