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
