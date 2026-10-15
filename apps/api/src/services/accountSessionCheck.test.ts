import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';

import { createRequireAuthenticatedUser } from '../middleware/requireAuthenticatedUser.js';
import { accountSessionCheckHandler } from './accountSessionCheck.js';

test('repeated authenticated session checks ignore cache validators and return non-cacheable 200 responses', async () => {
  const saved = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.RAILWAY_ENVIRONMENT = 'development';
  process.env.CLERK_SECRET_KEY = 'sk_test_fixture';
  try {
    let verifiedCount = 0;
    const app = express();
    app.get('/v1/account/session', createRequireAuthenticatedUser(async () => {
      verifiedCount += 1;
      return { sub: 'user_fixture123' };
    }), accountSessionCheckHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    try {
      const first = await fetch(`http://127.0.0.1:${address.port}/v1/account/session`, {
        headers: { Authorization: 'Bearer development.session.token' },
      });
      const etag = first.headers.get('etag');
      assert.equal(first.status, 200);
      assert.equal(first.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
      assert.equal(first.headers.get('pragma'), 'no-cache');
      assert.equal((await first.json() as { data: { authenticated: boolean } }).data.authenticated, true);

      const second = await fetch(`http://127.0.0.1:${address.port}/v1/account/session`, {
        headers: {
          Authorization: 'Bearer development.session.token',
          ...(etag ? { 'If-None-Match': etag } : {}),
        },
      });
      assert.equal(second.status, 200);
      assert.equal(second.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
      assert.equal((await second.json() as { data: { authenticated: boolean } }).data.authenticated, true);
      assert.equal(verifiedCount, 2);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
