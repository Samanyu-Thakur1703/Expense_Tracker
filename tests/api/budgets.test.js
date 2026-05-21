const { test, expect } = require('@playwright/test');
const { getDemoToken, apiGet, apiPost, apiDelete } = require('../helpers/setup');

test.describe('Budgets API', () => {

  test('POST /api/budgets creates a budget', async () => {
    const token = await getDemoToken();
    const res = await apiPost('/api/budgets', { category: 'Food', monthly_limit: 5000 }, { token });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.category).toBe('Food');
    expect(data.monthly_limit).toBe(5000);
  });

  test('GET /api/budgets returns budgets with spent', async () => {
    const token = await getDemoToken();
    // Ensure Food budget exists
    await apiPost('/api/budgets', { category: 'Food', monthly_limit: 5000 }, { token });
    const res = await apiGet('/api/budgets', { token });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.budgets)).toBe(true);
    const food = data.budgets.find(b => b.category === 'Food');
    expect(food).toBeDefined();
    expect(food).toHaveProperty('monthly_limit');
    expect(food).toHaveProperty('spent');
  });

  test('DELETE /api/budgets/:category removes a budget', async () => {
    const token = await getDemoToken();
    await apiPost('/api/budgets', { category: 'Travel', monthly_limit: 3000 }, { token });
    const res = await apiDelete('/api/budgets/Travel', { token });
    expect(res.status).toBe(200);
  });

  test('rejects invalid monthly_limit', async () => {
    const token = await getDemoToken();
    const res = await apiPost('/api/budgets', { category: 'Bad', monthly_limit: -1 }, { token });
    expect(res.status).toBe(400);
  });

});
