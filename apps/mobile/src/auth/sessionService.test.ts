import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAuthSessionService,
  type AuthSession,
  type SupabaseAuthBoundary,
} from './sessionService';

const futureSeconds = 2_000_000_000;

function session(token: string, expiresAt = futureSeconds): AuthSession {
  return {
    access_token: token,
    expires_at: expiresAt,
    user: { is_anonymous: true },
  };
}

function boundary(overrides: Partial<SupabaseAuthBoundary> = {}): SupabaseAuthBoundary {
  return {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async signInAnonymously() {
      return { data: { session: session('anonymous-token') }, error: null };
    },
    async refreshSession() {
      return { data: { session: session('refreshed-token') }, error: null };
    },
    ...overrides,
  };
}

test('restores an existing anonymous session without signing in again', async () => {
  let signInCount = 0;
  const service = createAuthSessionService(boundary({
    async getSession() {
      return { data: { session: session('restored-token') }, error: null };
    },
    async signInAnonymously() {
      signInCount += 1;
      return { data: { session: session('new-token') }, error: null };
    },
  }));

  assert.deepEqual(await service.initialize(), { status: 'authenticated', anonymous: true });
  assert.equal(signInCount, 0);
});

test('signs in anonymously when no persisted session exists', async () => {
  let signInCount = 0;
  const service = createAuthSessionService(boundary({
    async signInAnonymously() {
      signInCount += 1;
      return { data: { session: session('new-token') }, error: null };
    },
  }));

  assert.equal((await service.initialize()).status, 'authenticated');
  assert.equal(signInCount, 1);
});

test('concurrent initialization performs only one anonymous sign-in', async () => {
  let releaseRestore!: () => void;
  const restoreGate = new Promise<void>((resolve) => { releaseRestore = resolve; });
  let signInCount = 0;
  const service = createAuthSessionService(boundary({
    async getSession() {
      await restoreGate;
      return { data: { session: null }, error: null };
    },
    async signInAnonymously() {
      signInCount += 1;
      return { data: { session: session('new-token') }, error: null };
    },
  }));

  const first = service.initialize();
  const second = service.initialize();
  releaseRestore();
  await Promise.all([first, second]);
  assert.equal(signInCount, 1);
});

test('returns the latest current access token at request time', async () => {
  let current = session('initial-token');
  const service = createAuthSessionService(boundary({
    async getSession() {
      return { data: { session: current }, error: null };
    },
  }));

  await service.initialize();
  current = session('latest-token');
  assert.equal(await service.getAccessToken(), 'latest-token');
});

test('refreshes an expired session before returning its token', async () => {
  let refreshCount = 0;
  let current = session('expired-token', 900);
  const service = createAuthSessionService(boundary({
    async getSession() {
      return { data: { session: current }, error: null };
    },
    async refreshSession() {
      refreshCount += 1;
      current = session('fresh-token');
      return { data: { session: current }, error: null };
    },
  }), { now: () => 1_000_000 });

  await service.initialize();
  assert.equal(refreshCount, 1);
  assert.equal(await service.getAccessToken(), 'fresh-token');
});

test('does not include provider errors or token-like values in logs', async () => {
  const logged: string[] = [];
  const secret = 'secret-refresh-and-jwt-value';
  const service = createAuthSessionService(boundary({
    async signInAnonymously() {
      return { data: { session: null }, error: { message: `network ${secret}` } };
    },
  }), { logger: { warn: (message) => logged.push(message) } });

  assert.equal((await service.initialize()).status, 'error');
  assert.equal(logged.length, 1);
  assert.equal(logged.join(' ').includes(secret), false);
});
