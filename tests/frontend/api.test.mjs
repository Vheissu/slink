import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiService, ApiError } from '../../resources/js/src/services/api.ts';

function apiFixture(response) {
  let interceptor;
  let token = 'first-token';
  const calls = [];
  const config = { withBaseUrl() { return this; }, withInterceptor(value) { interceptor = value; return this; } };
  const api = new ApiService({
    configure(callback) { callback(config); },
    async fetch(path, options) { calls.push({ path, options }); return response(); },
  }, { getToken: () => token });
  return { api, calls, request: (request) => interceptor.request(request), setToken: (value) => { token = value; } };
}

test('API headers always use the current token and remove cleared credentials', () => {
  const fixture = apiFixture();
  const request = new Request('https://example.com/api/v1/links');
  assert.equal(fixture.request(request).headers.get('Authorization'), 'Bearer first-token');
  fixture.setToken('second-token');
  assert.equal(fixture.request(request).headers.get('Authorization'), 'Bearer second-token');
  fixture.setToken(null);
  assert.equal(fixture.request(request).headers.get('Authorization'), null);
  assert.equal(request.headers.get('Accept'), 'application/json');
});

test('API requests preserve false filters and serialize writes as JSON', async () => {
  const { api, calls } = apiFixture(() => Response.json({}));
  await api.getAnalytics({ query: 'title:"a & b"', include_bots: false });
  const params = new URL(calls[0].path, 'https://example.com/').searchParams;
  assert.equal(params.get('include_bots'), 'false');
  assert.equal(params.get('query'), 'title:"a & b"');
  await api.updateLink('link-id', { title: 'New title' });
  assert.equal(calls[1].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].options.body), { title: 'New title' });
});

test('API errors surface validation messages and never render HTML error pages', async () => {
  const validation = apiFixture(() => Response.json({ message: 'Validation failed', errors: { url: ['URL is invalid.'] } }, { status: 422 }));
  await assert.rejects(validation.api.listLinks(), (error) => error instanceof ApiError && error.status === 422 && error.message === 'URL is invalid.');
  const html = apiFixture(() => new Response('<html>Stack trace</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(html.api.listLinks(), /Request failed \(500\)/);
  const malformed = apiFixture(() => Response.json({ message: { not: 'a string' } }, { status: 401 }));
  await assert.rejects(malformed.api.listLinks(), /missing or invalid/);
});
