import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tool } from '../../src/ui/pages/Tool';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Open the tool on the sample, land on the Fix tab. */
async function openFixTab() {
  const user = userEvent.setup();
  render(<Tool />);
  await user.click(screen.getByRole('button', { name: 'See an example' }));
  await user.click(screen.getByRole('tab', { name: /Fix/ }));
  return user;
}

describe('the prompt export', () => {
  it('copies the prompt and shows it, in one click', async () => {
    const user = await openFixTab();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: 'Copy prompt for my agent' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]?.[0] as string;
    expect(copied).toContain('STRIPE_SECRET_KEY');
    expect(copied).not.toContain('sk_test');
    expect(copied).not.toContain('postgresql');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Prompt for your agent')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Prompt text')).toHaveTextContent('STRIPE_SECRET_KEY');
    expect(within(dialog).getByText(/Copied to your clipboard/)).toBeInTheDocument();

    expect(await screen.findByText('Prompt copied for your agent')).toBeInTheDocument();
  });

  it('can be copied again from inside the dialog, with a toast', async () => {
    const user = await openFixTab();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: 'Copy prompt for my agent' }));
    const dialog = await screen.findByRole('dialog');
    writeText.mockClear();

    await user.click(within(dialog).getByRole('button', { name: 'Copy prompt again' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Prompt copied for your agent')).toBeInTheDocument();
  });

  it('says the clipboard was blocked instead of claiming success', async () => {
    const user = await openFixTab();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));

    await user.click(screen.getByRole('button', { name: 'Copy prompt for my agent' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/blocked the clipboard/)).toBeInTheDocument();
    expect(screen.queryByText('Prompt copied for your agent')).not.toBeInTheDocument();
  });

  it('closes on Done without leaving the prompt on screen', async () => {
    const user = await openFixTab();
    vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: 'Copy prompt for my agent' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the prompt export, when the clipboard is blocked', () => {
  it('selects the text when the copy was refused, so one keystroke finishes it', async () => {
    const user = await openFixTab();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));

    await user.click(screen.getByRole('button', { name: 'Copy prompt for my agent' }));
    const dialog = await screen.findByRole('dialog');

    // jsdom does not serialise selections, so inspect the range itself: it must
    // cover the prompt's text node, not a collapsed caret somewhere else.
    await waitFor(() => {
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.collapsed).toBe(false);
      expect(range?.startContainer.textContent).toContain('STRIPE_SECRET_KEY');
    });
    expect(dialog).toBeInTheDocument();
  });
});

describe('the report export', () => {
  it('copies the report and shows it, in one click', async () => {
    const user = await openFixTab();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: 'Copy report' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]?.[0] as string;
    expect(copied).toContain('STRIPE_SECRET_KEY');
    // The default redaction is key names only, so no value may appear.
    expect(copied).not.toContain('sk_test');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Report')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Report text')).toHaveTextContent('STRIPE_SECRET_KEY');
    expect(within(dialog).getByText(/Copied to your clipboard/)).toBeInTheDocument();
    expect(await screen.findByText('Report copied')).toBeInTheDocument();
  });

  it('copies the report again, with its own toast', async () => {
    const user = await openFixTab();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: 'Copy report' }));
    const dialog = await screen.findByRole('dialog');
    writeText.mockClear();

    await user.click(within(dialog).getByRole('button', { name: 'Copy report again' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Report copied')).toBeInTheDocument();
  });

  it('keeps the prompt and report dialogs distinct', async () => {
    const user = await openFixTab();
    vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: 'Copy report' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Report')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Copy prompt for my agent' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Prompt for your agent')).toBeInTheDocument();
    expect(within(dialog).queryByText('Report')).not.toBeInTheDocument();
  });
});
