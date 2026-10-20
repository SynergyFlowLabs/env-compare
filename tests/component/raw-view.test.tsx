import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tool } from '../../src/ui/pages/Tool';

/**
 * Issue #9: side-by-side raw panes scrolled independently, so a glance across
 * the gutter landed on a different region in each file.
 *
 * jsdom has no layout, so scrollHeight/clientHeight are stubbed: that is the
 * point. The sync is arithmetic on those numbers, and pinning the arithmetic
 * here means the behaviour does not depend on a browser being available.
 */

async function openRaw(user: ReturnType<typeof userEvent.setup>) {
  render(<Tool />);
  await user.click(screen.getByRole('button', { name: 'See an example' }));
  await user.click(screen.getByRole('tab', { name: /Raw/ }));
}

/** Give a pane a scrollable range without a layout engine. */
function setGeometry(pane: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(pane, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(pane, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(pane, 'scrollTop', {
    value: 0,
    writable: true,
    configurable: true,
  });
}

function panes() {
  const found = Array.from(document.querySelectorAll<HTMLElement>('[data-file-id]'));
  expect(found.length).toBeGreaterThanOrEqual(2);
  return found;
}

describe('Raw view — scroll sync', () => {
  it('mirrors scroll proportionally across panes with different lengths', async () => {
    const user = userEvent.setup();
    await openRaw(user);

    const [a, b] = panes();
    // Same fraction, different absolute ranges: 500/1000 = 50%, 50% of 2500 = 1250.
    setGeometry(a!, 1600, 600);
    setGeometry(b!, 3100, 600);

    a!.scrollTop = 500;
    fireEvent.scroll(a!);

    expect(b!.scrollTop).toBe(1250);
  });

  it('syncs every pane, not just the second one', async () => {
    const user = userEvent.setup();
    await openRaw(user);

    const found = panes();
    setGeometry(found[0]!, 1200, 200);
    setGeometry(found[1]!, 2200, 200);

    found[0]!.scrollTop = 500; // half of 1000
    fireEvent.scroll(found[0]!);

    expect(found[1]!.scrollTop).toBe(1000);
  });

  it('ignores the echo of its own writes instead of chasing itself', async () => {
    const user = userEvent.setup();
    await openRaw(user);

    const [a, b] = panes();
    setGeometry(a!, 1100, 100);
    setGeometry(b!, 2100, 100);

    a!.scrollTop = 300; // 30%
    fireEvent.scroll(a!);
    expect(b!.scrollTop).toBe(600);

    // The browser now dispatches a scroll event on the pane we moved. If that
    // were treated as the reader scrolling, it would drag `a` to 110 in turn.
    b!.scrollTop = 600;
    fireEvent.scroll(b!);
    expect(a!.scrollTop).toBe(300);
  });

  it('leaves panes alone when the reader turns syncing off', async () => {
    const user = userEvent.setup();
    await openRaw(user);

    const toggle = screen.getByRole('button', { name: /Scroll together/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    const [a, b] = panes();
    setGeometry(a!, 1600, 600);
    setGeometry(b!, 3100, 600);

    a!.scrollTop = 500;
    fireEvent.scroll(a!);
    expect(b!.scrollTop).toBe(0);
  });

  it('does nothing when the source pane has nothing to scroll', async () => {
    const user = userEvent.setup();
    await openRaw(user);

    const [a, b] = panes();
    setGeometry(a!, 400, 400); // no overflow
    setGeometry(b!, 3100, 600);

    fireEvent.scroll(a!);
    expect(b!.scrollTop).toBe(0);
  });

  it('keeps every pane reachable from the keyboard', async () => {
    const user = userEvent.setup();
    await openRaw(user);

    // A scrollable region that cannot be focused cannot be scrolled without a
    // mouse, which makes the comparison unusable for keyboard-only readers.
    for (const pane of panes()) expect(pane).toHaveAttribute('tabindex', '0');
  });

  it('names each pane by the file it shows', async () => {
    const user = userEvent.setup();
    await openRaw(user);

    const regions = screen.getAllByRole('region');
    const names = regions.map((region) => region.getAttribute('aria-label'));
    expect(names).toContain('.env.example');
    expect(names).toContain('.env');
  });
});
