import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { initialOnboardingV3State, onboardingV3Reducer } from '../controller/onboardingV3Machine';

const hostSource = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/OnboardingV3.tsx'), 'utf8');
const screenSource = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/screens-v4/DietarySafetyScreen.tsx'), 'utf8');

test('the allergy component remains available outside this V3 path, but no V3 route renders it', () => {
  assert.match(screenSource, /accessibilityRole="button"/);
  assert.match(screenSource, /testID="dietary-none-of-these"/);
  assert.doesNotMatch(hostSource, /<DietarySafetyScreen/);
  assert.match(hostSource, /case 'branchPlan':/);
});

test('each active branch moves questions → one plan → signature without an allergy stop', () => {
  for (const primaryGoal of ['save_money', 'eat_healthier', 'hit_macros'] as const) {
    const profile = { ...initialOnboardingV3State.profile, primaryGoal, secondaryGoals: [primaryGoal] };
    const questions = { ...initialOnboardingV3State, step: 'branchIntro' as const, profile };
    const plan = onboardingV3Reducer(questions, { type: 'BRANCH_PLAN_READY' });
    assert.equal(plan.step, 'branchPlan');
    assert.equal(onboardingV3Reducer(plan, { type: 'BRANCH_DIETARY_COMPLETED' }), plan);
    assert.equal(onboardingV3Reducer(plan, { type: 'CONTINUE' }).step, 'branchSignature');
  }
});

test('a stored allergy preference is preserved, and the old allergy route migrates to the plan', () => {
  const profile = {
    ...initialOnboardingV3State.profile,
    primaryGoal: 'save_money' as const,
    secondaryGoals: ['save_money' as const],
    dietaryPreferences: { allergies: ['Tree nuts'], restrictions: [], avoidances: [], dislikes: [] },
  };
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile, resumeStep: 'branchDietarySafety', mascotName: 'Fox', attribution: null,
  });
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 1200, fontsLoaded: true }).step, 'branchPlan');
  assert.deepEqual(hydrated.profile.dietaryPreferences.allergies, ['Tree nuts']);
});
