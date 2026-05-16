import { test, expect } from '@playwright/test';

test('Responsive layout basic checks', async ({ page }) => {
  await page.goto('file:///E:/ex_tracker/index.html');
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(400);
  const mainVisible = await page.locator('main').count();
  expect(mainVisible).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(400);
  expect(mainVisible).toBeGreaterThan(0);
});
