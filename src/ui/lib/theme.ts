import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';

/**
 * Theme choice, held in memory for the life of the tab.
 *
 * Deliberately not persisted: there is no localStorage, no cookie and no URL
 * parameter anywhere in this product, so the choice resets on reload. That is
 * the same guarantee that keeps file contents out of storage, and it applies to
 * preferences too. `system` follows the OS via CSS.
 *
 * The stylesheet does the actual theming: setting `data-theme` swaps the token
 * block (see src/styles/tokens.css). Nothing here touches colours directly.
 */
let current: Theme = 'system';
const listeners = new Set<() => void>();

function readDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'system';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' || attr === 'dark' ? attr : 'system';
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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTheme(theme: Theme) {
  current = theme;
  apply(theme);
  listeners.forEach((listener) => listener());
}

/** Read the theme as it is actually applied — the DOM is the source of truth. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'system' as Theme,
  );
  const set = useCallback((next: Theme) => setTheme(next), []);
  return [theme, set];
}

/**
 * The DOM is the real state. Adopt whatever is already applied — this matters
 * after a hot reload, where module state is recreated but the element is not.
 */
export function syncThemeFromDocument() {
  current = readDocumentTheme();
}

syncThemeFromDocument();
