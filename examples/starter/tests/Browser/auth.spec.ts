import { expect, test } from '@playwright/test';

/**
 * The register → welcome notification → inbox flow, driven through the real
 * browser (Dusk-equivalent). The webServer (playwright.config.ts) boots the
 * app on a dedicated test database.
 */
test('register lands on the dashboard with the welcome notification in the inbox', async ({ page }) => {
  await page.goto('/register');

  // Fill the shadcn form (labels are wired to inputs via htmlFor/id).
  // Exact matching: 'Password' would also match 'Confirm password'.
  await page.getByLabel('Name', { exact: true }).fill('Playwright');
  await page.getByLabel('Email', { exact: true }).fill(`pw-${Date.now()}@chavajs.dev`);
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByLabel('Confirm password', { exact: true }).fill('password');

  await page.getByRole('button', { name: 'Register' }).click();

  // Register → session auth → dashboard, with the welcome notification.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Hi, Playwright/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Inbox/ })).toBeVisible();

  // Open the inbox — the welcome notification is there, unread.
  await page.getByRole('link', { name: /Inbox/ }).click();
  await expect(page.getByText('Welcome to chavaJs!')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Mark read/ })).toBeVisible();

  // Mark it read — the item becomes read and the action button disappears.
  await page.getByRole('button', { name: /Mark read/ }).first().click();
  await expect(page.getByRole('button', { name: /Mark read/ })).toHaveCount(0, { timeout: 10_000 });
});
