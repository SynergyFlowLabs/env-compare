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

  // The agent prompt opens a dialog *and* copies; neither may leave the page.
  await page.getByRole('button', { name: 'Copy prompt for my agent' }).click();
  await expect(page.getByRole('dialog')).toContainText('Prompt for your agent');
  await page.getByRole('button', { name: 'Copy prompt' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  expect(requests).toEqual([]);
});

test('nothing is written to storage, and no cookie without consent', async ({ page }) => {
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

test('the theme cookie appears only after the reader agrees', async ({ page, context }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Dark' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Remember your theme?');
  expect((await context.cookies()).length).toBe(0);

  await dialog.getByRole('button', { name: 'Not now' }).click();
  expect((await context.cookies()).length).toBe(0);

  await page.getByRole('button', { name: 'Light' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await context.cookies()).length).toBe(0);

  await page.getByRole('button', { name: 'Auto' }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remember it' }).click();

  const cookies = await context.cookies();
  expect(cookies).toHaveLength(1);
  expect(cookies[0]).toMatchObject({ name: 'ec-theme', value: 'dark', httpOnly: false, sameSite: 'Lax' });
});

test('a remembered theme survives a reload', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Light' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remember it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect((await context.cookies()).map((c) => c.name)).toEqual(['ec-theme']);
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
