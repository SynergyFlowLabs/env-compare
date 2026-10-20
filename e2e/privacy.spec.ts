import { expect, test } from '@playwright/test';

const EXAMPLE = 'STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx\nDATABASE_URL=postgresql://user:pw@localhost/db\n';
const TARGET = 'DATABASE_URL=postgresql://user:pw@localhost/db\n';

test('no request is made after the page loads', async ({ page }) => {
  await page.goto('/');
  const requests: string[] = [];
  page.on('request', (request) => {
    requests.push(`${request.method()} ${request.url()}`);
  });

  const panes = page.getByRole('textbox', { name: /Contents of/ });
  await panes.nth(0).fill(EXAMPLE);
  await panes.nth(1).fill(TARGET);
  await page.getByRole('tab', { name: /Fix/ }).click();
  await page.getByRole('button', { name: /Copy/ }).first().click();

  expect(requests).toEqual([]);
});

test('nothing is written to storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See an example' }).click();

  const storage = await page.evaluate(async () => ({
    local: Object.keys(window.localStorage).length,
    session: Object.keys(window.sessionStorage).length,
    cookie: document.cookie,
    databases: await indexedDB.databases().then((dbs) => dbs.length),
  }));

  expect(storage).toEqual({ local: 0, session: 0, cookie: '', databases: 0 });
});

test('a reload starts empty', async ({ page }) => {
  await page.goto('/');
  const panes = page.getByRole('textbox', { name: /Contents of/ });
  await panes.nth(0).fill(EXAMPLE);
  await page.reload();
  await expect(page.getByRole('textbox', { name: /Contents of/ }).nth(0)).toHaveValue('');
});

test('the app still works when storage throws', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('storage disabled');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'See an example' }).click();
  await expect(page.getByText(/missing from .env/)).toBeVisible();
});
