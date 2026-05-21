const { test, expect } = require('@playwright/test');
const { getDemoToken, apiGet, apiPost, apiPut, apiDelete } = require('../helpers/setup');

test.describe('Investments API', () => {

  test('POST /api/investments creates a holding', async () => {
    const token = await getDemoToken();
    const res = await apiPost('/api/investments', { symbol: 'RELIANCE.NS', name: 'Reliance Industries', quantity: 10, buy_price: 2800, current_price: 2910 }, { token });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.investment).toHaveProperty('id');
    expect(data.investment.symbol).toBe('RELIANCE.NS');
  });

  test('GET /api/investments returns holdings', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/investments', { token });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.investments)).toBe(true);
  });

  test('GET /api/investments/portfolio returns summary', async () => {
    const token = await getDemoToken();
    const res = await apiGet('/api/investments/portfolio', { token });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('total_invested');
    expect(data).toHaveProperty('current_value');
    expect(data).toHaveProperty('total_return');
    expect(data).toHaveProperty('return_percent');
    expect(data).toHaveProperty('holdings_count');
    expect(data).toHaveProperty('holdings');
  });

  test('PUT /api/investments/:id updates a holding', async () => {
    const token = await getDemoToken();
    const create = await apiPost('/api/investments', { symbol: 'TCS.NS', name: 'TCS', quantity: 5, buy_price: 3900, current_price: 3982 }, { token });
    const id = (await create.json()).investment.id;
    const res = await apiPut(`/api/investments/${id}`, { symbol: 'TCS.NS', name: 'TCS Updated', quantity: 10, buy_price: 3900, current_price: 4000 }, { token });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/investments/:id deletes a holding', async () => {
    const token = await getDemoToken();
    const create = await apiPost('/api/investments', { symbol: 'INFY.NS', name: 'Infosys', quantity: 1, buy_price: 1500, current_price: 1515 }, { token });
    const id = (await create.json()).investment.id;
    const res = await apiDelete(`/api/investments/${id}`, { token });
    expect(res.status).toBe(200);
  });

  test('non-owner gets 404 on update', async () => {
    const token = await getDemoToken();
    const res = await apiPut('/api/investments/99999', { symbol: 'TEST', name: 'Test', quantity: 1, buy_price: 100, current_price: 100 }, { token });
    expect(res.status).toBe(404);
  });

  test('rejects negative quantity', async () => {
    const token = await getDemoToken();
    const res = await apiPost('/api/investments', { symbol: 'BAD', name: 'Bad', quantity: -1, buy_price: 100, current_price: 100 }, { token });
    expect(res.status).toBe(400);
  });

});
