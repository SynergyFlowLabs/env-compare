import { expect, test } from '@playwright/test';

const EXAMPLE = `DATABASE_URL=postgresql://user:password@localhost:5432/app
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxx
# SENTRY_DSN=
`;

const TARGET = `DATABASE_URL=postgresql://user:password@localhost:5432/app
LEGACY_GA_ID=UA-000000-2
`;

test('paste both files and see what is missing', async ({ page }) => {
  await page.goto('/');
  const panes = page.getByRole('textbox', { name: /Contents of/ });
  await panes.nth(0).fill(EXAMPLE);
  await panes.nth(1).fill(TARGET);

  await expect(page.getByText(/variables are in .env.example but missing from .env/)).toBeVisible();
  await page.getByRole('tab', { name: /Table/ }).click();
  await expect(page.getByRole('row', { name: /STRIPE_SECRET_KEY/ })).toBeVisible();

  await page.getByRole('button', { name: /Add STRIPE_SECRET_KEY/ }).click();
  await expect(page.getByRole('row', { name: /STRIPE_SECRET_KEY/ }).getByRole('button', { name: /Add/ })).toHaveCount(0);
});

test('hiding values removes them from the page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See an example' }).click();
  await page.getByRole('tab', { name: /Table/ }).click();
  await expect(page.getByText('UA-000000-2')).toBeVisible();
  await page.getByRole('button', { name: 'Hide values' }).click();
  await expect(page.getByText('UA-000000-2')).toHaveCount(0);
});

test('the privacy page explains the guarantees', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: /never leaves this tab/i })).toBeVisible();
});

/** A file long enough to overflow the 560px raw pane in every viewport. */
function longFile(count: number, prefix: string): string {
  return Array.from({ length: count }, (_, i) => `${prefix}_${i}=value-${i}`).join('\n');
}

test('raw panes scroll together, and stop when the toggle is off', async ({ page }) => {
  await page.goto('/');
  const boxes = page.getByRole('textbox', { name: /Contents of/ });
  await boxes.nth(0).fill(longFile(120, 'EXAMPLE'));
  await boxes.nth(1).fill(longFile(60, 'TARGET'));

  await page.getByRole('tab', { name: /Raw/ }).click();
  const panes = page.locator('[data-file-id]');
  await expect(panes).toHaveCount(2);

  const fraction = (index: number) =>
    panes.nth(index).evaluate((el) => {
      const span = el.scrollHeight - el.clientHeight;
      return span > 0 ? el.scrollTop / span : 0;
    });

  // Scroll the reference to the middle; the shorter file must land at the same
  // fraction, not at the same pixel.
  await panes.nth(0).evaluate((el) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  });
  await expect.poll(async () => Math.abs((await fraction(0)) - 0.5)).toBeLessThan(0.02);
  await expect.poll(async () => Math.abs((await fraction(1)) - 0.5)).toBeLessThan(0.02);

  // Turning syncing off must leave the second pane where it is.
  await page.getByRole('button', { name: /Scroll together/ }).click();
  const parked = await fraction(1);
  await panes.nth(0).evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect.poll(() => fraction(1)).toBeCloseTo(parked, 2);
});
