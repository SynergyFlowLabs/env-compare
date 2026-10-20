import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tool } from '../../src/ui/pages/Tool';
import { Privacy } from '../../src/ui/pages/Privacy';
import { setTheme } from '../../src/ui/lib/theme';

const root = () => document.documentElement;

afterEach(() => {
  cleanup();
  setTheme('system');
  vi.restoreAllMocks();
});

describe('theme switch', () => {
  it('starts on Auto, with no attribute, so the OS preference applies', () => {
    render(<Tool />);
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('forces light when the reader asks for it', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(root()).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('forces dark, then gives control back to the system', async () => {
    const user = userEvent.setup();
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));
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
    const user = userEvent.setup();
    const { unmount } = render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'Light' }));
    unmount();

    render(<Privacy />);
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(root()).toHaveAttribute('data-theme', 'light');
  });

  it('never persists the choice', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<Tool />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});
