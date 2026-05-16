import { test, expect } from '@playwright/test';

test('Dark mode applies to AI components', async ({ page }) => {
  await page.goto('file:///E:/ex_tracker/index.html');

  // Login first
  await page.fill('#login-email', 'test@example.com');
  await page.fill('#login-password', 'test123');
  await page.click('button:text("Sign In")');

  // Handle setup modal if it appears (first login)
  const setupModal = page.locator('#setup-modal');
  if (await setupModal.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.fill('#set-balance', '10000');
    await page.fill('#set-budget', '5000');
    await page.click('button:text("Start")');
    // Wait for setup modal to close
    await setupModal.waitFor({ state: 'hidden', timeout: 5000 });
  }

  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Click dark mode toggle
  const toggle = page.locator('#theme-toggle');
  await toggle.click();

  // Check AI panel background changed to dark
  const panel = page.locator('.ai-team-panel');
  await expect(panel).toBeVisible();
  const bg = await panel.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgb(255, 255, 255)');
});
