import { expect, test } from '@playwright/test';

/**
 * The masking page makes the same promise as the comparison tool, so it gets
 * the same assertions: no request, no storage, and the masked output on the
 * clipboard contains none of the originals.
 */

const CSV = `key,value,environment
DATABASE_URL,postgresql://user:password@localhost:5432/app,production
OPENAI_API_KEY,sk-proj-abcdefghijklmnopqrstuvwxyz,production
LOG_LEVEL,info,production
`;

test('masks a pasted CSV without making a request', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/mask');

  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

  const box = page.getByRole('textbox', { name: 'CSV to mask' });
  await box.fill(CSV);
  await page.getByRole('button', { name: 'Mask values' }).click();

  await expect(page.getByRole('table')).toContainText('DATABASE_URL');
  await expect(page.getByRole('table')).not.toContainText('postgresql://');

  await page.getByRole('button', { name: /Copy masked CSV/ }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied.startsWith('key,value,environment\n')).toBe(true);
  expect(copied).toContain('OPENAI_API_KEY');
  expect(copied).not.toContain('sk-proj-');
  expect(copied).not.toContain('postgresql://');
  expect(requests).toEqual([]);
});

test('writes nothing to storage while masking', async ({ page }) => {
  await page.goto('/mask');
  await page.getByRole('textbox', { name: 'CSV to mask' }).fill(CSV);
  await page.getByRole('button', { name: 'Mask values' }).click();
  await page.getByRole('button', { name: /Copy masked CSV/ }).click();

  const stored = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: typeof indexedDB.databases === 'function' ? indexedDB.databases() : Promise.resolve([]),
  }));

  expect(stored.local).toBe(0);
  expect(stored.session).toBe(0);
  expect(await stored.databases).toEqual([]);
});
