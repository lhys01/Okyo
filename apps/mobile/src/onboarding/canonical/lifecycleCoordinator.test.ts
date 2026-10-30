import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyPersonalizedProfile } from '../../onboarding-v3/state/personalizedOnboarding';
import { createCanonicalLifecycleCoordinator } from './lifecycleCoordinator';
import type { CanonicalOnboardingSnapshot } from './types';

const snapshot: CanonicalOnboardingSnapshot = {
  schemaVersion: 1,
  profile: { ...emptyPersonalizedProfile, name: 'Ari', primaryGoal: 'eat_healthier' },
  resumeStep: 'branchDemo',
};

test('lifecycle coordinator composes all persisted hydration inputs into the established contract', async () => {
  const calls: string[] = [];
  const coordinator = createCanonicalLifecycleCoordinator({
    readSnapshot: async () => { calls.push('snapshot'); return snapshot; },
    readMascotName: async () => { calls.push('mascot'); return 'Mochi'; },
    readAttribution: async () => { calls.push('attribution'); return 'friends_family'; },
    readDietaryPreferences: async () => {
      calls.push('dietary');
      return { allergies: ['Wheat'], restrictions: ['Vegan'], avoidances: [], dislikes: ['Olives'] };
    },
    writeSnapshot: async () => { throw new Error('not used by hydration'); },
  });

  assert.deepEqual(await coordinator.hydrate(), {
    profile: {
      ...snapshot.profile,
      dietaryPreferences: { allergies: ['Wheat'], restrictions: ['Vegan'], avoidances: [], dislikes: ['Olives'] },
    },
    resumeStep: 'branchDemo',
    mascotName: 'Mochi',
    attribution: 'friends_family',
  });
  assert.deepEqual(new Set(calls), new Set(['snapshot', 'mascot', 'attribution', 'dietary']));
});

test('lifecycle coordinator leaves V3 route policy injected and persists the established snapshot payload', async () => {
  const writes: Array<Omit<CanonicalOnboardingSnapshot, 'schemaVersion'>> = [];
  const coordinator = createCanonicalLifecycleCoordinator({
    readSnapshot: async () => snapshot,
    readMascotName: async () => 'Kiko',
    readAttribution: async () => null,
    readDietaryPreferences: async () => ({ allergies: [], restrictions: [], avoidances: [], dislikes: [] }),
    writeSnapshot: async (value) => { writes.push(value); },
  });
  const routeCalls: string[] = [];

  await coordinator.persistProfileSnapshot({
    profile: snapshot.profile,
    currentRoute: 'personalizedFuture',
    resolveResumeRoute: (route) => {
      routeCalls.push(route);
      return 'planReady';
    },
  });

  assert.deepEqual(routeCalls, ['personalizedFuture']);
  assert.deepEqual(writes, [{ profile: snapshot.profile, resumeStep: 'planReady' }]);
});

test('lifecycle coordinator preserves read and write failures for the V3 controller to handle', async () => {
  const readFailure = new Error('read failed');
  const writeFailure = new Error('write failed');
  const coordinator = createCanonicalLifecycleCoordinator({
    readSnapshot: async () => { throw readFailure; },
    readMascotName: async () => 'Kiko',
    readAttribution: async () => null,
    readDietaryPreferences: async () => ({ allergies: [], restrictions: [], avoidances: [], dislikes: [] }),
    writeSnapshot: async () => { throw writeFailure; },
  });

  await assert.rejects(coordinator.hydrate(), readFailure);
  await assert.rejects(
    coordinator.persistProfileSnapshot({
      profile: snapshot.profile,
      currentRoute: 'branchDemo',
      resolveResumeRoute: () => 'branchDemo',
    }),
    writeFailure,
  );
});
