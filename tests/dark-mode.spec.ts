import { test, expect } from '@playwright/test';

test('Dark mode applies to AI components', async ({ page }) => {
  await page.goto('http://localhost:3001');

  // Login first
  await page.fill('#login-email', 'demo@fintrack.com');
  await page.fill('#login-password', 'demo1234');
  await page.click('button:text("Sign In")');

  // Handle setup modal if it appears (first login)
  const setupModal = page.locator('#setup-modal');
  if (await setupModal.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.fill('#set-balance', '10000');
    await page.fill('#set-budget', '5000');
    await page.click('button:text("Save")');
    // Wait for setup modal to close
    await setupModal.waitFor({ state: 'hidden', timeout: 5000 });
  }

  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Click dark mode toggle
  const toggle = page.locator('#theme-toggle');
  await toggle.click();

  // Check dark mode applied (sidebar bg should be dark)
  const sidebar = page.locator('#sidebar');
  await expect(sidebar).toBeVisible();
  const bg = await sidebar.evaluate(el => getComputedStyle(el).backgroundColor);
  // Sidebar should have a non-white background in dark mode
  expect(bg).not.toBe('rgb(255, 255, 255)');
});
