import assert from 'node:assert/strict';
import test from 'node:test';

import { initialOnboardingV3State, onboardingV3Reducer } from '../controller/onboardingV3Machine';
import { emptyPersonalizedProfile, normalizePersonalizedProfile } from './personalizedOnboarding';

test('the active route proceeds from name into the two explainer screens before branch questions', () => {
  const named = onboardingV3Reducer({ ...initialOnboardingV3State, step: 'name' }, { type: 'NAME_SUBMITTED', raw: 'Megan' });
  assert.equal(named.step, 'foxExplainer1');
  assert.equal(onboardingV3Reducer(named, { type: 'BACK' }).step, 'name');
  const skipped = onboardingV3Reducer({ ...initialOnboardingV3State, step: 'name' }, { type: 'NAME_SKIPPED' });
  assert.equal(skipped.step, 'foxExplainer1');
  assert.equal(skipped.profile.name, '');
  assert.equal(onboardingV3Reducer(skipped, { type: 'PRIMARY_GOAL_SELECTED', goal: 'save_money' }).step, 'foxExplainer1');
});

test('age slider stores the exact age and eligibility, advancing only after Continue', () => {
  for (const [age, eligibility] of [[13, 'under_18'], [17, 'under_18'], [18, '18_plus'], [100, '18_plus']] as const) {
    const ageStep = onboardingV3Reducer({ ...initialOnboardingV3State, step: 'ageEligibility' }, { type: 'AGE_VALUE_CHANGED', value: age });
    assert.equal(ageStep.profile.age, age);
    assert.equal(ageStep.profile.ageEligibility, eligibility);
    assert.equal(ageStep.step, 'ageEligibility');
    assert.equal(normalizePersonalizedProfile(ageStep.profile).age, age);
    const continued = onboardingV3Reducer(ageStep, { type: 'CONTINUE' });
    assert.equal(continued.step, 'primaryGoal');
    assert.equal(continued.profile.age, age);
  }
});

test('prefer not to say is saved separately and can continue without a slider value', () => {
  const state = onboardingV3Reducer({ ...initialOnboardingV3State, step: 'ageEligibility' }, { type: 'AGE_ELIGIBILITY_SELECTED', value: 'prefer_not_to_say' });
  assert.equal(state.profile.ageEligibility, 'prefer_not_to_say');
  assert.equal(state.profile.age, null);
  assert.equal(state.step, 'ageEligibility');
  assert.equal(onboardingV3Reducer(state, { type: 'CONTINUE' }).step, 'primaryGoal');
});

test('invalid slider values and invalid restored ages are ignored', () => {
  const start = { ...initialOnboardingV3State, step: 'ageEligibility' as const };
  assert.equal(onboardingV3Reducer(start, { type: 'AGE_VALUE_CHANGED', value: 12 }).profile.age, null);
  assert.equal(onboardingV3Reducer(start, { type: 'AGE_VALUE_CHANGED', value: 101 }).profile.age, null);
  assert.equal(emptyPersonalizedProfile.ageEligibility, null);
  assert.equal(normalizePersonalizedProfile({ ageEligibility: 'invalid' }).ageEligibility, null);
  assert.equal(normalizePersonalizedProfile({ age: 12 }).age, null);
});
