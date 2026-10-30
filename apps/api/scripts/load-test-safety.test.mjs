import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalLoadTestTarget, assertMockServer } from './load-test-safety.mjs';

test('load harness refuses Production, Railway, external, and ambiguous hosts', () => {
  for (const target of [
    'https://okyo.up.railway.app', 'https://api-development.up.railway.app',
    'http://localhost:8081', 'http://127.0.0.2:8081',
    'http://127.0.0.1:8081/v1/scans', 'http://127.0.0.1:8081@evil.example',
  ]) assert.throws(() => assertLocalLoadTestTarget(target));
  assert.equal(assertLocalLoadTestTarget('http://127.0.0.1:8081'), 'http://127.0.0.1:8081');
});

test('load harness requires explicit synthetic-server handshake', async () => {
  await assert.rejects(() => assertMockServer('http://127.0.0.1:8081', async () => ({
    ok: true, json: async () => ({ ok: true, data: { mode: 'production' } }),
  })));
  const result = await assertMockServer('http://127.0.0.1:8081', async () => ({
    ok: true, json: async () => ({ ok: true, data: { mode: 'local-mock', provider: 'synthetic', externalServices: false } }),
  }));
  assert.equal(result.externalServices, false);
});
