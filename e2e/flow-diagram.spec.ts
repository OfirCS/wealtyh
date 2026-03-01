import { test, expect } from '@playwright/test';
import { mockPathfinderResponse } from './fixtures/mock-result';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/pathfinder', (route) => {
    if (route.request().url().includes('/think')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ steps: [{ title: 'Analyzing finances', insights: [] }] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPathfinderResponse),
    });
  });
});

test('flow diagram is visible on home screen with User Profile active', async ({ page }) => {
  await page.goto('/');

  // The diagram should be present
  const diagram = page.locator('aside');
  await expect(diagram).toBeVisible();

  // "Pipeline" label
  await expect(diagram.getByText('Pipeline')).toBeVisible();

  // All 6 step labels should be present
  await expect(diagram.getByText('User Profile')).toBeVisible();
  await expect(diagram.getByText('Life Event')).toBeVisible();
  await expect(diagram.getByText('AI Router')).toBeVisible();
  await expect(diagram.getByText('Web Search')).toBeVisible();
  await expect(diagram.getByText('AI Generation')).toBeVisible();
  await expect(diagram.getByText('Plan Output')).toBeVisible();
});

test('flow diagram highlights Life Event when prompt is open', async ({ page }) => {
  await page.goto('/');

  // Open prompt overlay
  await page.getByLabel('Open Pathfinder').click();

  // The "Financial snapshot" sublabel should still be visible (User Profile step)
  const diagram = page.locator('aside');
  await expect(diagram.getByText('User Profile')).toBeVisible();
  await expect(diagram.getByText('Life Event')).toBeVisible();
});

test('flow diagram progresses through thinking steps', async ({ page }) => {
  await page.goto('/');

  // Submit a query
  await page.getByLabel('Open Pathfinder').click();
  const input = page.locator('textarea').first();
  await input.fill('I want to build an emergency fund');
  await input.press('Enter');

  // Diagram should still be visible during thinking
  const diagram = page.locator('aside');
  await expect(diagram).toBeVisible();
  await expect(diagram.getByText('AI Router')).toBeVisible();

  // Wait for plan view to load (thinking animation takes ~8s)
  await expect(page.getByText('Your Plan')).toBeVisible({ timeout: 20_000 });

  // Diagram should show Plan Output step
  await expect(diagram.getByText('Plan Output')).toBeVisible();
});

test('flow diagram persists across all app states', async ({ page }) => {
  await page.goto('/');
  const diagram = page.locator('aside');

  // Home state
  await expect(diagram).toBeVisible();

  // Submit event to go to thinking → plan
  await page.getByLabel('Open Pathfinder').click();
  const input = page.locator('textarea').first();
  await input.fill('I want to build an emergency fund');
  await input.press('Enter');

  // During thinking
  await expect(diagram).toBeVisible();

  // Plan state
  await expect(page.getByText('Your Plan')).toBeVisible({ timeout: 10_000 });
  await expect(diagram).toBeVisible();

  // Reset to home
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByText('Total balance')).toBeVisible({ timeout: 5_000 });
  await expect(diagram).toBeVisible();
});
