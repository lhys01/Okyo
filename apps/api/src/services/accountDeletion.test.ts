import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AccountDeletionError,
  createAccountDeletionService,
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

  assert.deepEqual(result, { revenueCatCustomerDeletionRequested: true, appleAuthorizationRevocation: 'not_applicable' });
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

test('Apple-linked account deletion completes when Development lacks Apple revocation credentials and reports manual action', async () => {
  const names = ['APPLE_SIGN_IN_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_SIGN_IN_KEY_ID', 'APPLE_SIGN_IN_PRIVATE_KEY'] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];

  const requests: Array<{ url: string; method: string }> = [];
  let serverCleanup = 0;
  try {
    const service = createAccountDeletionService({
      config: { authorizedParties: [], clerkSecretKey: 'sk_test_clerk', revenueCatProjectId: null, revenueCatSecretKey: null },
      fetchImpl: async (url, init) => {
        const method = init?.method ?? 'GET';
        requests.push({ url: String(url), method });
        if (method === 'DELETE') return new Response('{}', { status: 200 });
        return new Response(JSON.stringify({ external_accounts: [{ provider: 'oauth_apple' }] }), { status: 200 });
      },
      verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
      clearServerData: async () => { serverCleanup++; },
    });

    const result = await service('Bearer signed-session-token');
    assert.deepEqual(result, { revenueCatCustomerDeletionRequested: false, appleAuthorizationRevocation: 'manual_action_required' });
    assert.equal(serverCleanup, 1);
    assert.deepEqual(requests.map(({ method }) => method), ['GET', 'DELETE'], 'missing Apple credentials must not block server cleanup or Clerk deletion');
    assert.ok(requests[1]!.url.endsWith('/users/user_123ABC'));
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('a partial server cleanup can be retried before Clerk deletion, and a completed deletion is idempotent', async () => {
  const order: string[] = [];
  let cleanupAttempts = 0;
  let userExists = true;
  const service = createAccountDeletionService({
    config: { authorizedParties: [], clerkSecretKey: 'sk_test_clerk', revenueCatProjectId: null, revenueCatSecretKey: null },
    fetchImpl: async (_url, init) => {
      if (init?.method === 'DELETE') {
        order.push('clerk-delete');
        userExists = false;
        return new Response('{}', { status: 200 });
      }
      order.push('clerk-lookup');
      return userExists
        ? new Response(JSON.stringify({ external_accounts: [] }), { status: 200 })
        : new Response('{}', { status: 404 });
    },
    verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
    clearServerData: async () => {
      cleanupAttempts++;
      order.push(`server-cleanup-${cleanupAttempts}`);
      if (cleanupAttempts === 1) throw new Error('one cleanup layer failed after another completed');
    },
  });

  await assert.rejects(service('Bearer signed-session-token'), (error: unknown) =>
    error instanceof AccountDeletionError && error.code === 'account_deletion_failed' && error.failureStep === 'server_data_cleanup');
  assert.deepEqual(order, ['clerk-lookup', 'server-cleanup-1']);

  const retry = await service('Bearer signed-session-token');
  assert.deepEqual(retry, { revenueCatCustomerDeletionRequested: false, appleAuthorizationRevocation: 'not_applicable' });
  assert.deepEqual(order, ['clerk-lookup', 'server-cleanup-1', 'clerk-lookup', 'server-cleanup-2', 'clerk-delete']);

  const repeated = await service('Bearer signed-session-token');
  assert.deepEqual(repeated, { revenueCatCustomerDeletionRequested: false, appleAuthorizationRevocation: 'unknown' });
  assert.equal(cleanupAttempts, 3);
  assert.equal(order.filter((step) => step === 'clerk-delete').length, 2, 'Clerk DELETE 404 is accepted after a prior successful deletion');
});

test('production account deletion supports a subscription-free launch without RevenueCat', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const methods: string[] = [];
  try {
    const service = createAccountDeletionService({
      config: { authorizedParties: ['https://okyo.example.test'], clerkSecretKey: 'sk_live_fixture', revenueCatProjectId: null, revenueCatSecretKey: null },
      fetchImpl: async (_url, init) => {
        methods.push(init?.method ?? 'GET');
        return new Response(JSON.stringify(init?.method === 'DELETE' ? {} : { external_accounts: [] }), { status: 200 });
      },
      verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
      clearServerData: async () => undefined,
    });
    const result = await service('Bearer valid-session');
    assert.deepEqual(result, { revenueCatCustomerDeletionRequested: false, appleAuthorizationRevocation: 'not_applicable' });
    assert.deepEqual(methods, ['GET', 'DELETE']);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('partial RevenueCat configuration fails closed before deleting either account', async () => {
  let providerCalls = 0;
  const service = createAccountDeletionService({
    config: { authorizedParties: [], clerkSecretKey: 'sk_test_clerk', revenueCatProjectId: 'proj_okyo', revenueCatSecretKey: null },
    fetchImpl: async () => { providerCalls++; return new Response('{}'); },
    verifySessionToken: async () => ({ sub: 'user_123ABC' } as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>),
  });
  await assert.rejects(service('Bearer valid-session'), (error: unknown) =>
    error instanceof AccountDeletionError && error.code === 'account_deletion_unavailable' && error.status === 503);
  assert.equal(providerCalls, 0);
});
