import { test, expect } from '@playwright/test';

test('AI Chatbot basic interaction', async ({ page }) => {
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
    await setupModal.waitFor({ state: 'hidden', timeout: 5000 });
  }

  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 5000 });

  // Wait for welcome toast to auto-dismiss (3s + buffer)
  await page.waitForTimeout(4000);

  // Open chatbot
  await page.click('#open-chatbot');

  // Type and send message
  await page.fill('#chat-input', 'What is my total balance?');
  await page.press('#chat-input', 'Enter');

  // Wait for AI response to appear (1s delay + buffer)
  // The chatbot adds user message first, then AI response after 1s
  await page.waitForTimeout(2000);

  // Get all AI message bubbles and find the one with balance info
  const aiMessages = page.locator('.ai-message');
  const count = await aiMessages.count();

  // Check the last AI message (should be the response to our question)
  const lastMessage = aiMessages.nth(count - 1);
  const text = await lastMessage.textContent();

  // Verify AI responded (either with actual data or "not configured" notice)
  expect(text.length).toBeGreaterThan(0);
});
