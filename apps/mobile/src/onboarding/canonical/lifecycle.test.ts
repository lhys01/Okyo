import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyPersonalizedProfile } from '../../onboarding-v3/state/personalizedOnboarding';
import { createCanonicalHydrationResult, createCanonicalProfileSnapshotRequest } from './lifecycle';

test('hydration preserves the V3 snapshot route and substitutes only the existing dietary mirror', () => {
  const dietaryPreferences = { allergies: ['Wheat'], restrictions: [], avoidances: [], dislikes: ['Olives'] };
  const result = createCanonicalHydrationResult({
    snapshot: { schemaVersion: 1, profile: { ...emptyPersonalizedProfile, name: 'Megan', dietaryPreferences: { allergies: [], restrictions: [], avoidances: [], dislikes: [] } }, resumeStep: 'branchDemo' },
    mascotName: 'Kiko',
    attribution: 'friends_family',
    dietaryPreferences,
  });

  assert.equal(result.profile.name, 'Megan');
  assert.deepEqual(result.profile.dietaryPreferences, dietaryPreferences);
  assert.equal(result.resumeStep, 'branchDemo');
  assert.equal(result.mascotName, 'Kiko');
  assert.equal(result.attribution, 'friends_family');
});

test('profile snapshot assembly delegates route meaning to the V3-supplied resolver', () => {
  const calls: string[] = [];
  const result = createCanonicalProfileSnapshotRequest({
    profile: { ...emptyPersonalizedProfile, name: 'Megan' },
    currentRoute: 'recipe',
    resolveResumeRoute: (route) => { calls.push(route); return 'paywall'; },
  });

  assert.deepEqual(calls, ['recipe']);
  assert.equal(result.profile.name, 'Megan');
  assert.equal(result.resumeStep, 'paywall');
});
