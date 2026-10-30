import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyReleaseApi } from './verify-release-api';

const origin = 'https://api.okyo.example';
test('a healthy service still fails release when it serves unsigned protected requests', async () => {
  const seen: string[] = [];
  const request = (async (url: string, init: RequestInit) => {
    seen.push(url); assert.equal(init.method, 'GET'); assert.equal(init.headers, undefined); assert.equal(init.body, undefined);
    return new Response(null, { status: url.endsWith('/ready') ? 503 : 200 });
  }) as typeof fetch;
  const failures = await verifyReleaseApi(origin, request);
  assert.equal(seen.length, 3); assert.equal(failures.length, 3);
  assert.ok(failures.some((message) => message.includes('503')));
  assert.ok(failures.some((message) => message.includes('unsigned requests')));
});
test('ready services must deny unsigned routes; unavailable endpoints cannot pass', async () => {
  assert.deepEqual(await verifyReleaseApi(origin, (async (url: string) => new Response(null, { status: url.endsWith('/ready') ? 200 : 401 })) as typeof fetch), []);
  assert.equal((await verifyReleaseApi(origin, (async () => { throw new Error('private provider detail'); }) as typeof fetch)).length, 3);
  assert.equal((await verifyReleaseApi('http://localhost:8080', (async () => { assert.fail('unsafe address requested'); }) as typeof fetch)).length, 1);
});
