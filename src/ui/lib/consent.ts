/**
 * The only file in this project allowed to touch `document.cookie`.
 *
 * The product's promise is that file contents never leave the tab. A theme
 * preference is not file content, but "we have no cookies at all" was a claim
 * that could be checked in one glance, and replacing it with a vague one would
 * be a bad trade. So the exception is deliberately small and mechanically
 * enforced:
 *
 *   - exactly one cookie, named `ec-theme`;
 *   - its value is one of two words, `light` or `dark` — never a file name,
 *     a key, a value, or anything derived from what was pasted;
 *   - it is written only after the reader says yes to the question;
 *   - it is `SameSite=Lax`, `Path=/`, and expires after a year;
 *   - nothing reads it except this module, and `scripts/check-privacy.mjs`
 *     fails the build if any other file mentions a cookie.
 *
 * If someone later needs a second cookie, that is a product decision and a
 * change to the guard — not a line added here.
 */

export const THEME_COOKIE = 'ec-theme';

/** A year, in seconds. Long enough to be useful, short enough to expire. */
const MAX_AGE = 60 * 60 * 24 * 365;

export type StoredTheme = 'light' | 'dark';

function isStoredTheme(value: string): value is StoredTheme {
  return value === 'light' || value === 'dark';
}

/** The remembered choice, or null when nothing was stored or the value is junk. */
export function readThemeCookie(): StoredTheme | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [rawName, ...rest] = part.split('=');
    if (rawName?.trim() !== THEME_COOKIE) continue;
    const value = decodeURIComponent(rest.join('=').trim());
    // Anything else is treated as absent: a tampered or stale value must not
    // steer the interface.
    return isStoredTheme(value) ? value : null;
  }
  return null;
}

/** Ask the browser to remember the choice. Called only after consent. */
export function writeThemeCookie(theme: StoredTheme): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE}=${theme}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax`;
}

/** Remove it. Used by "Forget my theme", and when the reader picks Auto. */
export function clearThemeCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
