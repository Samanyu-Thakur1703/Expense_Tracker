import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  reporter: 'list',
  use: {
    headless: true
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
});
