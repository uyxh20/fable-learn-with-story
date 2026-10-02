import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

test('every generation route fails closed, even with credentials present', async () => {
  const env = { LLM_API_KEY: 'test-only', LLM_MODEL: 'test-only', IMAGE_API_KEY: 'test-only', IMAGE_MODEL: 'test-only', ASSETS: { fetch() { throw new Error('API must not reach assets'); } } };
  for (const path of ['/api', '/api/generations', '/api/generations/example', '/api/story', '/api/images', '/api/internal/tasks/generations/example']) {
    const response = await worker.fetch(new Request(`https://example.com${path}`, { method: 'POST', body: '{}' }), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'generation_unavailable');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('serves assets with browser security headers', async () => {
  const response = await worker.fetch(new Request('https://example.com/'), { ASSETS: { fetch: async () => new Response('storybook') } });
  assert.equal(await response.text(), 'storybook');
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self'/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('health reports disabled generation and static writes are refused', async () => {
  const health = await worker.fetch(new Request('https://example.com/healthz'), {});
  assert.equal((await health.json()).generation_enabled, false);
  assert.equal((await worker.fetch(new Request('https://example.com/', { method: 'POST' }), {})).status, 405);
});
