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
});

/** Nothing may run off the window or get silently cut off inside a panel. */
async function expectToFit(page: Page, label: string, slug: string) {
  await page.waitForTimeout(700);
  const problems = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const off = [...document.querySelectorAll('main *, header *')]
      .filter((element) => {
        if (element.closest('.sr-only')) return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && (box.bottom > vh + 1 || box.right > vw + 1 || box.left < -1);
      })
      .slice(0, 3)
      .map((element) => `${element.tagName}: ${(element.textContent ?? '').trim().slice(0, 30)}`);
    const cut = [...document.querySelectorAll('main *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.overflowY !== 'visible'
          && element.clientHeight > 40
          && element.scrollHeight > element.clientHeight + 2
          && !/truncate|line-clamp/.test(String((element as HTMLElement).className));
      })
      .slice(0, 3)
      .map((element) => `cut off: ${element.tagName} ${element.scrollHeight} > ${element.clientHeight}`);
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

    test('every screen fits with no scrolling', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'What’s changing in your life?' })).toBeVisible();
      await expectToFit(page, 'first screen', `${tag}-home`);

      await page.getByRole('button', { name: 'Having a baby' }).click();
      await expect(page.getByRole('heading', { name: 'Let me see your money.' })).toBeVisible();
      await expectToFit(page, 'connect step', `${tag}-connect`);

      await page.getByRole('button', { name: 'Type it in instead' }).click();
      await expect(page.getByRole('heading', { name: 'What do you earn in a year?' })).toBeVisible();
      await expectToFit(page, 'question', `${tag}-question`);

      await page.getByRole('navigation').getByRole('button', { name: 'Budget' }).click();
      await expect(page.getByRole('grid').first()).toBeVisible();
      await expectToFit(page, 'budget', `${tag}-budget`);

      await page.getByRole('navigation').getByRole('button', { name: 'Plan' }).click();
      await page.getByRole('button', { name: 'Back' }).click();
      await page.getByRole('button', { name: 'Try it with sample numbers' }).click();
      await expect(page.getByText('Your money')).toBeVisible();
      await expectToFit(page, 'home with numbers', `${tag}-money`);

      await page.getByRole('button', { name: 'Pay off debt' }).click();
      await expect(page.getByRole('heading', { name: 'What to do' })).toBeVisible({ timeout: 15_000 });
      await expectToFit(page, 'plan', `${tag}-plan`);
    });
  });
}
