import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
const { app } = await import('./server.js');

async function request(path: string) {
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    return await new Promise<{ status: number; body: unknown; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const request = http.get({ hostname: '127.0.0.1', port: address.port, path }, (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { raw += chunk; });
        response.on('end', () => resolve({
          status: response.statusCode ?? 0,
          body: JSON.parse(raw),
          headers: response.headers,
        }));
      });
      request.on('error', reject);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('/ready fails closed without persistence, is safe, and never calls a provider', async () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    process.env.NODE_ENV = 'production';
    process.env.AI_ENABLED = 'false';
    process.env.PRODUCTION_AI_ENABLED = 'false';
    delete process.env.DATABASE_URL;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error('readiness must not call a provider');
    };

    const [health, live, ready] = await Promise.all([
      request('/health'),
      request('/live'),
      request('/ready'),
    ]);

    assert.equal(health.status, 200);
    assert.equal(live.status, 200);
    assert.equal(ready.status, 503);
    const error = (ready.body as { ok: false; error: { code: string; details: Record<string, unknown> } }).error;
    assert.equal(error.code, 'not_ready');
    assert.equal(error.details.status, 'not_ready');
    assert.equal(error.details.service, 'okyo-api');
    assert.equal(error.details.persistentStateConfigured, false);
    assert.equal(error.details.databaseConnectivity, 'unavailable');
    assert.equal(error.details.aiEnabled, false);
    assert.equal(error.details.productionAiEnabled, false);
    assert.equal(typeof error.details.requestId, 'string');
    assert.equal(typeof ready.headers['x-okyo-request-id'], 'string');
    assert.doesNotMatch(JSON.stringify(ready.body), /DATABASE_URL|postgres(?:ql)?:\/\//i);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});
