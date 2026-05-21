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

test.describe('Expenses API — Income Type Support', () => {

  test('POST /api/expenses with type=income creates income entry', async () => {
    const token = await getDemoToken();
    const res = await fetch('http://localhost:3001/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: 5000, category: 'Salary', description: 'Test income', date: '2026-05-01', type: 'income' })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.expense).toHaveProperty('type', 'income');
  });

  test('POST /api/expenses without type defaults to expense', async () => {
    const token = await getDemoToken();
    const res = await fetch('http://localhost:3001/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount: 100, category: 'Food', description: 'Default type test', date: '2026-05-01' })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.expense).toHaveProperty('type', 'expense');
  });

  test('GET /api/expenses?type=income returns only income entries', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/expenses', { token, params: { type: 'income' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.expenses)).toBe(true);
    if (data.expenses.length > 0) {
      data.expenses.forEach(exp => expect(exp.type).toBe('income'));
    }
  });

  test('GET /api/expenses/stats includes income_total and net_cashflow', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/expenses/stats', { token });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('income_total');
    expect(data).toHaveProperty('net_cashflow');
    expect(data).toHaveProperty('income_all_time');
    expect(data).toHaveProperty('cashflow_all_time');
  });

});
