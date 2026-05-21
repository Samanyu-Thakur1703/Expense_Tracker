const { test, expect } = require('@playwright/test');
const { getDemoToken, apiGet } = require('../helpers/setup');

test.describe('Search API', () => {

  test('GET /api/search?q=grocery finds expenses', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/search', { token, params: { q: 'grocery' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.expenses.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/search?q= returns empty', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/search', { token, params: { q: '' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.expenses).toEqual([]);
    expect(data.results.investments).toEqual([]);
  });

  test('search finds investments', async () => {
    const token = await getDemoToken();
    // First create an investment
    await fetch('http://localhost:3001/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ symbol: 'SEARCHTEST.NS', name: 'Search Test Corp', quantity: 1, buy_price: 100, current_price: 110 })
    });
    const res = await apiGet('/api/search', { token, params: { q: 'SEARCHTEST' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.investments.length).toBeGreaterThanOrEqual(1);
  });

});
