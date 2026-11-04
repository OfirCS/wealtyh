import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// No test here calls a real AI service. The stream answers "no keys", which
// sends the app down its built-in planner, so plans are instant and free.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/pathfinder/stream', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No keys', code: 'NO_AI_KEYS' }) }),
  );
});

async function useSampleNumbers(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it with sample numbers' }).click();
  await expect(page.getByText('Your money')).toBeVisible();
}

test('a new visitor is asked to connect before typing anything', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What’s changing in your life?' })).toBeVisible();
  await page.getByRole('button', { name: 'Having a baby' }).click();
  await expect(page.getByRole('heading', { name: 'Let me see your money.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Apple Wallet/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bank or card/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Email/ })).toBeVisible();
});

test('typing is still possible as a fallback, and the plan answers plainly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Having a baby' }).click();
  await page.getByRole('button', { name: 'Type it in instead' }).click();
  await page.getByRole('button', { name: '$80k' }).click();
  await expect(page.getByRole('heading', { name: 'What does housing cost each month?' })).toBeVisible();
  await page.getByRole('button', { name: '$2k', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What else do you spend each month?' })).toBeVisible();
  await page.getByRole('button', { name: '$2k', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How much cash do you have?' })).toBeVisible();
  await page.getByRole('button', { name: '$25k' }).click();
  await expect(page.getByRole('heading', { name: 'What have you invested?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Nothing' }).click();
  await expect(page.getByRole('heading', { name: /a month short|afford/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('On leave', { exact: true })).toBeVisible();
});

test('a connected statement replaces most questions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Having a baby' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'statement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date,Description,Amount\n2026-10-01,RENT PAYMENT,-2000\n2026-10-05,PAYROLL DEPOSIT,5000\n2026-10-09,LOBLAWS,-300\n'),
  });
  await expect(page.getByRole('heading', { name: 'How much cash do you have?' })).toBeVisible({ timeout: 10_000 });
});

test('saving steps updates your money', async ({ page }) => {
  await useSampleNumbers(page);
  await page.getByRole('button', { name: 'Pay off debt' }).click();
  await expect(page.getByRole('heading', { name: 'What to do' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Add to plan:/ }).first().click();
  await expect(page.getByText('✓ Added')).toBeVisible();
  await page.getByRole('button', { name: 'Save my plan' }).click();
  await expect(page.getByText('✓ Your plan is saved')).toBeVisible();
});

test('the budget opens on a live sample, never blank', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Budget' }).click();
  await expect(page.getByText(/Sample family/)).toBeVisible();
  await expect(page.getByRole('grid').first()).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Groceries' }).first()).toBeVisible();
});

test.describe('on a big screen', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sheets drag around the board and remember where they were', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Budget' }).click();
    const title = page.getByRole('heading', { name: 'This month' });
    await expect(title).toBeVisible();
    const before = await title.boundingBox();
    await page.mouse.move(before!.x + 10, before!.y + 8);
    await page.mouse.down();
    await page.mouse.move(before!.x + 130, before!.y + 70, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await title.boundingBox();
    expect(after!.x).toBeGreaterThan(before!.x + 80);
    await page.getByRole('button', { name: 'Tidy up' }).click();
    await page.waitForTimeout(500);
    const tidy = await title.boundingBox();
    expect(Math.abs(tidy!.x - before!.x)).toBeLessThan(14);
  });

  test('a budget cell can be edited like a spreadsheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Budget' }).click();
    const sheet = page.getByRole('region', { name: 'This month' });
    const cell = sheet.getByRole('row', { name: /Groceries/ }).getByRole('gridcell').nth(1);
    await cell.click();
    await cell.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('1234');
    await page.keyboard.press('Enter');
    await expect(sheet.getByRole('row', { name: /Groceries/ })).toContainText('1,234');
  });

  test('dragging a purchase onto a category sorts it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Budget' }).click();
    const purchase = page.getByRole('region', { name: 'Purchases' }).locator('[draggable="true"]').first();
    const target = page.getByRole('region', { name: 'This month' }).getByRole('row', { name: /Health/ });
    await purchase.dragTo(target);
    await expect(page.getByText(/moved to Health/)).toBeVisible();
  });
});

test('share links keep numbers out of the query string', async ({ page }) => {
  await useSampleNumbers(page);
  await page.getByRole('button', { name: 'Pay off debt' }).click();
  await expect(page.getByRole('heading', { name: 'What to do' })).toBeVisible({ timeout: 15_000 });
  const { hash, search } = new URL(page.url());
  expect(hash).toContain('s=');
  expect(search).not.toContain('s=');
});
