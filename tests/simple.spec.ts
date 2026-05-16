import { test, expect } from '@playwright/test';

test('sanity: app loads and has a title', async ({ page }) => {
  await page.goto('file:///E:/ex_tracker/index.html');
  // verify title exists
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});
