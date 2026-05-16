import { test, expect } from '@playwright/test';

test('Expenses CRUD basics', async ({ page }) => {
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

  // Navigate to Expenses view
  await page.click('a[href="#expenses"]');
  await page.waitForTimeout(500);

  // Open Add Expense modal
  const addBtn = page.locator('text=Add Expense');
  await addBtn.first().click();
  await page.waitForSelector('#expense-modal:not(.hidden)');

  // Fill expense form
  await page.fill('#exp-amount', '50');
  await page.selectOption('#exp-category', 'Food');
  await page.fill('#exp-desc', 'Playwright test expense');
  const today = new Date().toISOString().split('T')[0];
  await page.fill('#exp-date', today);

  // Save expense
  await page.click('text=Save Expense');
  await page.waitForTimeout(500);

  // Search for the newly added item
  const search = page.locator('#expense-search');
  await search.fill('Playwright test expense');
  await page.waitForTimeout(500);

  // Basic assertion: search results should contain at least 1 row
  const rows = page.locator('#expenses-tbody tr');
  await expect(rows.first()).toBeVisible();
});
