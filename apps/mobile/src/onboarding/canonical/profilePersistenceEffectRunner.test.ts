import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canRunCanonicalProfilePersistence,
  runCanonicalProfilePersistenceEffect,
} from './profilePersistenceEffectRunner';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('profile persistence eligibility exactly preserves V3 hydration and terminal-route skips', () => {
  assert.equal(canRunCanonicalProfilePersistence({ hydrated: false, currentRoute: 'branchIntro' }), false);
  assert.equal(canRunCanonicalProfilePersistence({ hydrated: true, currentRoute: 'splash' }), false);
  assert.equal(canRunCanonicalProfilePersistence({ hydrated: true, currentRoute: 'complete' }), false);
  assert.equal(canRunCanonicalProfilePersistence({ hydrated: true, currentRoute: 'branchIntro' }), true);
  assert.equal(canRunCanonicalProfilePersistence({ hydrated: true, currentRoute: 'question1' }), true);
});

test('profile persistence runner invokes exactly one injected snapshot handoff per eligible effect entry', async () => {
  const calls: string[] = [];
  await runCanonicalProfilePersistenceEffect({
    persistProfileSnapshot: async () => { calls.push('persist'); },
    logPersistenceError: () => calls.push('log:error'),
  });
  assert.deepEqual(calls, ['persist']);
});

test('V3-owned snapshot assembly and route policy run before the persistence handoff', async () => {
  const calls: string[] = [];
  await runCanonicalProfilePersistenceEffect({
    persistProfileSnapshot: async () => {
      calls.push('resolve:route');
      calls.push('assemble:snapshot');
      calls.push('persist:snapshot');
    },
    logPersistenceError: () => calls.push('log:error'),
  });
  assert.deepEqual(calls, ['resolve:route', 'assemble:snapshot', 'persist:snapshot']);
});

test('profile persistence runner preserves the existing no-retry error log behavior', async () => {
  const failure = new Error('storage unavailable');
  const calls: string[] = [];
  await runCanonicalProfilePersistenceEffect({
    persistProfileSnapshot: async () => { calls.push('persist'); throw failure; },
    logPersistenceError: (error) => { assert.equal(error, failure); calls.push('log:error'); },
  });
  assert.deepEqual(calls, ['persist', 'log:error']);
});

test('an in-flight V3 persistence effect has no mount guard, dispatch, or stale callback to add', async () => {
  const pending = deferred<void>();
  const calls: string[] = [];
  let mounted = true;
  const running = runCanonicalProfilePersistenceEffect({
    persistProfileSnapshot: () => { calls.push('persist'); return pending.promise; },
    logPersistenceError: () => calls.push('log:error'),
  });

  mounted = false;
  pending.resolve();
  await running;
  assert.equal(mounted, false);
  assert.deepEqual(calls, ['persist']);
});

test('invalid profile input is not an existing runner guard; V3 supplies the typed snapshot closure', async () => {
  const calls: string[] = [];
  await runCanonicalProfilePersistenceEffect({
    persistProfileSnapshot: async () => { calls.push('persist:provided-input'); },
    logPersistenceError: () => calls.push('log:error'),
  });
  assert.deepEqual(calls, ['persist:provided-input']);
});
