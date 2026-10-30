import assert from 'node:assert/strict';
import test from 'node:test';
import { AppleSignInFlight } from './appleSignInFlight';

const result = (setActive: (params: { session: string }) => Promise<unknown>) => ({
  createdSessionId: 'test-session',
  signIn: { createdSessionId: 'test-session', status: 'complete' },
  setActive,
});

function deps(overrides: Partial<Parameters<AppleSignInFlight['start']>[0]> = {}) {
  return {
    isLoaded: true,
    isSignedIn: false,
    isOtherAuthActive: () => false,
    startAppleAuthenticationFlow: async () => result(async () => undefined),
    ...overrides,
  };
}

test('Apple does not start while Clerk already has a signed-in session', async () => {
  const flight = new AppleSignInFlight();
  let starts = 0;
  const outcome = await flight.start(deps({
    isSignedIn: true,
    startAppleAuthenticationFlow: async () => { starts++; return result(async () => undefined); },
  }));
  assert.equal(outcome.kind, 'already_signed_in');
  assert.equal(starts, 0);
  assert.equal(flight.getSnapshot().phase, 'idle');
  assert.equal(flight.confirmSignedIn(), false);
});

test('Apple cannot start before Clerk loads or during another auth request', async () => {
  const flight = new AppleSignInFlight();
  let starts = 0;
  const startAppleAuthenticationFlow = async () => { starts++; return result(async () => undefined); };
  assert.equal((await flight.start(deps({ isLoaded: false, startAppleAuthenticationFlow }))).kind, 'not_ready');
  assert.equal((await flight.start(deps({ isOtherAuthActive: () => true, startAppleAuthenticationFlow }))).kind, 'other_auth_active');
  assert.equal(starts, 0);
});

test('duplicate taps and account-screen remount share one native request', async () => {
  const flight = new AppleSignInFlight();
  let release!: (value: ReturnType<typeof result>) => void;
  let starts = 0;
  const pending = new Promise<ReturnType<typeof result>>((resolve) => { release = resolve; });
  const first = flight.start(deps({ startAppleAuthenticationFlow: () => { starts++; return pending; } }));
  assert.equal((await flight.start(deps())).kind, 'already_running');
  release(result(async () => undefined));
  assert.equal((await first).kind, 'awaiting_session');
  assert.equal((await flight.start(deps())).kind, 'already_running');
  assert.equal(starts, 1);
});

test('session_exists does not count as a successful Apple sign-in', async () => {
  const flight = new AppleSignInFlight();
  const existing = await flight.start(deps({
    startAppleAuthenticationFlow: async () => { throw { status: 400, errors: [{ code: 'session_exists' }] }; },
  }));
  assert.deepEqual(existing, { kind: 'already_signed_in' });
  assert.equal(flight.getSnapshot().phase, 'idle');
  assert.equal(flight.confirmSignedIn(), false);
  assert.match(flight.getSnapshot().error ?? '', /already signed in/);
});

test('native cancellation is harmless and does not activate a session', async () => {
  const flight = new AppleSignInFlight();
  assert.equal((await flight.start(deps({ startAppleAuthenticationFlow: async () => ({}) }))).kind, 'cancelled');
  assert.equal(flight.getSnapshot().phase, 'idle');
  assert.match(flight.getSnapshot().error ?? '', /cancelled/);
  const thrown = new AppleSignInFlight();
  assert.equal((await thrown.start(deps({ startAppleAuthenticationFlow: async () => { throw { code: 'ERR_REQUEST_CANCELED' }; } }))).kind, 'cancelled');
});

test('valid Apple result activates once and navigation waits for confirmed Clerk state', async () => {
  const flight = new AppleSignInFlight();
  let activations = 0;
  const outcome = await flight.start(deps({ startAppleAuthenticationFlow: async () => result(async ({ session }) => {
    assert.equal(session, 'test-session');
    activations++;
  }) }));
  assert.equal(outcome.kind, 'awaiting_session');
  assert.equal(activations, 1);
  assert.equal(flight.getSnapshot().phase, 'awaiting_session');
  assert.equal(flight.confirmSignedIn(), true);
  assert.equal(flight.confirmSignedIn(), false);
});

test('missing session and failed activation never reach confirmed state', async () => {
  const missing = new AppleSignInFlight();
  const noSetActive = await missing.start(deps({ startAppleAuthenticationFlow: async () => ({ createdSessionId: 'test-session' }) }));
  assert.equal(noSetActive.kind, 'incomplete');
  assert.equal(missing.confirmSignedIn(), false);

  const failed = new AppleSignInFlight();
  const outcome = await failed.start(deps({ startAppleAuthenticationFlow: async () => result(async () => { throw { code: 'activation_failed' }; }) }));
  assert.equal(outcome.kind, 'failed');
  assert.equal(failed.confirmSignedIn(), false);
});

test('invalid Apple strategy is reported as missing native Clerk configuration', async () => {
  const flight = new AppleSignInFlight();
  const outcome = await flight.start(deps({
    startAppleAuthenticationFlow: async () => {
      throw { status: 422, errors: [{ code: 'form_param_value_invalid', meta: { paramName: 'strategy' } }] };
    },
  }));
  assert.equal(outcome.kind, 'failed');
  if (outcome.kind !== 'failed') return;
  assert.equal(outcome.rejectedParameter, 'strategy');
  assert.equal(outcome.messageCategory, 'native_strategy_unavailable');
  assert.equal(outcome.createdSessionIdReturned, false);
  assert.equal(outcome.setActiveRan, false);
  assert.match(flight.getSnapshot().error ?? '', /isn’t enabled/);
});

test('unconfirmed session times out to retry without navigating', async () => {
  const flight = new AppleSignInFlight();
  await flight.start(deps());
  assert.equal(flight.failIfUnconfirmed(), true);
  assert.equal(flight.confirmSignedIn(), false);
  assert.match(flight.getSnapshot().error ?? '', /could not confirm/);
});
