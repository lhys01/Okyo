import assert from 'node:assert/strict';
import test from 'node:test';

import { decideAuthGate } from './authGateDecision';
import { ALLOWED_AUTH_STRATEGIES, AUTH_PROVIDER_OPTIONS, isAllowedAuthStrategy } from './authStrategies';
import { createAuthPromptPersistence, AUTH_PROMPT_SEEN_STORAGE_KEY } from './authPromptPersistence';
import { createClerkTokenCache } from './clerkTokenCache';

// ─── Apple + Google are the only social provider buttons ─────────────────────

test('exactly two sign-in strategies exist: Apple and Google', () => {
  assert.deepEqual([...ALLOWED_AUTH_STRATEGIES], ['oauth_apple', 'oauth_google']);
});

test('the social provider dispatcher rejects strategies outside Apple and Google', () => {
  for (const forbidden of ['email_code', 'email_link', 'password', 'phone_code', 'passkey', 'oauth_facebook', 'oauth_github', 'saml']) {
    assert.equal(isAllowedAuthStrategy(forbidden), false, `${forbidden} must never be allowed`);
  }
});

test('the social provider list renders one button per allowed OAuth strategy', () => {
  assert.equal(AUTH_PROVIDER_OPTIONS.length, ALLOWED_AUTH_STRATEGIES.length);
  for (const option of AUTH_PROVIDER_OPTIONS) {
    assert.ok(isAllowedAuthStrategy(option.strategy), `${option.strategy} rendered but not allowed`);
  }
});

test('Apple is offered first, as App Store guideline 4.8 requires', () => {
  assert.equal(AUTH_PROVIDER_OPTIONS[0]?.strategy, 'oauth_apple');
});

test('email and password use the dedicated Clerk flow instead of the OAuth allowlist', () => {
  assert.equal(isAllowedAuthStrategy('password'), false);
  assert.equal(isAllowedAuthStrategy('oauth_google'), true);
  assert.equal(isAllowedAuthStrategy('oauth_apple'), true);
});

// ─── Gate behaviour ──────────────────────────────────────────────────────────

const BASE = { authLoaded: true, isSignedIn: false, onboardingCompleted: true, promptSeen: false, promptSeenLoaded: true };

test('auth never interrupts onboarding', () => {
  assert.equal(decideAuthGate({ ...BASE, onboardingCompleted: false }), 'continueToApp');
});

test('the sign-in screen shows once after onboarding, when not signed in', () => {
  assert.equal(decideAuthGate(BASE), 'showSignIn');
});

test('regression: never flash sign-in before Clerk has restored the session', () => {
  assert.equal(decideAuthGate({ ...BASE, authLoaded: false }), 'wait');
  assert.equal(decideAuthGate({ ...BASE, promptSeenLoaded: false }), 'wait');
});

test('an already-signed-in user is never prompted', () => {
  assert.equal(decideAuthGate({ ...BASE, isSignedIn: true }), 'continueToApp');
});

test('skipping is honoured — "Maybe later" is never re-prompted', () => {
  assert.equal(decideAuthGate({ ...BASE, promptSeen: true }), 'continueToApp');
});

test('a live session wins over a stale prompt flag', () => {
  assert.equal(decideAuthGate({ ...BASE, isSignedIn: true, promptSeen: false }), 'continueToApp');
});

// ─── Prompt persistence ──────────────────────────────────────────────────────

function createMemoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); },
    removeItem: async (key: string) => { data.delete(key); },
  };
}

test('the prompt flag uses its own key, isolated from onboarding and the tour', () => {
  assert.equal(AUTH_PROMPT_SEEN_STORAGE_KEY, 'okyo:auth-prompt-seen:v1');
  assert.notEqual(AUTH_PROMPT_SEEN_STORAGE_KEY, 'okyo:onboarding-completed:v1');
  assert.notEqual(AUTH_PROMPT_SEEN_STORAGE_KEY, 'okyo:app-feature-tour-completed:v1');
});

test('prompt flag round-trips and resets', async () => {
  const storage = createMemoryStorage();
  const persistence = createAuthPromptPersistence(storage);

  assert.equal(await persistence.readSeen(), false);
  await persistence.markSeen();
  assert.equal(await persistence.readSeen(), true);
  await persistence.reset();
  assert.equal(await persistence.readSeen(), false);
});

test('a storage failure re-prompts rather than silently skipping sign-in', async () => {
  const persistence = createAuthPromptPersistence({
    getItem: async () => { throw new Error('storage unavailable'); },
    setItem: async () => { throw new Error('storage unavailable'); },
    removeItem: async () => { throw new Error('storage unavailable'); },
  });

  assert.equal(await persistence.readSeen(), false, 'must fail toward showing the prompt');
  await persistence.markSeen(); // must not throw
});

// ─── Token cache (session tokens live in the keychain) ───────────────────────

test('tokens round-trip through the keychain store', async () => {
  const store = createMemoryStorage();
  const cache = createClerkTokenCache({
    deleteItemAsync: store.removeItem,
    getItemAsync: store.getItem,
    setItemAsync: store.setItem,
  });

  await cache.saveToken('session', 'synthetic-token-value');
  assert.equal(await cache.getToken('session'), 'synthetic-token-value');
  cache.clearToken?.('session');
});

test('a keychain read failure reads as signed out, never as a crash', async () => {
  const cache = createClerkTokenCache({
    deleteItemAsync: async () => { throw new Error('keychain locked'); },
    getItemAsync: async () => { throw new Error('keychain locked'); },
    setItemAsync: async () => { throw new Error('keychain locked'); },
  });

  assert.equal(await cache.getToken('session'), null);
  await cache.saveToken('session', 'x'); // must not throw
});

test('required production sessions cannot be skipped by an old prompt flag or onboarding state', () => {
  for (const onboardingCompleted of [true, false]) {
    for (const promptSeen of [true, false]) {
      assert.equal(decideAuthGate({ ...BASE, onboardingCompleted, promptSeen, requireSession: true }), 'showSignIn');
    }
  }
  assert.equal(decideAuthGate({ ...BASE, authLoaded: false, requireSession: true }), 'wait');
  assert.equal(decideAuthGate({ ...BASE, isSignedIn: true, requireSession: true }), 'continueToApp');
});
