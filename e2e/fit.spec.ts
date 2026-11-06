import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SIZES = [
  { name: 'large desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'small laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small phone', width: 360, height: 640 },
];

const SHOTS = process.env.SHOT_DIR;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/pathfinder/stream', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No keys', code: 'NO_AI_KEYS' }) }),
  );
  await page.route('**/api/budget/rhythm', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
});

/** The page never scrolls sideways or as a whole. Long lists scroll in their own panel. */
async function expectToFit(page: Page, label: string, slug: string) {
  await page.waitForTimeout(800);
  const problems = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const off = [...document.querySelectorAll('body *')]
      .filter((element) => {
        if (element.closest('.sr-only') || element.closest('[aria-hidden="true"]') || element.tagName === 'SCRIPT') return false;
        const box = element.getBoundingClientRect();
        const sideways = box.right > vw + 1 || box.left < -1;
        const below = box.bottom > vh + 1 && !element.closest('main, .hide-scrollbar, [data-scroller]');
        return box.width > 0 && box.height > 0 && (sideways || below);
      })
      .slice(0, 3)
      .map((element) => `${element.tagName}: ${(element.textContent ?? '').trim().slice(0, 30)}`);
    const cut = [...document.querySelectorAll('[role="dialog"]')]
      .filter((element) => element.scrollHeight > element.clientHeight + 2)
      .slice(0, 3)
      .map((element) => `cut off: ${(element.textContent ?? '').trim().slice(0, 30)} ${element.scrollHeight} > ${element.clientHeight}`);
    const pageScrolls = document.documentElement.scrollHeight > vh + 1 ? ['the page scrolls'] : [];
    return [...pageScrolls, ...off, ...cut];
  });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${slug}.png` });
  expect(problems, label).toEqual([]);
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const tag = `${size.width}x${size.height}`;

    test('every screen fits the window', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /never build/ })).toBeVisible();
      await page.waitForTimeout(1600);
      await expectToFit(page, 'landing', `${tag}-landing`);

      await page.getByRole('button', { name: 'Sort this pile in one click' }).click();
      await expect(page.getByRole('button', { name: 'Spill them again' })).toBeVisible();
      await page.waitForTimeout(1200);
      await expectToFit(page, 'landing, sorted', `${tag}-landing-sorted`);

      await page.getByRole('button', { name: 'Try the demo' }).click();
      await expect(page.getByRole('heading', { name: 'Your agent is working.' })).toBeVisible();
      await page.waitForTimeout(1900);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-run.png` });

      await expect(page.getByRole('heading', { name: /Alex/ })).toBeVisible({ timeout: 25_000 });
      await expectToFit(page, 'dashboard', `${tag}-dashboard`);

      await page.getByRole('button', { name: 'Check in' }).click();
      await expect(page.getByRole('dialog').getByText('Day 5')).toBeVisible();
      await expectToFit(page, 'check-in', `${tag}-checkin`);
      await page.keyboard.press('Escape');

      await page.getByRole('tab', { name: 'Year' }).click();
      await expect(page.getByRole('group', { name: /Spending by month/ })).toBeVisible();
      await expectToFit(page, 'year', `${tag}-year`);

      await page.getByRole('tab', { name: 'Purchases' }).click();
      await expect(page.getByPlaceholder('Find a purchase')).toBeVisible();
      await expectToFit(page, 'purchases', `${tag}-purchases`);

      await page.getByRole('tab', { name: 'Month' }).click();
      await expect(page.getByRole('heading', { name: 'Everyday' })).toBeVisible();
      await expectToFit(page, 'budget', `${tag}-budget`);

      await page.getByRole('button', { name: 'Account', exact: true }).filter({ visible: true }).first().click();
      await page.getByRole('menuitem', { name: 'Accounts' }).click();
      await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
      await expectToFit(page, 'connections', `${tag}-connections`);

      await page.getByRole('button', { name: 'Ask', exact: true }).filter({ visible: true }).first().click();
      await page.getByRole('button', { name: 'Make a plan' }).click();
      await expect(page.getByText('Your money', { exact: true })).toBeVisible();
      await expectToFit(page, 'plans', `${tag}-plans`);

      await page.getByRole('button', { name: 'Pay off debt' }).click();
      await expect(page.getByRole('heading', { name: /What I.d do/ })).toBeVisible({ timeout: 20_000 });
      await expectToFit(page, 'plan', `${tag}-plan`);
    });
  });
}
