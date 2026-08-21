import { defineConfig } from '@playwright/test';

/**
 * chavaJs browser tests — the Dusk equivalent for the React + Inertia
 * frontend. The webServer boots the application on a dedicated test database
 * (tests/Browser/e2e-server.ts).
 *
 *   npx playwright test        # after: npx playwright install chromium
 */
export default defineConfig({
  testDir: './tests/Browser',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'node --import tsx tests/Browser/e2e-server.ts',
    url: 'http://127.0.0.1:4173/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
