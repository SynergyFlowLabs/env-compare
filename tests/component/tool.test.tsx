import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tool } from '../../src/ui/pages/Tool';
import { SAMPLE_EXAMPLE, SAMPLE_TARGET } from '../../src/state/sample';

async function pasteBoth(user: ReturnType<typeof userEvent.setup>, example = SAMPLE_EXAMPLE, target = SAMPLE_TARGET) {
  const boxes = screen.getAllByRole('textbox', { name: /Contents of/ });
  await user.click(boxes[0]!);
  await user.paste(example);
  await user.click(boxes[1]!);
  await user.paste(target);
}

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

beforeEach(() => {
  stubClipboard(vi.fn().mockResolvedValue(undefined));
});

describe('Tool — input to results', () => {
  it('shows the landing copy and two panes', () => {
    render(<Tool />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('See what your');
    expect(screen.getAllByRole('textbox', { name: /Contents of/ })).toHaveLength(2);
  });

  it('switches to results once both files have variables', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await pasteBoth(user);
    expect(await screen.findByText(/variables are in .env.example but missing from .env/)).toBeInTheDocument();
  });

  it('loads the sample and shows the golden-case summary', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    const summary = await screen.findByText(/variables are in .env.example but missing from .env/);
    expect(summary.textContent).toContain('2 variables');
    expect(screen.getAllByText(/Commented out/).length).toBeGreaterThan(0);
  });

  it('counts variables and lines in the panes', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    const boxes = screen.getAllByRole('textbox', { name: /Contents of/ });
    await user.click(boxes[0]!);
    await user.paste('A=1\nB=2\n');
    expect(screen.getByText(/2 variables · 2 lines/)).toBeInTheDocument();
  });
});

describe('Tool — table actions', () => {
  it('adds a missing key to the target file', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('tab', { name: /Table/ }));

    const row = screen.getByRole('row', { name: /STRIPE_SECRET_KEY/ });
    await user.click(within(row).getByRole('button', { name: /Add STRIPE_SECRET_KEY/ }));

    expect(await screen.findByText(/Added # Added by EnvCompare|Added STRIPE_SECRET_KEY/)).toBeTruthy();
    const updated = screen.getByRole('row', { name: /STRIPE_SECRET_KEY/ });
    expect(within(updated).queryByRole('button', { name: /Add STRIPE_SECRET_KEY/ })).toBeNull();
  });

  it('undoes an added key', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('tab', { name: /Table/ }));

    const row = screen.getByRole('row', { name: /RESEND_API_KEY/ });
    await user.click(within(row).getByRole('button', { name: /Add RESEND_API_KEY/ }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    const after = screen.getByRole('row', { name: /RESEND_API_KEY/ });
    expect(within(after).getByRole('button', { name: /Add RESEND_API_KEY/ })).toBeInTheDocument();
  });

  it('filters rows by state', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('tab', { name: /Table/ }));
    await user.click(screen.getByRole('button', { name: /^Missing 2$/ }));
    expect(screen.queryByRole('row', { name: /LEGACY_GA_ID/ })).toBeNull();
    expect(screen.getByRole('row', { name: /STRIPE_SECRET_KEY/ })).toBeInTheDocument();
  });
});

describe('Tool — masking', () => {
  it('removes values from the DOM when hiding values', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('tab', { name: /Table/ }));

    expect(screen.getByText('UA-000000-2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide values' }));
    expect(screen.queryByText('UA-000000-2')).toBeNull();
    expect(document.body.textContent).not.toContain('UA-000000-2');
  });
});

describe('Tool — copy', () => {
  it('copies a fix block with blank values', async () => {
    const user = userEvent.setup();
    // userEvent installs its own clipboard stub, so spy after setup.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('button', { name: /Copy 2 for .env/ }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]?.[0] as string;
    expect(copied).toContain('STRIPE_SECRET_KEY=');
    expect(copied).toContain('RESEND_API_KEY=');
    expect(copied).not.toContain('sk_test');
    expect(copied).not.toContain('postgresql');
  });

  it('falls back to a manual dialog when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('button', { name: /Copy 2 for .env/ }));
    expect(await screen.findByText('Your browser blocked the clipboard')).toBeInTheDocument();
  });
});

describe('Tool — raw view', () => {
  it('shows the pasted text with missing markers', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));
    await user.click(screen.getByRole('tab', { name: /Raw/ }));
    expect(screen.getAllByText('missing here').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/# copied from the README/)).toBeInTheDocument();
  });
});
