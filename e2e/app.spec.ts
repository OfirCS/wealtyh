import { test, expect } from '@playwright/test';
import { mockPathfinderResponse } from './fixtures/mock-result';

test.beforeEach(async ({ page }) => {
  // Mock the pathfinder API to avoid real AI calls
  await page.route('**/api/pathfinder', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPathfinderResponse),
    }),
  );
});

test('home screen shows total balance and account cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Total balance')).toBeVisible();
  await expect(page.getByText('Chequing')).toBeVisible();
  await expect(page.getByText('TFSA')).toBeVisible();
  await expect(page.getByText('RRSP')).toBeVisible();
  await expect(page.getByText('FHSA')).toBeVisible();
});

test('edit profile and save', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Edit accounts').click();
  await expect(page.getByText('Edit Snapshot')).toBeVisible();

  // Switch to accounts tab
  await page.getByRole('button', { name: 'accounts' }).click();
  await expect(page.getByText('Account Balances')).toBeVisible();

  // Save and return to display mode
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Total balance')).toBeVisible();
});

test('submit event → thinking → plan view', async ({ page }) => {
  await page.goto('/');

  // Open the prompt overlay via FAB
  await page.getByLabel('Open Pathfinder').click();

  // Type an event and submit
  const input = page.getByPlaceholder("I'm thinking about quitting my job to...");
  await input.fill('I want to build an emergency fund');
  await input.press('Enter');

  // Should transition to plan view
  await expect(page.getByText('Your Pathfinder')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Move $2,000 to Emergency Fund')).toBeVisible();
  await expect(page.getByText('Set up $200/mo auto-deposit to TFSA')).toBeVisible();
});

test('confirm action and return home with feedback', async ({ page }) => {
  await page.goto('/');

  // Submit event
  await page.getByLabel('Open Pathfinder').click();
  const input = page.getByPlaceholder("I'm thinking about quitting my job to...");
  await input.fill('I want to build an emergency fund');
  await input.press('Enter');
  await expect(page.getByText('Your Pathfinder')).toBeVisible({ timeout: 10_000 });

  // Tap the first action (move — requires double confirm)
  await page.getByText('Move $2,000 to Emergency Fund').first().click();
  await expect(page.getByText('Review transfer')).toBeVisible();
  await page.getByText('Review transfer').click();
  await expect(page.getByText('Confirm transfer')).toBeVisible();
  await page.getByText('Confirm transfer').click();

  // Action should now be in "Completed" section
  await expect(page.getByRole('heading', { name: 'Completed' })).toBeVisible();

  // Click "Back to Accounts"
  await page.getByRole('button', { name: 'Back to Accounts' }).click();

  // Should be back home with feedback
  await expect(page.getByText('Total balance')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Done')).toBeVisible();

  // Check balance delta and NEW pill on Emergency Fund
  await expect(page.getByText('-$2,000')).toBeVisible();
  await expect(page.getByText('Emergency Fund', { exact: true })).toBeVisible();
  await expect(page.getByText('New', { exact: true })).toBeVisible();
});

test('dismiss feedback banner', async ({ page }) => {
  await page.goto('/');

  // Fast path: submit + confirm + return
  await page.getByLabel('Open Pathfinder').click();
  const input = page.getByPlaceholder("I'm thinking about quitting my job to...");
  await input.fill('I want to build an emergency fund');
  await input.press('Enter');
  await expect(page.getByText('Your Pathfinder')).toBeVisible({ timeout: 10_000 });

  await page.getByText('Move $2,000 to Emergency Fund').first().click();
  await page.getByText('Review transfer').click();
  await page.getByText('Confirm transfer').click();
  await page.getByRole('button', { name: 'Back to Accounts' }).click();
  await expect(page.getByText('Done')).toBeVisible({ timeout: 5_000 });

  // Dismiss banner
  await page.getByLabel('Dismiss').click();
  await expect(page.getByText('Done')).not.toBeVisible();
});

test('plan view tab navigation', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Open Pathfinder').click();
  const input = page.getByPlaceholder("I'm thinking about quitting my job to...");
  await input.fill('I want to build an emergency fund');
  await input.press('Enter');
  await expect(page.getByText('Your Pathfinder')).toBeVisible({ timeout: 10_000 });

  // Actions tab (default)
  await expect(page.getByText('Move $2,000 to Emergency Fund')).toBeVisible();

  // Switch to Impacts
  await page.getByRole('button', { name: 'impacts' }).click();
  await expect(page.getByText('Chequing', { exact: true })).toBeVisible();

  // Switch to Cashflow
  await page.getByRole('button', { name: 'cashflow' }).click();
  await expect(page.getByText('Month 1').first()).toBeVisible();

  // Back to Actions
  await page.getByRole('button', { name: 'actions' }).click();
  await expect(page.getByText('Move $2,000 to Emergency Fund')).toBeVisible();
});

test('start over returns to home', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Open Pathfinder').click();
  const input = page.getByPlaceholder("I'm thinking about quitting my job to...");
  await input.fill('I want to build an emergency fund');
  await input.press('Enter');
  await expect(page.getByText('Your Pathfinder')).toBeVisible({ timeout: 10_000 });

  // Click "Start over"
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByText('Total balance')).toBeVisible({ timeout: 5_000 });
});
