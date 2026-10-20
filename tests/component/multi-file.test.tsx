import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Tool } from '../../src/ui/pages/Tool';

const LOCAL = 'DATABASE_URL=postgresql://user:pw@localhost:5432/local\nONLY_LOCAL=1\n';

afterEach(cleanup);

async function threeFiles() {
  const user = userEvent.setup();
  render(<Tool />);
  await user.click(screen.getByRole('button', { name: 'See an example' }));
  await user.click(screen.getByRole('button', { name: /Edit files/ }));
  await user.click(screen.getByRole('button', { name: /Add another file/ }));
  return user;
}

describe('comparing more than two files', () => {
  it('adds a box with a suggested name and compares all of them', async () => {
    const user = await threeFiles();

    expect(screen.getAllByRole('textbox', { name: /File name for the/ })).toHaveLength(3);
    expect(screen.getAllByRole('textbox', { name: 'File name for the target file' })).toHaveLength(2);

    fireEvent.change(screen.getByRole('textbox', { name: 'Contents of .env.local' }), {
      target: { value: LOCAL },
    });

    await user.click(screen.getByRole('button', { name: 'Compare files' }));

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual([
      'Line in .env.example',
      'Key',
      '.env.example (reference)',
      '.env',
      '.env.local',
    ]);
    // Three cells for the key: missing in the reference, missing in .env,
    // present in .env.local — which is exactly the question three files ask.
    const cells = screen.getAllByRole('cell', { name: /ONLY_LOCAL/ });
    expect(cells.map((cell) => cell.getAttribute('aria-label'))).toEqual([
      'ONLY_LOCAL in .env.example: Missing from this file',
      'ONLY_LOCAL in .env: Missing from this file',
      'ONLY_LOCAL in .env.local: Set',
    ]);
  });

  it('fixes one target at a time and switches on request', async () => {
    const user = await threeFiles();
    fireEvent.change(screen.getByRole('textbox', { name: 'Contents of .env.local' }), {
      target: { value: LOCAL },
    });
    await user.click(screen.getByRole('button', { name: 'Compare files' }));
    await user.click(screen.getByRole('tab', { name: /Fix/ }));

    const picker = screen.getByLabelText('Target file to fix');
    expect(picker).toHaveValue('b');

    const before = screen.getByLabelText(/Variables to add/).textContent ?? '';
    expect(before).toContain('STRIPE_SECRET_KEY');

    await user.selectOptions(picker, 'f3');
    const after = screen.getByLabelText(/Variables to add/).textContent ?? '';
    expect(after).not.toBe(before);
    // .env.local already has DATABASE_URL, so it must not be offered again.
    expect(after).not.toContain('DATABASE_URL');
  });

  it('removes a box, and never below two', async () => {
    const user = await threeFiles();
    await user.click(screen.getByRole('button', { name: 'Remove .env.local' }));
    expect(screen.getAllByRole('textbox', { name: /File name for the/ })).toHaveLength(2);

    const removes = screen.queryAllByRole('button', { name: /^Remove / });
    expect(removes).toHaveLength(0);
  });

  it('promotes a file to reference from its box', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('button', { name: /Edit files/ }));

    await user.click(screen.getByRole('button', { name: 'Use .env as the reference' }));
    expect(screen.getByRole('textbox', { name: 'File name for the reference file' })).toHaveValue(
      '.env',
    );
    expect(screen.queryByRole('button', { name: 'Use .env as the reference' })).not.toBeInTheDocument();
  });

  it('names every target in the results bar', async () => {
    const user = await threeFiles();
    fireEvent.change(screen.getByRole('textbox', { name: 'Contents of .env.local' }), {
      target: { value: LOCAL },
    });
    await user.click(screen.getByRole('button', { name: 'Compare files' }));

    expect(screen.getByText(/2 files \(\.env, \.env\.local\)/)).toBeInTheDocument();
  });

  it('copies the fix for the file the reader is looking at', async () => {
    const user = await threeFiles();
    fireEvent.change(screen.getByRole('textbox', { name: 'Contents of .env.local' }), {
      target: { value: LOCAL },
    });
    await user.click(screen.getByRole('button', { name: 'Compare files' }));

    await user.click(screen.getByRole('tab', { name: /Fix/ }));
    await user.selectOptions(screen.getByLabelText('Target file to fix'), 'f3');

    // The results-bar button follows the same target as the Fix tab.
    const copyButtons = screen.getAllByRole('button', { name: /Copy \d+ for \.env\.local/ });
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it('reports every file in the summary cards', async () => {
    const user = await threeFiles();
    fireEvent.change(screen.getByRole('textbox', { name: 'Contents of .env.local' }), {
      target: { value: LOCAL },
    });
    await user.click(screen.getByRole('button', { name: 'Compare files' }));
    await user.click(screen.getByRole('tab', { name: /Summary/ }));

    const card = screen.getByText('.env.local').closest('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('target')).toBeInTheDocument();
  });
});
