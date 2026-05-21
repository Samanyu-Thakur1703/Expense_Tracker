/**
 * Test helper for authenticated API requests.
 * Uses the Express server directly (started before tests).
 * Relies on the demo user seeded by initDatabase().
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

/**
 * Authenticate as the demo user and return a JWT token.
 * Creates the user if needed via the demo seed.
 */
async function getDemoToken() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@fintrack.com', password: 'demo1234' })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.token;
}

/**
 * Authenticated API request helper.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g., '/api/expenses')
 * @param {object} [body] - Request body for POST/PUT
 * @param {object} [opts] - Additional options (token, headers, params)
 * @returns {Promise<Response>} Fetch Response
 */
async function api(method, path, body, opts = {}) {
  const token = opts.token || await getDemoToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (opts.params) {
    Object.entries(opts.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };
  const fetchOpts = { method, headers };
  if (body && method !== 'GET') {
    fetchOpts.body = JSON.stringify(body);
  }
  return fetch(url.toString(), fetchOpts);
}

/**
 * Convenience: GET request
 */
function apiGet(path, opts = {}) {
  return api('GET', path, null, opts);
}

/**
 * Convenience: POST request
 */
function apiPost(path, body, opts = {}) {
  return api('POST', path, body, opts);
}

/**
 * Convenience: PUT request
 */
function apiPut(path, body, opts = {}) {
  return api('PUT', path, body, opts);
}

/**
 * Convenience: DELETE request
 */
function apiDelete(path, opts = {}) {
  return api('DELETE', path, null, opts);
}

module.exports = { getDemoToken, api, apiGet, apiPost, apiPut, apiDelete, BASE_URL };
