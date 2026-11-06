import { defineConfig } from '@playwright/test';

// Point E2E_PORT at a dev server to test work in progress without touching the running app
const port = Number(process.env.E2E_PORT ?? 3003);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 2,
  retries: 0,
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port,
    reuseExistingServer: true,
  },
});
