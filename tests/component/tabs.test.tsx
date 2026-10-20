import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tool } from '../../src/ui/pages/Tool';

/**
 * Radix gives the view switcher real tab semantics. These assertions exist so a
 * future "simplification" back to plain buttons has to delete a test that says
 * why the semantics matter: arrow keys, one tab stop, aria-controls.
 */
describe('result views', () => {
  it('is a tablist with arrow-key navigation', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));

    // The table is the default view: it is where the work happens.
    const table = screen.getByRole('tab', { name: /Table/ });
    expect(table).toHaveAttribute('aria-selected', 'true');

    table.focus();
    await user.keyboard('{ArrowRight}');
    const raw = screen.getByRole('tab', { name: /Raw/ });
    expect(raw).toHaveAttribute('aria-selected', 'true');
    expect(raw).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Fix/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('points each tab at the panel it controls', async () => {
    const user = userEvent.setup();
    render(<Tool />);
    await user.click(screen.getByRole('button', { name: 'See an example' }));

    const tab = screen.getByRole('tab', { name: /Table/ });
    const panel = screen.getByRole('tabpanel');
    expect(tab).toHaveAttribute('aria-controls', panel.id);
  });
});
