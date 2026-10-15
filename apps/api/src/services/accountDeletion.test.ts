import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AccountDeletionError,
  createAccountDeletionService,
  isClerkSecretValid,
  isProductionDeployment,
  readBearerToken,
} from './accountDeletion.js';

test('readBearerToken accepts only a conventional bearer token', () => {
  assert.equal(readBearerToken('Bearer token.value_123'), 'token.value_123');
  assert.equal(readBearerToken('token.value_123'), null);
  assert.equal(readBearerToken('Bearer '), null);
});

test('missing Development Clerk deletion configuration fails closed before any deletion request', async () => {
  let providerCalls = 0;
  const service = createAccountDeletionService({
    config: { authorizedParties: [], clerkSecretKey: null, revenueCatProjectId: null, revenueCatSecretKey: null },
    fetchImpl: async () => { providerCalls++; return new Response('{}'); },
    verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
  });
  await assert.rejects(service('Bearer test-token'), (error: unknown) =>
    error instanceof AccountDeletionError && error.code === 'account_deletion_unavailable' && error.status === 503);
  assert.equal(providerCalls, 0);
});

test('Railway Development accepts the configured Development Clerk server key even when NODE_ENV is production', async () => {
  const saved = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.RAILWAY_ENVIRONMENT = 'development';
  try {
    assert.equal(isProductionDeployment(), false);
    const service = createAccountDeletionService({
      config: { authorizedParties: [], clerkSecretKey: 'sk_test_fixture', revenueCatProjectId: null, revenueCatSecretKey: null },
      fetchImpl: async (_url, init) => new Response(
        JSON.stringify(init?.method === 'DELETE' ? {} : { external_accounts: [] }),
        { status: 200 },
      ),
      verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
      clearServerData: async () => undefined,
    });

    await service('Bearer development-session-token');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('a Railway Production deployment still rejects a Development Clerk server key', () => {
  const saved = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.RAILWAY_ENVIRONMENT = 'production';
  try {
    assert.equal(isProductionDeployment(), true);
    assert.equal(isClerkSecretValid('sk_test_fixture'), false);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('Development refuses an unclassified Clerk server credential', () => {
  const saved = { ...process.env };
  process.env.RAILWAY_ENVIRONMENT = 'development';
  try {
    assert.equal(isClerkSecretValid('invalid-server-credential'), false);
    assert.equal(isClerkSecretValid('sk_live_fixture'), false);
    assert.equal(isClerkSecretValid('sk_test_fixture'), true);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('an already-deleted Clerk user and missing user-owned records are safe to retry', async () => {
  const deletedUsers: string[] = [];
  let cleanups = 0;
  const service = createAccountDeletionService({
    config: { authorizedParties: [], clerkSecretKey: 'sk_test_fixture', revenueCatProjectId: null, revenueCatSecretKey: null },
    fetchImpl: async (url, init) => {
      if (init?.method === 'DELETE') deletedUsers.push(String(url));
      return new Response('{}', { status: 404 });
    },
    verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
    clearServerData: async () => { cleanups++; },
  });
  await service('Bearer test-token');
  await service('Bearer test-token');
  assert.equal(cleanups, 2);
  assert.equal(deletedUsers.length, 2);
  assert.ok(deletedUsers.every((url) => url.endsWith('/user_123ABC')));
});

test('configured durable user data is included in deletion in Development as well as Production', () => {
  const source = readFileSync(new URL('./accountDeletion.ts', import.meta.url), 'utf8');
  assert.match(source, /process\.env\.NODE_ENV === 'production' \|\| databaseConfigured\(\)/);
});

test('account deletion verifies the session and deletes the matching RevenueCat customer before Clerk', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const service = createAccountDeletionService({
    config: {
      authorizedParties: ['okyo://'],
      clerkSecretKey: 'sk_test_clerk',
      revenueCatProjectId: 'proj_okyo',
      revenueCatSecretKey: 'rc_v2_secret',
    },
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify(init?.method === 'DELETE' ? {} : {external_accounts: []}), { status: 200 });
    },
    verifySessionToken: async (token) => {
      assert.equal(token, 'signed-session-token');
      return { sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>;
    },
  });

  const result = await service('Bearer signed-session-token');

  assert.deepEqual(result, { revenueCatCustomerDeletionRequested: true });
  assert.equal(requests.length, 3);
  assert.match(requests[1]!.url, /revenuecat\.com\/v2\/projects\/proj_okyo\/customers\/user_123ABC$/);
  assert.equal(requests[1]!.init?.method, 'DELETE');
  assert.equal((requests[1]!.init?.headers as Record<string, string>).Authorization, 'Bearer rc_v2_secret');
  assert.match(requests[2]!.url, /api\.clerk\.com\/v1\/users\/user_123ABC$/);
  assert.equal((requests[2]!.init?.headers as Record<string, string>).Authorization, 'Bearer sk_test_clerk');
});

test('a RevenueCat failure preserves the Clerk account for a retry', async () => {
  let fetchCalls = 0;
  const service = createAccountDeletionService({
    config: {
      authorizedParties: [],
      clerkSecretKey: 'sk_test_clerk',
      revenueCatProjectId: 'proj_okyo',
      revenueCatSecretKey: 'rc_v2_secret',
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{}', { status: 503 });
    },
    verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
  });

  await assert.rejects(
    service('Bearer signed-session-token'),
    (error: unknown) => error instanceof AccountDeletionError && error.code === 'account_deletion_failed',
  );
  assert.equal(fetchCalls, 1);
});

test('server cache and persistent cleanup completes before the Clerk identity is deleted', async () => {
  const order: string[] = [];
  const service = createAccountDeletionService({
    config: { authorizedParties: [], clerkSecretKey: 'sk_test_clerk', revenueCatProjectId: null, revenueCatSecretKey: null },
    fetchImpl: async (_url, init) => {
      order.push(init?.method === 'DELETE' ? 'clerk-delete' : 'clerk-read');
      return new Response(JSON.stringify(init?.method === 'DELETE' ? {} : { external_accounts: [] }), { status: 200 });
    },
    verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
    clearServerData: async (userId) => { assert.equal(userId, 'user_123ABC'); order.push('clear-data'); },
  });
  await service('Bearer signed-session-token');
  assert.deepEqual(order, ['clerk-read', 'clear-data', 'clerk-delete']);
});

test('server cleanup failure preserves the Clerk identity for a safe retry', async () => {
  const calls: string[] = [];
  const service = createAccountDeletionService({
    config: { authorizedParties: [], clerkSecretKey: 'sk_test_clerk', revenueCatProjectId: null, revenueCatSecretKey: null },
    fetchImpl: async (_url, init) => {
      calls.push(init?.method === 'DELETE' ? 'clerk-delete' : 'session-verify');
      return new Response(JSON.stringify(init?.method === 'DELETE' ? {} : { external_accounts: [] }), { status: 200 });
    },
    verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
    clearServerData: async () => { throw new Error('simulated cleanup failure'); },
  });
  await assert.rejects(
    service('Bearer signed-session-token'),
    (error: unknown) => error instanceof AccountDeletionError && error.code === 'account_deletion_failed',
  );
  assert.deepEqual(calls, ['session-verify']);
});

test('production account deletion fails closed until RevenueCat customer deletion is configured', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let providerCalls = 0;
  try {
    const service = createAccountDeletionService({
      config: { authorizedParties: ['https://okyo.example.test'], clerkSecretKey: 'sk_live_fixture', revenueCatProjectId: null, revenueCatSecretKey: null },
      fetchImpl: async () => { providerCalls++; return new Response('{}'); },
      verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
    });
    await assert.rejects(service('Bearer valid-session'), (error: unknown) => error instanceof AccountDeletionError && error.status === 503);
    assert.equal(providerCalls, 0);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
