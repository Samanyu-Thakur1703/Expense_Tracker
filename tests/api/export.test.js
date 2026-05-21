const { test, expect } = require('@playwright/test');
const { getDemoToken } = require('../helpers/setup');

test.describe('CSV Export API', () => {

  test('GET /api/expenses/export returns CSV', async () => {
    const token = await getDemoToken();
    const res = await fetch('http://localhost:3001/api/expenses/export', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const body = await res.text();
    expect(body).toContain('Date,Type,Category,Description,Amount');
    expect(body).toContain('Grocery');
  });

  test('CSV export with date filter', async () => {
    const token = await getDemoToken();
    const res = await fetch('http://localhost:3001/api/expenses/export?start_date=2026-05-15&end_date=2026-05-16', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    const lines = body.trim().split('\n');
    // Header + maybe 1-2 data rows within date range
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

});
