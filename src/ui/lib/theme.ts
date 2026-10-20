import { useCallback, useSyncExternalStore } from 'react';
import {
  clearThemeCookie,
  readThemeCookie,
  writeThemeCookie,
  type StoredTheme,
} from './consent';

export type Theme = 'system' | 'light' | 'dark';

/**
 * Theme choice, and the consent that decides whether it is remembered.
 *
 * Three rules, in order of importance:
 *
 *   1. Choosing a theme always applies it. Applying is not storage.
 *   2. Remembering it needs consent. Until the reader says yes, the choice
 *      lives in memory and is gone on reload. `system` (follow the OS) writes
 *      nothing at all, ever, because there is nothing to remember.
 *   3. Saying no is respected. "Not now" is remembered for the session, so the
 *      question is not asked again every time someone toggles the theme — a
 *      consent prompt that nags is not consent.
 *
 * All cookie access lives in ./consent.ts, which the privacy guard allows to be
 * the only file that mentions a cookie.
 */

interface State {
  theme: Theme;
  /** True when a value is actually stored in the cookie. */
  remembered: boolean;
  /** The consent question is on screen. */
  asking: boolean;
  /** The reader said "Not now" in this session. */
  declined: boolean;
  /** The theme waiting for an answer to the consent question. */
  pending: StoredTheme | null;
}

let state: State = {
  theme: 'system',
  remembered: false,
  asking: false,
  declined: false,
  pending: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') {
    // Absent, not "system": CSS keys off the attribute, and an absent attribute
    // is what lets the prefers-color-scheme query apply. `color-scheme` follows
    // from the same attribute in tokens.css, which also keeps native UI
    // (scrollbars, form controls, the caret) in step with the palette.
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

/**
 * Read the stored choice once, at module load.
 *
 * Reading a cookie that is already on the device is not a privacy event — it
 * only restores what the reader explicitly asked to be remembered. Writing is
 * the part that needs consent, and writing never happens here.
 */
function hydrate() {
  const stored = readThemeCookie();
  if (!stored) return;
  state = { ...state, theme: stored, remembered: true };
  apply(stored);
}

export function setTheme(theme: Theme) {
  if (theme === 'system') {
    // Auto means "follow the OS", so there is nothing worth remembering.
    if (state.remembered) clearThemeCookie();
    state = { ...state, theme, remembered: false, pending: null, asking: false };
    apply(theme);
    emit();
    return;
  }

  if (state.remembered) {
    writeThemeCookie(theme);
    state = { ...state, theme, pending: null };
    apply(theme);
    emit();
    return;
  }

  // Applied either way; the question is only about remembering it.
  apply(theme);
  state = {
    ...state,
    theme,
    pending: state.declined ? null : theme,
    asking: !state.declined,
  };
  emit();
}

/** "Remember it": store the pending choice and stop asking. */
export function grantConsent() {
  const pending = state.pending;
  if (pending) writeThemeCookie(pending);
  state = { ...state, remembered: Boolean(pending), asking: false, pending: null, declined: false };
  emit();
}

/** "Not now": keep the choice for this session only, and stop asking today. */
export function declineConsent() {
  state = { ...state, asking: false, pending: null, declined: true };
  emit();
}

/** Forget a stored choice. Returns the interface to Auto. */
export function forgetTheme() {
  clearThemeCookie();
  state = { ...state, theme: 'system', remembered: false, asking: false, pending: null };
  apply('system');
  emit();
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => state.theme,
    () => 'system' as Theme,
  );
  const set = useCallback((next: Theme) => setTheme(next), []);
  return [theme, set];
}

/** Everything the consent dialog and the privacy page need. */
export function useThemeConsent() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );

  return {
    ...snapshot,
    grant: useCallback(() => grantConsent(), []),
    decline: useCallback(() => declineConsent(), []),
    forget: useCallback(() => forgetTheme(), []),
  };
}

/**
 * Re-read the world: the stored choice first, then whatever is already applied
 * to the document. Exported because it is how a fresh page load and a hot
 * reload both converge on the same state.
 */
export function syncThemeFromDocument() {
  if (typeof document === 'undefined') return;
  const stored = readThemeCookie();
  if (stored) {
    state = { ...state, theme: stored, remembered: true };
    apply(stored);
    emit();
    return;
  }
  const attr = document.documentElement.getAttribute('data-theme');
  state = {
    ...state,
    theme: attr === 'light' || attr === 'dark' ? attr : 'system',
    remembered: false,
  };
  emit();
}

/**
 * Test hook: the store is module state, so a test that changes the theme would
 * otherwise leak into the next one. Not used by the application.
 */
export function resetThemeState() {
  state = { theme: 'system', remembered: false, asking: false, declined: false, pending: null };
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-theme');
  }
  emit();
}

hydrate();
