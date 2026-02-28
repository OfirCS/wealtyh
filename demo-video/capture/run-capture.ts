import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const MOCK_RESPONSE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'mock-response.json'), 'utf-8')
);

const LIFE_EVENT =
  "We're having a baby in June and thinking about moving to a bigger place around $650K. My partner will take 12 months parental leave.";

// ─── Helpers ───

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Type each character with a human-like delay */
async function typeHumanlike(page: Page, text: string, baseDelay = 75) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 0 });
    // Vary speed: slower for spaces/punctuation, faster for letters
    const jitter = (Math.random() - 0.5) * 30;
    const delay = ' .,\''.includes(char) ? baseDelay + 40 : baseDelay;
    await sleep(delay + jitter);
  }
}

/** Smoothly scroll the main content area */
async function smoothScroll(page: Page, pixels: number) {
  await page.evaluate((px) => {
    // The main scrollable div is the .overflow-y-auto container
    const el = document.querySelector('.overflow-y-auto');
    if (el) {
      el.scrollBy({ top: px, behavior: 'smooth' });
    }
  }, pixels);
  await sleep(800); // Let scroll animation finish
}

/** Wait for an element and ensure it's stable before clicking */
async function safeClick(page: Page, selector: string, label: string) {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout: 5000 });
    await sleep(300); // Wait for entrance animations
    await el.click();
    console.log(`  ✓ Clicked: ${label}`);
  } catch (e) {
    console.log(`  ✗ Could not click: ${label} (${selector})`);
  }
}

// ─── Main ───

async function main() {
  console.log('═══ Pathfinder Demo Capture ═══\n');

  // Clean up any previous capture files
  const publicDir = path.join(__dirname, '..', 'public');
  for (const f of fs.readdirSync(publicDir)) {
    if (f.endsWith('.webm')) {
      fs.unlinkSync(path.join(publicDir, f));
    }
  }

  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: publicDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // ─── Mock API Routes ───

  await page.route('**/api/pathfinder', async (route) => {
    console.log('  [mock] /api/pathfinder hit → waiting 8s for thinking...');
    await sleep(8000);
    console.log('  [mock] Responding with mock data');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RESPONSE),
    });
  });

  await page.route('**/api/generate-image', async (route) => {
    console.log('  [mock] /api/generate-image → skip');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ imageBase64: null }),
    });
  });

  // ─── SCENE 1: Home Screen ───

  console.log('\n▸ Scene 1: Home Screen');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await sleep(2000);

  // Let the user see the full home screen with accounts
  console.log('  Showing home screen with accounts...');
  await sleep(4000);

  // ─── SCENE 2: Open Prompt Overlay ───

  console.log('\n▸ Scene 2: Open Prompt');
  await safeClick(page, 'button[aria-label="Open Pathfinder"]', 'FAB compass button');
  await sleep(1500); // Let the overlay slide up + settle

  // ─── SCENE 3: Type Life Event ───

  console.log('\n▸ Scene 3: Type Life Event');

  // Focus the textarea
  const textarea = page.locator('textarea');
  await textarea.waitFor({ state: 'visible', timeout: 3000 });
  await textarea.click();
  await sleep(500);

  // Type with human-like pacing
  console.log('  Typing life event...');
  await typeHumanlike(page, LIFE_EVENT, 75);
  console.log('  Typing complete');
  await sleep(1200); // Pause to show the full text

  // ─── SCENE 4: Submit ───

  console.log('\n▸ Scene 4: Submit');
  await safeClick(page, 'button[aria-label="Submit prompt"]', 'Submit button');
  await sleep(500);

  // ─── SCENE 5: Thinking View ───

  console.log('\n▸ Scene 5: Thinking View');

  // Wait for the thinking view to appear
  try {
    await page.waitForSelector('text=Pathfinder is analyzing', { timeout: 5000 });
    console.log('  Thinking view visible');
  } catch {
    console.log('  (thinking text not detected, continuing...)');
  }

  // Watch the thinking animation play out + API delay (8s)
  // Thinking lines appear at ~1200ms intervals, 5 lines = 6s
  // Plus the 8s API delay = total ~14s
  await sleep(13000);

  // ─── SCENE 6: Plan View — Actions Tab ───

  console.log('\n▸ Scene 6: Plan View — Actions Tab');

  // Wait for the plan view to render
  try {
    await page.waitForSelector('text=Your Pathfinder', { timeout: 8000 });
    console.log('  Plan view loaded');
  } catch {
    console.log('  (plan view header not found, continuing...)');
  }

  await sleep(2500); // Let action cards animate in

  // Scroll up to make sure we see the full plan header
  await smoothScroll(page, -500);
  await sleep(2000);

  // Show the actions for a moment
  await sleep(2000);

  // ─── SCENE 7: Click Action — Show Double-Confirm Flow ───

  // Click the SECOND action (type: "move") to show the double-confirm transfer flow
  console.log('\n▸ Scene 7: Confirmation Flow');

  // Click on "Max FHSA — contribute $1,600" (the move/transfer action)
  await safeClick(
    page,
    'button:has-text("Max FHSA")',
    'Action: Max FHSA (transfer)'
  );
  await sleep(1500); // Let confirmation sheet slide up

  // First confirm: "Review transfer"
  await safeClick(
    page,
    'button:has-text("Review transfer")',
    'Review transfer (first confirm)'
  );
  await sleep(2000); // Show the warning banner

  // Second confirm: "Confirm transfer"
  await safeClick(
    page,
    'button:has-text("Confirm transfer")',
    'Confirm transfer (second confirm)'
  );
  await sleep(2000); // See the action move to "Completed"

  // Show the completed state
  await sleep(2000);

  // ─── SCENE 8: Impacts Tab ───

  console.log('\n▸ Scene 8: Impacts Tab');

  // Click "impacts" tab
  await safeClick(page, 'button:has-text("impacts")', 'Impacts tab');
  await sleep(2000); // Let impact grid animate in

  // Scroll to see account impact cards
  await smoothScroll(page, 350);
  await sleep(3000);

  // ─── SCENE 9: Cashflow Tab ───

  console.log('\n▸ Scene 9: Cashflow Tab');

  // Scroll back up first so tabs are visible
  await smoothScroll(page, -400);
  await sleep(800);

  // Click "cashflow" tab
  await safeClick(page, 'button:has-text("cashflow")', 'Cashflow tab');
  await sleep(2500); // Let cashflow chart animate

  // Scroll down to see advisor flag
  await smoothScroll(page, 450);
  await sleep(3000);

  // ─── SCENE 10: Advisor Flag ───

  console.log('\n▸ Scene 10: Advisor Flag');

  // Let the advisor flag be prominent on screen
  await sleep(4000);

  // ─── END ───

  console.log('\n▸ Recording complete. Saving video...');

  // Close context to finalize the video
  await context.close();
  await browser.close();

  // Rename the video file to capture.webm
  await sleep(500);
  const files = fs.readdirSync(publicDir).filter((f) => f.endsWith('.webm'));

  if (files.length > 0) {
    const sorted = files
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(publicDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    const src = path.join(publicDir, sorted[0].name);
    const dest = path.join(publicDir, 'capture.webm');

    if (sorted[0].name !== 'capture.webm') {
      fs.renameSync(src, dest);
    }

    const stats = fs.statSync(dest);
    const duration = Math.round(stats.size / 50000); // rough estimate
    console.log(`\n═══ Done ═══`);
    console.log(`  File: public/capture.webm`);
    console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  } else {
    console.error('\n✗ No .webm video files found!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n✗ Capture failed:', err);
  process.exit(1);
});
