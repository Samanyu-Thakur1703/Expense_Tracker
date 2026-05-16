import { test, expect } from '@playwright/test';

test('AI Stock Manager - refresh updates recommendations', async ({ page }) => {
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

  // Navigate to Investments view
  await page.click('a[href="#investments"]');
  await page.waitForTimeout(500);

  // Click refresh recommendations button
  const btn = page.locator('#refresh-recs-btn');
  await btn.waitFor({ state: 'visible' });
  await btn.click();
  await page.waitForTimeout(1500);

  // Verify recommendations are displayed
  const recs = page.locator('#ai-rec-list .rec-item');
  const count = await recs.count();
  expect(count).toBeGreaterThan(0);
});
