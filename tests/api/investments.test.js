/**
 * Baseline API tests for investments.
 * RED test: investments endpoint doesn't exist yet (expects 404).
 * Updated in Task 5 to expect 200.
 */
const { test, expect } = require('@playwright/test');
const { getDemoToken, apiGet } = require('../helpers/setup');

test.describe('Investments API Baseline', () => {

  test('GET /api/investments returns HTML fallback (route not implemented yet)', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/investments', { token });
    // Route doesn't exist yet — Express SPA fallback catches it
    // RED test: verify it's NOT a proper API response
    const ct = res.headers.get('content-type') || '';
    expect(ct).toContain('text/html');
  });

});
