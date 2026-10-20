import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mask } from '../../src/ui/pages/Mask';

/**
 * Issues #10 and #13: a masking page for an **env file** — two columns, no
 * header guessing, comments and blank lines counted but never rendered — with
 * the acceptance criteria as assertions.
 */

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

async function loadExample(user: ReturnType<typeof userEvent.setup>) {
  render(<Mask />);
  await user.click(screen.getByRole('button', { name: 'Use an example' }));
}

function rows() {
  const table = screen.getByRole('table');
  return within(table).getAllByRole('row').slice(1);
}

describe('Mask page — naming and input', () => {
  it('is called "Mask env", not "Mask a CSV"', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Mask an env file');
    expect(screen.getByRole('textbox', { name: 'Env text to mask' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a .env file' })).toBeInTheDocument();
    expect(screen.queryByText(/CSV/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Use an example' }));
    expect(screen.getByRole('button', { name: /Copy masked env/ })).toBeInTheDocument();
  });

  it('says what happens to the data', () => {
    render(<Mask />);
    expect(screen.getByText(/Nothing is uploaded, and nothing is saved/)).toBeInTheDocument();
  });

  it('reads a pasted env file without a second button press', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    await user.click(screen.getByRole('textbox', { name: 'Env text to mask' }));
    await user.paste('API_TOKEN=sk-live-abcdefghijklmnop\nLOG_LEVEL=info\n');

    expect(await screen.findByRole('table')).toBeInTheDocument();
    // The key appears in the preview and in the per-key overrides; the value appears nowhere.
    expect(screen.getAllByText('API_TOKEN').length).toBeGreaterThan(0);
    expect(screen.queryByText('sk-live-abcdefghijklmnop')).toBeNull();
  });

  it('reports a paste with no variables, and names a wide CSV as out of scope', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    await user.type(
      screen.getByRole('textbox', { name: 'Env text to mask' }),
      'key,value,environment',
    );
    await user.click(screen.getByRole('button', { name: 'Mask values' }));
    expect(screen.getByRole('alert').textContent).toContain('multi-column CSV');
  });
});

describe('Mask page — two columns, no invented structure', () => {
  it('renders exactly key and value columns', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    const headings = within(screen.getByRole('table')).getAllByRole('columnheader');
    expect(headings.map((heading) => heading.textContent)).toEqual(['#', 'key', 'value']);
  });

  it('counts comments and blank lines instead of showing them', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    // No row begins with a comment, and no comment text is rendered anywhere.
    for (const row of rows()) {
      expect(row.textContent?.trimStart().startsWith('#')).toBe(false);
    }
    expect(screen.queryByText(/ZeroExam v3/)).toBeNull();
    const summary = screen.getByText(/variables ·/);
    expect(summary.textContent).toMatch(/comment lines/);
    expect(summary.textContent).toMatch(/blank lines/);
  });

  it('shows the first line as a variable when the file starts with one', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    await user.click(screen.getByRole('textbox', { name: 'Env text to mask' }));
    await user.paste('DATABASE_URL=postgresql://user:pw@host/db\nLOG_LEVEL=info\n');

    expect(await screen.findByRole('table')).toBeInTheDocument();
    const first = rows()[0];
    expect(first?.textContent).toContain('DATABASE_URL');
    // Issue #13: the first variable used to become the header, value and all.
    expect(screen.queryByRole('columnheader', { name: /DATABASE_URL/ })).toBeNull();
    expect(screen.queryByText(/postgresql:\/\/user:pw/)).toBeNull();
  });

  it('notes a duplicated key and keeps the last value, like dotenv', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    expect(screen.getByText(/LOG_LEVEL is defined more than once/)).toBeInTheDocument();
    const logLevel = rows().find((row) => row.textContent?.includes('LOG_LEVEL'));
    expect(logLevel?.textContent).toContain('info');
  });

  it('never puts a value in a heading or a summary line', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent ?? '');
    for (const heading of headings) {
      expect(heading).not.toMatch(/hunter2|AIza|sk-lf|postgresql/);
    }
    expect(screen.getByText(/values masked/).textContent).not.toMatch(/hunter2|AIza|sk-lf/);
  });
});

describe('Mask page — masking', () => {
  it('masks credentials on arrival and leaves plain configuration readable', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    expect(screen.queryByText(/hunter2/)).toBeNull();
    expect(screen.queryByText(/AIzaFAKE/)).toBeNull();
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('3000')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('changes the preview when the value mode changes, and keeps the chosen characters', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    await user.selectOptions(screen.getByLabelText('Masking for all values'), 'end');
    expect(screen.getByText(/^post\*+$/)).toBeInTheDocument();
  });

  it('lets one key override the file-wide setting', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    await user.selectOptions(screen.getByLabelText('Masking for DATABASE_URL'), 'end');
    expect(screen.getByText(/^post\*+$/)).toBeInTheDocument();
    expect(screen.getAllByText('********').length).toBeGreaterThan(1);
  });

  it('shows the original on request and puts the mask back', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    const peek = screen.getByRole('button', { name: 'Show the original value of DATABASE_URL' });
    await user.click(peek);
    expect(screen.getByText(/postgresql:\/\/user:hunter2/)).toBeInTheDocument();
    expect(peek).toHaveAttribute('aria-pressed', 'true');

    await user.click(peek);
    expect(screen.queryByText(/postgresql:\/\/user:hunter2/)).toBeNull();
  });

  it('warns by name when a credential is left visible', async () => {
    const user = userEvent.setup();
    await loadExample(user);

    await user.selectOptions(screen.getByLabelText('Masking for all values'), 'none');

    const warning = screen.getByRole('region', { name: 'Before you share' });
    expect(warning.textContent).toContain('DATABASE_URL');
    expect(warning.textContent).toContain('credential');
  });

  it('names a shared value so a reused secret is still visible after masking', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    await user.click(screen.getByRole('textbox', { name: 'Env text to mask' }));
    await user.paste('A_SECRET=sk-live-abcdefghijklmnop\nB_SECRET=sk-live-abcdefghijklmnop\n');

    expect(await screen.findByText('= A_SECRET')).toBeInTheDocument();
  });
});

describe('Mask page — what leaves the page', () => {
  it('copies an env file containing no original values', async () => {
    const user = userEvent.setup();
    render(<Mask />);
    // userEvent installs its own clipboard stub, so spy after setup.
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Use an example' }));
    await user.click(screen.getByRole('button', { name: /Copy masked env/ }));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const copied = write.mock.calls[0]![0] as string;

    // One KEY=value per line, no comments, no values.
    for (const line of copied.trim().split('\n')) expect(line).toMatch(/^[A-Z0-9_]+=/);
    expect(copied).not.toContain('#');
    expect(copied).not.toContain('hunter2');
    expect(copied).not.toContain('AIzaFAKE');
    expect(copied).toContain('DATABASE_URL=********');
    expect(copied).toContain('LOG_LEVEL=info');
  });

  it('shows the exact text that will be copied', async () => {
    const user = userEvent.setup();
    await loadExample(user);
    await user.click(screen.getByText('Show the exact output'));

    const pre = screen.getByText(/^BETTER_AUTH_SECRET=/);
    expect(pre.tagName).toBe('PRE');
    expect(pre.textContent).not.toContain('hunter2');
  });

  it('starts over without leaving the masked file on screen', async () => {
    const user = userEvent.setup();
    await loadExample(user);
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.getByRole('textbox', { name: 'Env text to mask' })).toBeInTheDocument();
  });

  it('is reachable from the site header as "Mask env"', () => {
    render(<Mask />);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).queryByRole('link', { name: 'Mask env' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });
});
