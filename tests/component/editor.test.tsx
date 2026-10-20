import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Tool } from '../../src/ui/pages/Tool';

const TARGET = 'DATABASE_URL=postgresql://user:pw@localhost:5432/app\nEXTRA_KEY=abc\n';

/** A File with a working text() even where jsdom has not implemented Blob.text. */
function envFile(contents: string, name: string): File {
  const file = new File([contents], name, { type: 'text/plain' });
  if (typeof file.text !== 'function') {
    Object.defineProperty(file, 'text', { value: async () => contents });
  }
  return file;
}

const dataTransfer = (files: File[]) => ({ files, types: ['Files'], dropEffect: 'none' });

afterEach(cleanup);

describe('file boxes', () => {
  it('lets the reader rename a file in place', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('button', { name: /Edit files/ }));

    const name = screen.getByRole('textbox', { name: 'File name for the target file' });
    await user.clear(name);
    await user.type(name, '.env.production');

    await user.click(screen.getByRole('button', { name: 'Compare files' }));
    expect(screen.getByRole('columnheader', { name: '.env.production' })).toBeInTheDocument();
  });

  it('accepts a dragged file in either box', async () => {
    render(<Tool />);
    const [reference] = screen.getAllByRole('textbox', { name: /Contents of/ });

    fireEvent.dragEnter(reference!.closest('[data-dragging]') ?? reference!, {
      dataTransfer: dataTransfer([envFile(TARGET, '.env.production')]),
    });
    expect(screen.getByText(/Drop to replace/)).toBeInTheDocument();

    fireEvent.drop(reference!.closest('[data-dragging]') ?? reference!, {
      dataTransfer: dataTransfer([envFile(TARGET, '.env.production')]),
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'File name for the reference file' })).toHaveValue(
        '.env.production',
      );
    });
    expect(screen.getByRole('textbox', { name: 'Contents of .env.production' })).toHaveValue(TARGET);
  });

  it('opens the table first once both files have keys', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    expect(screen.getByRole('tab', { name: /Table/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('editing after a comparison', () => {
  it('stays in the editor when the reader asks for it', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('button', { name: /Edit files/ }));

    // The regression: the auto-advance effect used to flip this back to the
    // results on the next tick, so the editor appeared and vanished.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(screen.getAllByRole('textbox', { name: /Contents of/ })).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: /Table/ })).not.toBeInTheDocument();
  });

  it('returns to the comparison when the reader asks for it', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('button', { name: /Edit files/ }));
    await user.click(screen.getByRole('button', { name: 'Compare files' }));

    expect(screen.getByRole('tab', { name: /Table/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('advances again after a fresh paste', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('button', { name: /Edit files/ }));

    const [reference] = screen.getAllByRole('textbox', { name: /Contents of/ });
    fireEvent.paste(reference!);
    // userEvent.type fires input events; the paste handler marks the next change
    // as deliberate, which is what re-arms the comparison.
    await user.clear(reference!);
    fireEvent.change(reference!, { target: { value: 'A=1\nB=2\n' } });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Table/ })).toBeInTheDocument();
    });
  });
});
