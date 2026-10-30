import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleSsoFlight } from './googleSsoFlight';

type Deps = Parameters<GoogleSsoFlight['start']>[0];
function setup(overrides: Partial<Deps> = {}) {
  const calls = { oauth: 0, active: [] as string[] };
  const deps: Deps = {
    isLoaded: true,
    isSignedIn: false,
    startSSOFlow: async () => {
      calls.oauth += 1;
      return {
        createdSessionId: 'verified-session',
        authSessionResult: { type: 'success' },
        signIn: { createdSessionId: 'verified-session' },
        setActive: async ({ session: id }) => { calls.active.push(id); },
      };
    },
    ...overrides,
  };
  return { calls, deps };
}

test('one Google tap starts one official SSO request and activates its returned session', async () => {
  const flight = new GoogleSsoFlight();
  let setActiveRan = false;
  const { calls, deps } = setup({ onSsoSetActive: () => { setActiveRan = true; } });
  const outcome = await flight.start(deps);
  assert.deepEqual(outcome, {
    kind: 'awaiting_session', flow: 'sign_in',
    browserLaunchAttempted: true, createdSessionIdReturned: true,
  });
  assert.equal(calls.oauth, 1);
  assert.deepEqual(calls.active, ['verified-session']);
  assert.equal(setActiveRan, true);
  assert.equal(flight.getSnapshot().phase, 'awaiting_session');
  assert.equal(flight.confirmSignedIn(), true);
  assert.equal(flight.confirmSignedIn(), false);
});

test('rapid taps and a remounted account screen cannot start another request', async () => {
  const flight = new GoogleSsoFlight();
  let release!: (value: Awaited<ReturnType<Deps['startSSOFlow']>>) => void;
  const pending = new Promise<Awaited<ReturnType<Deps['startSSOFlow']>>>((resolve) => { release = resolve; });
  const { calls, deps } = setup({ startSSOFlow: async () => { calls.oauth += 1; return pending; } });
  const first = flight.start(deps);
  assert.equal(flight.getSnapshot().phase, 'requesting');
  let remountState = flight.getSnapshot();
  const unsubscribe = flight.subscribe(() => { remountState = flight.getSnapshot(); });
  assert.deepEqual(await flight.start(deps), { kind: 'already_running' });
  release({
    createdSessionId: 'verified-session', authSessionResult: { type: 'success' },
    setActive: async () => {}, signIn: { createdSessionId: 'verified-session' },
  });
  await first;
  assert.equal(calls.oauth, 1);
  assert.equal(remountState.phase, 'awaiting_session');
  assert.deepEqual(await flight.start(deps), { kind: 'already_running' });
  assert.equal(calls.oauth, 1);
  unsubscribe();
});

test('a signed-in account does not launch Google or navigate as a new sign-in', async () => {
  const flight = new GoogleSsoFlight();
  const { calls, deps } = setup({ isSignedIn: true });
  assert.deepEqual(await flight.start(deps), { kind: 'already_signed_in' });
  assert.equal(calls.oauth, 0);
  assert.equal(flight.confirmSignedIn(), false);
});

test('session_exists does not recover an old session as a Google success', async () => {
  const flight = new GoogleSsoFlight();
  const { calls, deps } = setup({ startSSOFlow: async () => {
    calls.oauth += 1;
    throw { status: 400, errors: [{ code: 'session_exists' }] };
  } });
  const outcome = await flight.start(deps);
  assert.equal(outcome.kind, 'failed');
  assert.equal(calls.oauth, 1);
  assert.equal(flight.confirmSignedIn(), false);
});

test('cancelled and incomplete OAuth remain safe and leave the button usable', async () => {
  for (const type of ['cancel', 'success']) {
    const flight = new GoogleSsoFlight();
    const { deps } = setup({
      startSSOFlow: async () => ({ createdSessionId: null, authSessionResult: { type } }),
    });
    const outcome = await flight.start(deps);
    assert.equal(outcome.kind, type === 'cancel' ? 'cancelled' : 'incomplete');
    assert.equal(flight.getSnapshot().phase, 'idle');
    assert.match(flight.getSnapshot().error ?? '', /Google sign-in/);
  }
});

test('failed OAuth returns only sanitized HTTP status and code', async () => {
  const flight = new GoogleSsoFlight();
  const { deps } = setup({ startSSOFlow: async () => {
    throw { status: 400, errors: [{ code: 'oauth_failed', message: 'private provider detail' }] };
  } });
  const outcome = await flight.start(deps);
  assert.equal(outcome.kind, 'failed');
  if (outcome.kind !== 'failed') return;
  assert.equal(outcome.httpStatus, 400);
  assert.equal(outcome.code, 'oauth_failed');
  assert.doesNotMatch(JSON.stringify(outcome), /private provider detail/);
  assert.equal(flight.getSnapshot().phase, 'idle');
});

test('an activation failure is reported safely after setActive was attempted', async () => {
  const flight = new GoogleSsoFlight();
  let setActiveRan = false;
  const { deps } = setup({
    onSsoSetActive: () => { setActiveRan = true; },
    startSSOFlow: async () => ({
      createdSessionId: 'verified-session', authSessionResult: { type: 'success' },
      setActive: async () => { throw { status: 400, errors: [{ code: 'activation_failed' }] }; },
    }),
  });
  const outcome = await flight.start(deps);
  assert.equal(setActiveRan, true);
  assert.equal(outcome.kind, 'failed');
  assert.equal(flight.getSnapshot().phase, 'idle');
});

test('new-user sign-up is activated and waits for Clerk auth confirmation', async () => {
  const flight = new GoogleSsoFlight();
  let active = false;
  const { deps } = setup({ startSSOFlow: async () => ({
    createdSessionId: 'signup-session', authSessionResult: { type: 'success' },
    signUp: { createdSessionId: 'signup-session' },
    setActive: async () => { active = true; },
  }) });
  const outcome = await flight.start(deps);
  assert.equal(active, true);
  assert.equal(outcome.kind, 'awaiting_session');
  if (outcome.kind === 'awaiting_session') assert.equal(outcome.flow, 'sign_up');
  assert.equal(flight.getSnapshot().phase, 'awaiting_session');
  assert.equal(flight.failIfUnconfirmed(), true);
  assert.match(flight.getSnapshot().error ?? '', /could not confirm/);
});
