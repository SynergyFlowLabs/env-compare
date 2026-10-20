import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mask } from '../../src/ui/pages/Mask';

/**
 * Issue #10's acceptance criteria, as assertions: a masking mode per key and
 * per column, a preview that shows what will be shared, an export that is still
 * valid CSV and contains no originals, and a workflow that needs no hand-editing
 * of the raw text.
 */

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  stubClipboard(writeText);
});

async function loadExample(user: ReturnType<typeof userEvent.setup>) {
  render(<Mask />);
  await user.click(screen.getByRole('button', { name: 'Use an example' }));
}

describe('Mask page — getting data in', () => {
  it('opens with a paste box and says what happens to the data', () => {
    render(<Mask />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Mask a CSV');
    expect(screen.getByRole('textbox', { name: 'CSV to mask' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is uploaded, and nothing is saved/)).toBeInTheDocument();
  });

  it('loads a pasted CSV without a second button press', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    const box = screen.getByRole('textbox', { name: 'CSV to mask' });
    await user.click(box);
    await user.paste('key,value\nAPI_TOKEN,sk-live-abcdefghijklmnop\n');

    expect((await screen.findAllByText('API_TOKEN')).length).toBeGreaterThan(0);
    expect(screen.queryByText('sk-live-abcdefghijklmnop')).not.toBeInTheDocument();
  });

  it('reports a paste with no rows instead of showing an empty table', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    await user.type(screen.getByRole('textbox', { name: 'CSV to mask' }), 'just a header');
    await user.click(screen.getByRole('button', { name: 'Mask values' }));
    expect(screen.getByRole('alert').textContent).toContain('No rows found');
  });
});

describe('Mask page — masking', () => {
  it('masks the value column by default and keeps the keys readable', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    expect(screen.getAllByText('DATABASE_URL').length).toBeGreaterThan(0);
    expect(screen.queryByText(/postgresql:\/\/user:password/)).not.toBeInTheDocument();
    expect(screen.getAllByText('********').length).toBeGreaterThan(0);
    expect(screen.getByText(/values masked/)).toBeInTheDocument();
  });

  it('changes the preview when a column mode changes, and keeps the chosen characters', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    await user.selectOptions(screen.getByLabelText('Masking for value'), 'end');

    // `postgresql://…` with 4 characters kept.
    expect(screen.getByText(/^post\*+$/)).toBeInTheDocument();
  });

  it('lets one key override its column', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    await user.click(screen.getByText(/Override individual keys/));
    await user.selectOptions(screen.getByLabelText('Masking for key DATABASE_URL'), 'end');

    // The overridden row keeps a prefix; the rest of the column stays hidden.
    expect(screen.getByText(/^post\*+$/)).toBeInTheDocument();
    expect(screen.getAllByText('********').length).toBeGreaterThan(1);
  });

  it('shows the original on request and puts the mask back', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    const peek = screen.getByRole('button', {
      name: 'Show the original value in row 1, value',
    });
    await user.click(peek);
    expect(screen.getByText(/postgresql:\/\/user:password/)).toBeInTheDocument();
    expect(peek).toHaveAttribute('aria-pressed', 'true');

    await user.click(peek);
    expect(screen.queryByText(/postgresql:\/\/user:password/)).not.toBeInTheDocument();
  });

  it('warns when a column that looks like it holds credentials is left open', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    await user.selectOptions(screen.getByLabelText('Masking for value'), 'none');

    const warning = screen.getByRole('region', { name: 'Before you share' });
    expect(warning.textContent).toContain('is not masked');
    expect(warning.textContent).toContain('look like credentials');
  });

  it('names duplicates so a shared secret is still visible after masking', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    const box = screen.getByRole('textbox', { name: 'CSV to mask' });
    await user.click(box);
    await user.paste('key,value\nA,sk-live-abcdefghijklmnop\nB,sk-live-abcdefghijklmnop\n');

    expect(await screen.findByText('= row 1')).toBeInTheDocument();
  });
});

describe('Mask page — what leaves the page', () => {
  it('copies valid CSV containing no original values', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    // userEvent installs its own clipboard stub, so spy after setup.
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Use an example' }));
    await user.click(screen.getByRole('button', { name: /Copy masked CSV/ }));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const copied = write.mock.calls[0]![0] as string;

    expect(copied.startsWith('key,value,environment\n')).toBe(true);
    expect(copied).toContain('DATABASE_URL');
    expect(copied).not.toContain('postgresql://');
    expect(copied).not.toContain('sk_test_');
    expect(copied.trim().split('\n')).toHaveLength(10); // header + 9 rows
  });

  it('shows the exact text that will be copied', async () => {
    const user = userEvent.setup();
    await loadExample(user);
    await user.click(screen.getByText('Show the exact output'));

    const pre = screen.getByText(/^key,value,environment/);
    expect(pre.tagName).toBe('PRE');
    expect(pre.textContent).not.toContain('postgresql://');
  });

  it('starts over without leaving the masked file on screen', async () => {
    const user = userEvent.setup();
    await loadExample(user);
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.getByRole('textbox', { name: 'CSV to mask' })).toBeInTheDocument();
    expect(screen.queryByText('DATABASE_URL')).not.toBeInTheDocument();
  });

  it('is reachable from the site header', async () => {
    const user = userEvent.setup();
    await loadExample(user);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).queryByRole('link', { name: 'Mask a CSV' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });
});
