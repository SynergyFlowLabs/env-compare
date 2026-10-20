import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tool } from '../../src/ui/pages/Tool';
import { Privacy } from '../../src/ui/pages/Privacy';
import { resetThemeState, syncThemeFromDocument } from '../../src/ui/lib/theme';
import { THEME_COOKIE, readThemeCookie } from '../../src/ui/lib/consent';

const root = () => document.documentElement;

function clearCookie() {
  document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
}

beforeEach(() => {
  clearCookie();
  resetThemeState();
});

afterEach(() => {
  cleanup();
  clearCookie();
  resetThemeState();
  vi.restoreAllMocks();
});

describe('theme memory', () => {
  it('applies the theme but stores nothing before consent', async () => {
    const user = userEvent.setup();
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(root()).toHaveAttribute('data-theme', 'light');
    expect(readThemeCookie()).toBeNull();
    expect(document.cookie).toBe('');
  });

  it('asks at the moment of the action, not on load', async () => {
    render(<Tool />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stores exactly one cookie, with the attributes promised, after "Remember it"', async () => {
    const user = userEvent.setup();
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(THEME_COOKIE)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remember it' }));

    expect(readThemeCookie()).toBe('dark');
    // No second cookie, whatever its name.
    expect(document.cookie.split(';').filter((part) => part.trim() !== '')).toHaveLength(1);
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  });

  it('keeps the theme but writes nothing after "Not now"', async () => {
    const user = userEvent.setup();
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Not now' }));

    expect(root()).toHaveAttribute('data-theme', 'dark');
    expect(readThemeCookie()).toBeNull();
  });

  it('does not nag after a refusal', async () => {
    const user = userEvent.setup();
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Not now' }),
    );

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stops asking once the answer is yes, and updates the cookie', async () => {
    const user = userEvent.setup();
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remember it' }),
    );
    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readThemeCookie()).toBe('light');
  });

  it('clears the cookie when the reader goes back to Auto', async () => {
    const user = userEvent.setup();
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remember it' }),
    );
    await user.click(screen.getByRole('button', { name: 'Auto' }));

    expect(readThemeCookie()).toBeNull();
    expect(root()).not.toHaveAttribute('data-theme');
  });

  it('ignores a tampered value', async () => {
    document.cookie = `${THEME_COOKIE}=purple; Path=/`;
    resetThemeState();
    syncThemeFromDocument();
    render(<Tool />);
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('can be forgotten from the privacy page', async () => {
    const user = userEvent.setup();
    document.cookie = `${THEME_COOKIE}=dark; Path=/`;
    resetThemeState();
    syncThemeFromDocument();

    render(<Privacy />);
    expect(screen.getByText(/Remembered/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Forget my theme' }));

    expect(readThemeCookie()).toBeNull();
    expect(screen.getByText(/Not remembered/)).toBeInTheDocument();
    expect(root()).not.toHaveAttribute('data-theme');
  });
});
