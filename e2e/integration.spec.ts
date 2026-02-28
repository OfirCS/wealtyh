import { test, expect } from '@playwright/test';

// Tag: @integration — skipped by default, run with: npm run test:e2e:integration
// Requires GOOGLE_API_KEY in .env and real Gemini API access.

test('@integration full flow with real AI', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/');
  await expect(page.getByText('Total balance')).toBeVisible();

  // Open prompt and submit a simple event
  await page.getByLabel('Open Pathfinder').click();
  const input = page.getByPlaceholder("I'm thinking about quitting my job to...");
  await input.fill('I want to pay off my debt faster');
  await input.press('Enter');

  // Wait for real AI to process (up to 3 minutes)
  await expect(page.getByText('Your Pathfinder')).toBeVisible({ timeout: 180_000 });

  // Should have at least one action
  await expect(page.getByText('actions based on your data')).toBeVisible();

  // Confirm the first action card
  const firstAction = page.locator('button.group').first();
  await firstAction.click();

  // Handle confirmation (could be transfer or non-transfer)
  const confirmBtn = page.getByRole('button').filter({
    hasText: /Review transfer|Confirm|Set up automation|Create goal|Open account/,
  });
  await confirmBtn.first().click();

  // If double-confirm needed (transfer type), click again
  const transferConfirm = page.getByText('Confirm transfer');
  if (await transferConfirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await transferConfirm.click();
  }

  // Should see completed section
  await expect(page.getByText('Completed')).toBeVisible({ timeout: 5_000 });

  // Go back to accounts
  await page.getByRole('button', { name: 'Back to Accounts' }).click();
  await expect(page.getByText('Total balance')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Done')).toBeVisible();
});
