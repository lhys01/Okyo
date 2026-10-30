import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activateClerkAppleSession,
  activateClerkSsoSession,
  getCreatedSessionId,
  getClerkSsoFlow,
  isClerkSessionReady,
} from './clerkSsoCompletion';

test('successful browser return activates a Google session', async () => {
  const calls: Array<{ session: string }> = [];
  const result = await activateClerkSsoSession({
    authSessionResult: { type: 'success' },
    createdSessionId: 'created-session',
    setActive: async (params) => { calls.push(params); },
    signIn: { createdSessionId: 'created-session' },
  });

  assert.deepEqual(result, { kind: 'activated', flow: 'sign_in', sessionId: 'created-session' });
  assert.deepEqual(calls, [{ session: 'created-session' }]);
});

test('existing-user sign-in is classified separately from new-user sign-up', () => {
  assert.equal(getClerkSsoFlow({ createdSessionId: 'sign-in', signIn: { createdSessionId: 'sign-in' } }), 'sign_in');
  assert.equal(getClerkSsoFlow({ createdSessionId: 'sign-up', signUp: { createdSessionId: 'sign-up' } }), 'sign_up');
});

test('native Apple sign-in activates an existing-user session', async () => {
  const calls: Array<{ session: string }> = [];
  const flow = await activateClerkAppleSession({
    createdSessionId: 'apple-sign-in-session',
    signIn: { createdSessionId: 'apple-sign-in-session' },
    setActive: async (params) => { calls.push(params); },
  });

  assert.equal(flow, 'sign_in');
  assert.deepEqual(calls, [{ session: 'apple-sign-in-session' }]);
});

test('native Apple sign-up activates its returned session', async () => {
  const calls: Array<{ session: string }> = [];
  const flow = await activateClerkAppleSession({
    createdSessionId: 'apple-sign-up-session',
    signUp: { createdSessionId: 'apple-sign-up-session' },
    setActive: async (params) => { calls.push(params); },
  });

  assert.equal(flow, 'sign_up');
  assert.deepEqual(calls, [{ session: 'apple-sign-up-session' }]);
});

test('native Apple flow never activates an absent or unverified session', async () => {
  let activated = false;
  assert.equal(await activateClerkAppleSession({
    createdSessionId: null,
    setActive: async () => { activated = true; },
  }), null);
  assert.equal(await activateClerkAppleSession({ createdSessionId: 'session-without-setActive' }), null);
  assert.equal(activated, false);
});

test('native Apple accepts the session resource returned by Clerk when the top-level field is absent', async () => {
  const calls: Array<{ session: string }> = [];
  const flow = await activateClerkAppleSession({
    signUp: { createdSessionId: 'apple-sign-up-session', status: 'complete' },
    setActive: async (params) => { calls.push(params); },
  });

  assert.equal(getCreatedSessionId({ signUp: { createdSessionId: 'apple-sign-up-session' } }), 'apple-sign-up-session');
  assert.equal(flow, 'sign_up');
  assert.deepEqual(calls, [{ session: 'apple-sign-up-session' }]);
});

test('cancelled OAuth returns a user-safe cancelled result', async () => {
  assert.deepEqual(
    await activateClerkSsoSession({ authSessionResult: { type: 'cancel' }, createdSessionId: null }),
    { kind: 'cancelled' },
  );
});

test('successful browser return without a session is incomplete', async () => {
  assert.deepEqual(
    await activateClerkSsoSession({ authSessionResult: { type: 'success' }, createdSessionId: null }),
    { kind: 'incomplete' },
  );
});

test('setActive failures remain failures for the caller to present safely', async () => {
  await assert.rejects(
    activateClerkSsoSession({
      createdSessionId: 'created-session',
      setActive: async () => { throw new Error('activation failed'); },
    }),
    /activation failed/,
  );
});

test('navigation waits until Clerk is loaded and signed in', () => {
  assert.equal(isClerkSessionReady({ isLoaded: false, isSignedIn: false }), false);
  assert.equal(isClerkSessionReady({ isLoaded: true, isSignedIn: false }), false);
  assert.equal(isClerkSessionReady({ isLoaded: true, isSignedIn: true }), true);
});
