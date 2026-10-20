import { expect, test } from '@playwright/test';

/**
 * The masking page makes the same promise as the comparison tool, so it gets
 * the same assertions: no request, no storage, and the masked output on the
 * clipboard contains none of the originals.
 *
 * The input is an env file with a banner comment, a blank line and a duplicate
 * key (issue #13): the page has to show two variables and say what it skipped.
 */

const ENV = `# ============================================
# ZeroExam — Environment Variables
# ============================================

DATABASE_URL=postgresql://user:password@localhost:5432/app
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz
LOG_LEVEL=info
LOG_LEVEL=debug
`;

test('masks a pasted env file without making a request', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/mask');

  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

  await page.getByRole('textbox', { name: 'Env text to mask' }).fill(ENV);
  await page.getByRole('button', { name: 'Mask values' }).click();

  const table = page.getByRole('table');
  // Two columns, and the first variable is a row rather than a header.
  await expect(table).toContainText('DATABASE_URL');
  await expect(table).not.toContainText('ZeroExam');
  await expect(table).not.toContainText('postgresql://');
  await expect(page.getByRole('columnheader', { name: 'value' })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(3); // #, key, value

  await page.getByRole('button', { name: /Copy masked env/ }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  const lines = copied.trim().split('\n');
  expect(lines.every((line) => /^[A-Z0-9_]+=/.test(line))).toBe(true);
  expect(copied).toContain('DATABASE_URL=********');
  expect(copied).toContain('LOG_LEVEL=debug'); // last duplicate wins
  expect(copied).not.toContain('#');
  expect(copied).not.toContain('postgresql://');
  expect(copied).not.toContain('sk-proj-');
  expect(requests).toEqual([]);
});

test('writes nothing to storage while masking', async ({ page }) => {
  await page.goto('/mask');
  await page.getByRole('textbox', { name: 'Env text to mask' }).fill(ENV);
  await page.getByRole('button', { name: 'Mask values' }).click();
  await page.getByRole('button', { name: /Copy masked env/ }).click();

  const stored = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: typeof indexedDB.databases === 'function' ? indexedDB.databases() : Promise.resolve([]),
  }));

  expect(stored.local).toBe(0);
  expect(stored.session).toBe(0);
  expect(await stored.databases).toEqual([]);
});
