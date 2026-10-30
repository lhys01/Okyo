import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
const { app } = await import('./server.js');

async function request(method: string, path: string, authorization?: string) {
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    return await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: address.port,
        method,
        path,
        headers: authorization ? { Authorization: authorization } : undefined,
      }, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }));
      });
      req.on('error', reject);
      req.end();
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('production never returns mock scan/recipe fixtures and AI stays unavailable', async () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    clerkSecret: process.env.CLERK_SECRET_KEY,
    clerkParties: process.env.CLERK_AUTHORIZED_PARTIES,
  };
  process.env.NODE_ENV = 'production';
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.CLERK_AUTHORIZED_PARTIES;
  try {
    const scan = await request('GET', '/v1/scans/001');
    const recipe = await request('GET', '/v1/recipes/recipe-spicy-vodka-rigatoni-restaurant-copy');
    const aiScan = await request('POST', '/v1/scans');
    const save = await request('POST', '/v1/recipes/recipe-spicy-vodka-rigatoni-restaurant-copy/save');
    const library = await request('GET', '/v1/library');
    const challenge = await request('POST', '/v1/challenges');
    const rankings = await request('GET', '/v1/rankings/weekly');
    const restaurantPacks = await request('GET', '/v1/restaurant-packs');
    const ready = await request('GET', '/ready');
    assert.equal(scan.status, 404);
    assert.equal(recipe.status, 404);
    assert.equal(aiScan.status, 401);
    for (const path of ['/v1/scans/analyze', '/v1/scans/analyze/test/recipe', '/v1/recipes/test/coaching', '/v1/recipes/test/ask', '/v1/recipes/test/correct']) {
      assert.equal((await request('POST', path)).status, 401, path);
    }
    assert.equal((await request('GET', '/v1/account/capabilities')).status, 401);
    assert.equal(save.status, 404);
    assert.equal(library.status, 401, 'a protected library route must never become a production mock endpoint');
    assert.equal(challenge.status, 404);
    assert.equal(rankings.status, 404, 'production never serves synthetic leaderboard entries as user activity');
    assert.equal(restaurantPacks.status, 200);
    const packs = (restaurantPacks.body as { data: { packs: Array<{ provenance: string; pricesAreEstimates: boolean }> } }).data.packs;
    assert.ok(packs.length > 0);
    assert.ok(packs.every((pack) => pack.provenance === 'static_example' && pack.pricesAreEstimates));
    assert.equal(ready.status, 503);
    const readyJson = JSON.stringify(ready.body);
    assert.match(readyJson, /"sharedAiQuotaConfigured":false/);
    assert.match(readyJson, /"authorizedPartiesValid":false/);
    assert.match(readyJson, /"productionAiEnabled":false/);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.clerkSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previous.clerkSecret;
    if (previous.clerkParties === undefined) delete process.env.CLERK_AUTHORIZED_PARTIES;
    else process.env.CLERK_AUTHORIZED_PARTIES = previous.clerkParties;
  }
});
