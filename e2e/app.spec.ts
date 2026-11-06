import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// No test here calls a real AI service. The plan stream answers "no keys", which
// sends the app down its built-in planner, so plans are instant and free.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/pathfinder/stream', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No keys', code: 'NO_AI_KEYS' }) }),
  );
  await page.route('**/api/budget/rhythm', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
});

async function enterDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Your agent is working.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Alex/ })).toBeVisible({ timeout: 25_000 });
}

async function openAccounts(page: Page) {
  await page.getByRole('button', { name: 'Account', exact: true }).filter({ visible: true }).first().click();
  await page.getByRole('menuitem', { name: 'Accounts' }).click();
}

async function makePlan(page: Page) {
  await page.getByRole('button', { name: 'Ask', exact: true }).filter({ visible: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Make a plan' }).click();
  await page.getByRole('button', { name: 'Pay off debt' }).click();
  await expect(page.getByRole('heading', { name: /What I.d do/ })).toBeVisible({ timeout: 20_000 });
}

test('the landing page sorts its pile in one click', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /never build/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sort this pile in one click' }).click();
  await expect(page.getByText('renews by itself').first()).toBeVisible();
  await expect(page.getByText('Not in your budget')).toBeVisible();
  await page.getByRole('button', { name: 'Spill them again' }).click();
  await expect(page.getByRole('button', { name: 'Sort this pile in one click' })).toBeVisible();
});

test('the statement flips between your bank and Pathfinder', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-scroller]').evaluate((node) => node.scrollTo({ top: document.querySelector('#why')!.getBoundingClientRect().top - 80, behavior: 'instant' }));
  const bank = page.getByRole('button', { name: 'Your bank' });
  const ours = page.getByRole('button', { name: 'Pathfinder' });
  await expect(ours).toHaveAttribute('aria-pressed', 'true');
  await bank.click();
  await expect(bank).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('AMZN MKTP CA*2K41L9')).toBeVisible();
  await ours.click();
  await expect(page.getByText('Free return until Nov 14')).toBeVisible();
});

test('the streak on the landing page can be punched', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByRole('list', { name: /5 of 7 days/ })).toBeVisible();
  await page.getByRole('button', { name: 'Check in' }).click();
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByText('270')).toBeVisible();
});

test('a single receipt can be filed by clicking it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File the Costco receipt' }).click();
  await expect(page.getByText('Groceries · Gmail')).toBeVisible();
});

test('the demo goes from landing to a full dashboard with no typing', async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: /^Bills/ }).first().click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Coming up' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Everyday' })).toBeVisible();
  await expect(page.getByText(/^4-day streak/)).toBeVisible();
});

test('checking in adds to the streak and shows how yesterday went', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: 'Check in' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Day 5')).toBeVisible();
  await expect(sheet.getByText(/Yesterday/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('5-day streak')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in' })).toHaveCount(0);
});

test('a check-in ends with a find and a reason to return', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: 'Check in' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText(/^Tomorrow:|renews on/)).toBeVisible();
  const download = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Remind me' }).click();
  expect((await download).suggestedFilename()).toBe('pathfinder-reminders.ics');
  await expect(sheet.getByText('Added')).toBeVisible();
});

test('points add up and the week has one goal', async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByRole('list', { name: /4 of 7 days/ })).toBeVisible();
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByRole('dialog').getByText(/^\+\d+ points$/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /\d+ points/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('How to earn')).toBeVisible();
  await expect(sheet.getByText('Level 1 · Starter')).toBeVisible();
});

test('right-click changes things where they are', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterDemo(page);
  await page.getByRole('button', { name: /^Groceries/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Pin to top' }).click();
  await expect(page.getByRole('status')).toContainText('Groceries stays on top');

  await page.getByRole('button', { name: /Ikea/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Put back in budget' }).click();
  await expect(page.getByRole('heading', { name: 'One-time' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { name: 'One-time' })).toBeVisible();
});

test('a streak survives a reload', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: 'Check in' }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByText('5-day streak')).toBeVisible();
});

test('a returning visitor goes straight to their dashboard', async ({ page }) => {
  await enterDemo(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Alex/ })).toBeVisible();
});

test('signing out clears everything', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: 'Account', exact: true }).filter({ visible: true }).first().click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: /never build/ })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('budget') || key.includes('session')))).toEqual([]);
});

test('asking the agent produces a plain answer', async ({ page }) => {
  await enterDemo(page);
  await makePlan(page);
});

test('approving plan steps saves them', async ({ page }) => {
  await enterDemo(page);
  await makePlan(page);
  await page.getByRole('button', { name: /^Review \d+ step/ }).click();
  await expect(page.getByText('Review your plan')).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Your plan is saved.')).toBeVisible();
});

test('one click brings in Gmail and Apple Wallet together', async ({ page }) => {
  // Stands in for Google and the AI, so this runs anywhere and costs nothing
  await page.addInitScript(() => {
    (window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: { callback: (response: { access_token: string }) => void }) => ({ requestAccessToken: () => config.callback({ access_token: 'test-token' }) }),
          hasGrantedAllScopes: () => true,
        },
      },
    };
  });
  await page.route('https://www.googleapis.com/oauth2/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ given_name: 'Sam', email: 'sam@example.com' }) }),
  );
  await page.route('https://gmail.googleapis.com/**', (route) => {
    const url = decodeURIComponent(route.request().url());
    const now = String(Date.now());
    const reply = (body: object) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/messages?')) return reply({ messages: url.includes('q=subject:"Pathfinder tap"') ? [{ id: 'tap' }, { id: 'tap-twice' }] : [{ id: 'order' }, { id: 'plan' }] });
    if (url.includes('/messages/tap-twice')) return reply({ internalDate: now, payload: { headers: [{ name: 'Subject', value: 'Pathfinder tap | CA$84.17 | Amazon' }] } });
    if (url.includes('/messages/tap')) return reply({ internalDate: now, payload: { headers: [{ name: 'Subject', value: 'Pathfinder tap | CA$12.50 | Tim Hortons' }] } });
    return reply({ internalDate: now, snippet: 'Thanks for your order. Total $84.17', payload: { headers: [{ name: 'From', value: 'Amazon <orders@amazon.ca>' }, { name: 'Subject', value: 'Your order' }] } });
  });
  await page.route('**/api/budget/read', async (route) => {
    expect((route.request().postDataJSON() as { emails: string }).emails).toContain('Total $84.17');
    const date = new Date().toLocaleDateString('en-CA');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transactions: [
      { date, description: 'Amazon.ca', amount: 84.17, category: 'shopping' },
      { date, description: 'Cursor', amount: 29.1, category: 'bills', repeats: 'monthly' },
    ], deadlines: [{ kind: 'return', what: 'Socks', date: new Date(Date.now() + 3 * 86_400_000).toLocaleDateString('en-CA'), amount: 30.5 }] }) });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try the demo' })).toBeVisible();
  const google = page.getByRole('button', { name: 'Continue with Google' });
  test.skip(await google.count() === 0, 'Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID on the dev server');
  await google.click();
  await expect(page.getByRole('heading', { name: 'Your budget is ready.' })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText('Finish your setup, once')).toBeVisible();
  if (process.env.SHOT_DIR) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/setup-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/setup-phone.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await page.getByRole('button', { name: 'Open my budget' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sam/ })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText('1-day streak')).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pathfinder.budget.v1') ?? '{}') as { transactions: { description: string; source: string }[] });
  expect(saved.transactions.map((item) => [item.description, item.source]).sort()).toEqual([['Amazon.ca', 'mail'], ['Cursor', 'mail'], ['Tim Hortons', 'wallet']]);

  await page.getByRole('button', { name: /^Bills/ }).first().click();
  await expect(page.getByRole('dialog').getByText('Return Socks').first()).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Cursor').first()).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/renews by itself/)).toBeVisible();
  await page.keyboard.press('Escape');
});

test('a card statement joins what is already there without counting anything twice', async ({ page }) => {
  await enterDemo(page);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pathfinder.budget.v1') ?? '{}') as { transactions: { date: string; amount: number; source: string; description: string }[] });
  const already = before.transactions.find((item) => item.amount > 20 && item.source === 'mail')!;
  await page.route('**/api/budget/sort', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sorted: [{ name: 'QOMFORT CO', category: 'shopping' }] }) }));

  await openAccounts(page);
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  const csv = `Date,Description,Amount\n${already.date},${already.description.toUpperCase()} 123,${already.amount}\n${already.date},QOMFORT CO,92.70\n`;
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles({ name: 'card.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

  await expect.poll(async () => page.evaluate(() => (JSON.parse(localStorage.getItem('pathfinder.budget.v1') ?? '{}') as { transactions: unknown[] }).transactions.length), { timeout: 15_000 }).toBe(before.transactions.length + 1);
  const added = await page.evaluate(() => (JSON.parse(localStorage.getItem('pathfinder.budget.v1') ?? '{}') as { transactions: { description: string; categoryId: string; sure: boolean }[] }).transactions.find((item) => item.description === 'QOMFORT CO'));
  expect(added).toMatchObject({ categoryId: 'shopping', sure: true });
});

test('Apple Wallet is set up with steps, not screenshots', async ({ page }) => {
  await enterDemo(page);
  await openAccounts(page);
  await page.getByRole('button', { name: 'Connect' }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Sign in with Google to connect your iPhone.')).toBeVisible();
  await expect(sheet.getByText(/screenshot/i)).toHaveCount(0);
});

test('overlapping pictures count a purchase once', async ({ page }) => {
  await enterDemo(page);
  const rows = [{ date: '2026-11-01', description: 'Tim Hortons', amount: 9.84, category: 'eating' }];
  await page.route('**/api/budget/read', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transactions: rows }) }));
  const before = await page.evaluate(() => (JSON.parse(localStorage.getItem('pathfinder.budget.v1') ?? '{}') as { transactions: unknown[] }).transactions.length);

  await openAccounts(page);
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  // A one-pixel PNG is enough, since the AI is standing in
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: pixel },
    { name: 'two.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect.poll(async () => page.evaluate(() => (JSON.parse(localStorage.getItem('pathfinder.budget.v1') ?? '{}') as { transactions: unknown[] }).transactions.length), { timeout: 15_000 }).toBe(before + 1);
});

test('connecting a bank fills the budget, and a repeat counts once', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pathfinder.session.v1', JSON.stringify({ name: 'Sam', email: 'sam@example.com', kind: 'google' }));
    localStorage.setItem('pathfinder.budget.v1', JSON.stringify({
      income: 0,
      categories: [],
      merchantRules: {},
      transactions: [{ id: 'r1', date: new Date().toLocaleDateString('en-CA').slice(0, 7) + '-02', description: 'Netflix', amount: 20.99, categoryId: 'fun', sure: true, source: 'mail' }],
    }));
  });
  await page.goto('/');
  await openAccounts(page);
  const bank = page.getByText('Bank and cards');
  await bank.waitFor({ timeout: 8_000 }).catch(() => undefined);
  test.skip(await bank.count() === 0, 'The test bank only runs on a dev server');

  await bank.locator('..').locator('..').getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Test Bank')).toBeVisible({ timeout: 15_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pathfinder.budget.v1') ?? '{}') as { transactions: { description: string; date: string; sightings?: { source: string }[] }[] });
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const netflix = saved.transactions.filter((item) => item.description === 'Netflix' && item.date.startsWith(thisMonth));
  expect(netflix).toHaveLength(1);
  expect(netflix[0].sightings?.map((item) => item.source).sort()).toEqual(['bank', 'receipt']);

  await page.getByRole('tab', { name: 'Purchases' }).click();
  await page.getByRole('button', { name: /Netflix/ }).first().click();
  await expect(page.getByRole('dialog').getByText('Counted once')).toBeVisible();
});

test('a statement that cannot be read gets a friendly message', async ({ page }) => {
  await enterDemo(page);
  await openAccounts(page);
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles({ name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('hello there\nthis is not a statement') });
  await expect(page.getByRole('status').first()).toContainText("couldn't read");
});

test('a share link keeps numbers out of the query string', async ({ page }) => {
  await enterDemo(page);
  await makePlan(page);
  const { hash, search } = new URL(page.url());
  expect(hash).toContain('s=');
  expect(search).not.toContain('s=');
});

test('a signed-in family gets the same budget on a second device', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pathfinder.session.v1', JSON.stringify({ name: 'Sam', email: 'sam@example.com', kind: 'google' }));
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('pathfinder.budget.v1', JSON.stringify({
      income: 5000,
      categories: [{ id: 'groceries', name: 'Groceries', planned: 400 }],
      merchantRules: {},
      transactions: [{ id: 'cloud-1', date: new Date().toLocaleDateString('en-CA'), description: 'Cloud Grocer', amount: 88.5, categoryId: 'groceries', sure: true, source: 'mail' }],
    }));
  });
  await page.reload();
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/budget') && response.request().method() === 'PUT' && response.ok(), { timeout: 15_000 }).catch(() => null);
  test.skip(await saved === null, 'Needs a database on the server');

  // A new device: same session, nothing saved in the browser
  await page.evaluate(() => {
    localStorage.removeItem('pathfinder.budget.v1');
    localStorage.removeItem('pathfinder.cloud.v1');
  });
  await page.reload();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('pathfinder.budget.v1') ?? ''), { timeout: 15_000 }).toContain('Cloud Grocer');
});

test('nothing tappable sits under a host badge on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'nl-badge-frame';
    document.body.appendChild(frame);
  });
  const tab = page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Account' });
  await expect.poll(async () => {
    const box = await tab.boundingBox();
    return box ? 844 - (box.y + box.height) : 0;
  }).toBeGreaterThanOrEqual(56);
});

test.describe('on a big screen', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a budget changes from its category', async ({ page }) => {
    await enterDemo(page);
    await page.getByRole('button', { name: /^Groceries/ }).click();
    const sheet = page.getByRole('dialog');
    const field = sheet.getByRole('textbox', { name: 'Monthly budget' });
    await field.fill('1234');
    await field.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Groceries/ })).toContainText('of $1,234');
  });

  test('every purchase is searchable across months', async ({ page }) => {
    await enterDemo(page);
    await page.getByRole('tab', { name: 'Purchases' }).click();
    await page.getByPlaceholder('Find a purchase').fill('rent');
    await expect(page.getByRole('button', { name: /Rent/ }).first()).toBeVisible();
    await page.getByPlaceholder('Find a purchase').fill('zzzz');
    await expect(page.getByText('Nothing by that name.')).toBeVisible();
  });

  test('the year shows every month and jumps to one', async ({ page }) => {
    await enterDemo(page);
    await page.getByRole('tab', { name: 'Year' }).click();
    await expect(page.getByRole('group', { name: /Spending by month/ })).toBeVisible();
  });
});
