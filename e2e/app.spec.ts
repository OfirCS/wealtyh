import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// No test here calls a real AI service. The plan stream answers "no keys", which
// sends the app down its built-in planner, so plans are instant and free.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/pathfinder/stream', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No keys', code: 'NO_AI_KEYS' }) }),
  );
});

async function enterDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Your agent is working.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Alex/ })).toBeVisible({ timeout: 25_000 });
}

function nav(page: Page, name: string) {
  return page.getByRole('navigation').first().getByRole('button', { name });
}

test('the landing page leads to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /builds itself/ })).toBeVisible();
  await page.getByRole('button', { name: 'Get started free' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in. That’s the only step.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try the demo account' })).toBeVisible();
});

test('the demo goes from landing to a full dashboard with no typing', async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByRole('heading', { name: 'Your agent', exact: true })).toBeVisible();
  await expect(page.getByText('left to spend')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bills coming up' })).toBeVisible();
});

test('a returning visitor goes straight to their dashboard', async ({ page }) => {
  await enterDemo(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Alex/ })).toBeVisible();
});

test('signing out clears everything', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: /builds itself/ })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('budget') || key.includes('session')))).toEqual([]);
});

test('asking the agent produces a plain answer', async ({ page }) => {
  await enterDemo(page);
  await page.getByLabel('Ask your agent').fill('Help me pay off my debt');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What to do' })).toBeVisible({ timeout: 20_000 });
});

test('saving plan steps updates your numbers', async ({ page }) => {
  await enterDemo(page);
  await page.getByLabel('Ask your agent').fill('Help me pay off my debt');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What to do' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /^Add to plan:/ }).first().click();
  await expect(page.getByText('✓ Added')).toBeVisible();
  await page.getByRole('button', { name: 'Save my plan' }).click();
  await expect(page.getByText('✓ Your plan is saved')).toBeVisible();
});

test('connecting Gmail lets the agent fill the sheet by itself', async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, 'Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID on the dev server');
  // Stands in for Google and the AI, so this runs anywhere and costs nothing
  await page.addInitScript(() => {
    (window as unknown as { google: unknown }).google = {
      accounts: { oauth2: { initTokenClient: (config: { callback: (response: { access_token: string }) => void }) => ({ requestAccessToken: () => config.callback({ access_token: 'test-token' }) }) } },
    };
  });
  await page.route('https://www.googleapis.com/oauth2/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ given_name: 'Sam', email: 'sam@example.com' }) }),
  );
  await page.route('https://gmail.googleapis.com/**', (route) => {
    const body = route.request().url().includes('/messages?')
      ? { messages: [{ id: 'one' }, { id: 'two' }] }
      : { internalDate: String(Date.now()), snippet: 'Thanks for your order. Total $84.17', payload: { headers: [{ name: 'From', value: 'Amazon <orders@amazon.ca>' }, { name: 'Subject', value: 'Your order' }] } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/budget/read', async (route) => {
    expect((route.request().postDataJSON() as { emails: string }).emails).toContain('Total $84.17');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transactions: [{ date: new Date().toISOString().slice(0, 10), description: 'Amazon.ca', amount: 84.17 }] }) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Get started free' }).click();
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sam/ })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText('Amazon.ca').first()).toBeVisible();
});

test('a statement that cannot be read gets a friendly message', async ({ page }) => {
  await enterDemo(page);
  await nav(page, 'Connections').click();
  await page.getByRole('button', { name: 'Add a file' }).click();
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles({ name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('hello there\nthis is not a statement') });
  await expect(page.getByRole('status').first()).toContainText("couldn't read");
});

test('a share link keeps numbers out of the query string', async ({ page }) => {
  await enterDemo(page);
  await page.getByLabel('Ask your agent').fill('Help me pay off my debt');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What to do' })).toBeVisible({ timeout: 20_000 });
  const { hash, search } = new URL(page.url());
  expect(hash).toContain('s=');
  expect(search).not.toContain('s=');
});

test.describe('on a big screen', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sheets drag around the board and tidy back up', async ({ page }) => {
    await enterDemo(page);
    await nav(page, 'Budget').click();
    const title = page.getByRole('heading', { name: 'This month' });
    await expect(title).toBeVisible();
    await page.waitForTimeout(400);
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

  test('a budget cell edits with one click', async ({ page }) => {
    await enterDemo(page);
    await nav(page, 'Budget').click();
    const sheet = page.getByRole('region', { name: 'This month' });
    await sheet.getByRole('row', { name: /Groceries/ }).getByRole('gridcell').nth(1).click();
    await page.keyboard.type('1234');
    await page.keyboard.press('Enter');
    await expect(sheet.getByRole('row', { name: /Groceries/ })).toContainText('1,234');
  });

  test('dragging a purchase onto a category sorts it', async ({ page }) => {
    await enterDemo(page);
    await nav(page, 'Budget').click();
    const purchase = page.getByRole('region', { name: 'Purchases' }).locator('[draggable="true"]').first();
    const target = page.getByRole('region', { name: 'This month' }).getByRole('row', { name: /Health/ });
    await purchase.dragTo(target);
    await expect(page.getByText(/moved to Health/)).toBeVisible();
  });
});
