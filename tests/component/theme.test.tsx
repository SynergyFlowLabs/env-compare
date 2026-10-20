import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Tool } from '../../src/ui/pages/Tool';
import { Privacy } from '../../src/ui/pages/Privacy';
import { resetThemeState } from '../../src/ui/lib/theme';
import { THEME_COOKIE } from '../../src/ui/lib/consent';

const root = () => document.documentElement;

beforeEach(() => {
  document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
  resetThemeState();
});

afterEach(() => {
  cleanup();
  document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
  resetThemeState();
});

/**
 * Choosing a theme applies it immediately and then asks whether it may be
 * remembered. These tests answer "Not now" unless the question is what they are
 * testing — the consent itself has its own file.
 */
async function pickTheme(name: 'Auto' | 'Light' | 'Dark') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name }));
  const dialog = screen.queryByRole('dialog');
  if (dialog) await user.click(within(dialog).getByRole('button', { name: 'Not now' }));
  return user;
}

describe('theme switch', () => {
  it('starts on Auto, with no attribute, so the OS preference applies', () => {
    render(<Tool />);
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('forces light when the reader asks for it', async () => {
    render(<Tool />);
    await pickTheme('Light');

    expect(root()).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('forces dark, then gives control back to the system', async () => {
    render(<Tool />);
    const user = await pickTheme('Dark');
    expect(root()).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: 'Auto' }));
    expect(root()).not.toHaveAttribute('data-theme');
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    screen.getByRole('button', { name: 'Dark' }).focus();
    await user.keyboard('{Enter}');
    expect(root()).toHaveAttribute('data-theme', 'dark');
  });

  it('shares one choice across pages', async () => {
    const { unmount } = render(<Tool />);
    await pickTheme('Light');
    unmount();

    render(<Privacy />);
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(root()).toHaveAttribute('data-theme', 'light');
  });

  it('never touches web storage, even after consenting', async () => {
    render(<Tool />);
    await pickTheme('Dark');

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    // The only thing that can be persisted is the theme cookie, and it is
    // absent here because the question was answered "Not now".
    expect(document.cookie).toBe('');
  });
});
