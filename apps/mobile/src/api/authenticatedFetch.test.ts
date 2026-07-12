import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthUnavailableError, createAuthenticatedFetch } from './authenticatedFetch';

test('adds the current Bearer token to protected API requests', async () => {
  const captured = { headers: new Headers() };
  const request = createAuthenticatedFetch({
    getAccessToken: async () => 'current-token',
    fetchImpl: async (_input, init) => {
      captured.headers = new Headers(init?.headers);
      return new Response(null, { status: 204 });
    },
  });

  await request('https://api.okyo.test/v1/scans', {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  assert.equal(captured.headers.get('Authorization'), 'Bearer current-token');
  assert.equal(captured.headers.get('Content-Type'), 'application/json');
});

test('/health remains unauthenticated', async () => {
  let tokenReadCount = 0;
  const captured = { headers: new Headers() };
  const request = createAuthenticatedFetch({
    getAccessToken: async () => {
      tokenReadCount += 1;
      return 'unused-token';
    },
    fetchImpl: async (_input, init) => {
      captured.headers = new Headers(init?.headers);
      return new Response(null, { status: 204 });
    },
  });

  await request('https://api.okyo.test/health');
  assert.equal(tokenReadCount, 0);
  assert.equal(captured.headers.has('Authorization'), false);
});

test('protected requests fail closed before auth initialization succeeds', async () => {
  let fetchCount = 0;
  const request = createAuthenticatedFetch({
    getAccessToken: async () => null,
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(null, { status: 204 });
    },
  });

  await assert.rejects(
    request('https://api.okyo.test/v1/scans'),
    AuthUnavailableError,
  );
  assert.equal(fetchCount, 0);
});
