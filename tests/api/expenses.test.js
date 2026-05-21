/**
 * Baseline API tests for expenses.
 * Tests existing expense GET endpoint and verifies seed data.
 */
const { test, expect } = require('@playwright/test');
const { getDemoToken, apiGet } = require('../helpers/setup');

test.describe('Expenses API Baseline', () => {

  test('GET /api/expenses returns seeded expenses for demo user', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/expenses', { token });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.expenses).toBeDefined();
    expect(Array.isArray(data.expenses)).toBe(true);
    // Demo user is seeded with 7 sample expenses
    expect(data.expenses.length).toBeGreaterThanOrEqual(7);
  });

  test('GET /api/expenses/stats returns stats object', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/expenses/stats', { token });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('monthly_total');
    expect(data).toHaveProperty('all_time_total');
    expect(data).toHaveProperty('category_breakdown');
    expect(data).toHaveProperty('daily_totals');
  });

  test('Unauthenticated request returns 401', async () => {
    const res = await fetch('http://localhost:3001/api/expenses');
    expect(res.status).toBe(401);
  });

});
