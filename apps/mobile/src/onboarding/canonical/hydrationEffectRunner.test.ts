import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyPersonalizedProfile } from '../../onboarding-v3/state/personalizedOnboarding';
import {
  runCanonicalHydrationEffect,
  type CanonicalDeferredSplashCompletion,
} from './hydrationEffectRunner';
import type { CanonicalHydrationResult } from './lifecycle';

const hydration: CanonicalHydrationResult = {
  profile: { ...emptyPersonalizedProfile, name: 'Ari', primaryGoal: 'eat_healthier' },
  resumeStep: 'branchDemo',
  mascotName: 'Mochi',
  attribution: 'friends_family',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('hydration runner preserves V3 success and deferred-splash dispatch order', async () => {
  const pending = deferred<CanonicalHydrationResult>();
  const calls: string[] = [];
  const splash: CanonicalDeferredSplashCompletion = { elapsedMs: 1100, fontsLoaded: true };
  let pendingSplash: CanonicalDeferredSplashCompletion | null = null;
  const running = runCanonicalHydrationEffect({
    hydrate: () => { calls.push('hydrate'); return pending.promise; },
    isMounted: () => true,
    dispatchHydration: (value) => { assert.equal(value, hydration); calls.push('dispatch:hydrate'); },
    logHydrationError: () => calls.push('log:error'),
    markHydrated: () => calls.push('mark:hydrated'),
    takeDeferredSplashCompletion: () => {
      calls.push('take:splash');
      const value = pendingSplash;
      pendingSplash = null;
      return value;
    },
    dispatchDeferredSplashCompletion: (value) => { assert.equal(value, splash); calls.push('dispatch:splash'); },
  });

  assert.deepEqual(calls, ['hydrate']);
  pendingSplash = splash;
  pending.resolve(hydration);
  await running;
  assert.deepEqual(calls, ['hydrate', 'dispatch:hydrate', 'mark:hydrated', 'take:splash', 'dispatch:splash']);
  assert.equal(pendingSplash, null);
});

test('the V3-owned hydrated guard prevents a later effect entry from starting hydration again', async () => {
  let hydrated = false;
  let starts = 0;
  const runV3EffectEntry = () => {
    if (hydrated) return Promise.resolve();
    return runCanonicalHydrationEffect({
      hydrate: async () => { starts += 1; return hydration; },
      isMounted: () => true,
      dispatchHydration: () => undefined,
      logHydrationError: () => undefined,
      markHydrated: () => { hydrated = true; },
      takeDeferredSplashCompletion: () => null,
      dispatchDeferredSplashCompletion: () => undefined,
    });
  };

  await runV3EffectEntry();
  await runV3EffectEntry();
  assert.equal(starts, 1);
});

test('hydration runner does not dispatch, mark, or consume deferred splash after unmount', async () => {
  const pending = deferred<CanonicalHydrationResult>();
  const calls: string[] = [];
  let mounted = true;
  const running = runCanonicalHydrationEffect({
    hydrate: () => { calls.push('hydrate'); return pending.promise; },
    isMounted: () => mounted,
    dispatchHydration: () => calls.push('dispatch:hydrate'),
    logHydrationError: () => calls.push('log:error'),
    markHydrated: () => calls.push('mark:hydrated'),
    takeDeferredSplashCompletion: () => { calls.push('take:splash'); return { elapsedMs: 1100, fontsLoaded: false }; },
    dispatchDeferredSplashCompletion: () => calls.push('dispatch:splash'),
  });

  mounted = false;
  pending.resolve(hydration);
  await running;
  assert.deepEqual(calls, ['hydrate']);
});

test('hydration runner preserves V3 failure logging and mounted-only splash finalization', async () => {
  const failure = new Error('storage unavailable');
  const calls: string[] = [];
  await runCanonicalHydrationEffect({
    hydrate: async () => { calls.push('hydrate'); throw failure; },
    isMounted: () => true,
    dispatchHydration: () => calls.push('dispatch:hydrate'),
    logHydrationError: (error) => { assert.equal(error, failure); calls.push('log:error'); },
    markHydrated: () => calls.push('mark:hydrated'),
    takeDeferredSplashCompletion: () => { calls.push('take:splash'); return { elapsedMs: 900, fontsLoaded: false }; },
    dispatchDeferredSplashCompletion: () => calls.push('dispatch:splash'),
  });
  assert.deepEqual(calls, ['hydrate', 'log:error', 'mark:hydrated', 'take:splash', 'dispatch:splash']);
});

test('hydration runner still logs a failure after unmount but leaves V3 refs and dispatch untouched', async () => {
  const failure = new Error('storage unavailable');
  const calls: string[] = [];
  await runCanonicalHydrationEffect({
    hydrate: async () => { calls.push('hydrate'); throw failure; },
    isMounted: () => false,
    dispatchHydration: () => calls.push('dispatch:hydrate'),
    logHydrationError: (error) => { assert.equal(error, failure); calls.push('log:error'); },
    markHydrated: () => calls.push('mark:hydrated'),
    takeDeferredSplashCompletion: () => { calls.push('take:splash'); return null; },
    dispatchDeferredSplashCompletion: () => calls.push('dispatch:splash'),
  });
  assert.deepEqual(calls, ['hydrate', 'log:error']);
});
