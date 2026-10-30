import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialOnboardingV3State, onboardingV3Reducer as reduce } from '../controller/onboardingV3Machine';
import { MACROS_FOOD_FOCUSES, MACROS_FOOD_BARRIERS, macrosFoodFirstReveal, usesFoodFirstMacros } from './macrosFoodFirst';
import { normalizePersonalizedProfile } from './personalizedOnboarding';
import { EMPTY_FOOD_PREFERENCES } from '../../state/foodPreferences';

function start(goal: 'hit_macros' | 'save_money' | 'eat_healthier' = 'hit_macros') {
  let state = reduce({ ...initialOnboardingV3State, step: 'primaryGoal' }, { type: 'PRIMARY_GOAL_SELECTED', goal });
  assert.equal(state.step, 'branchIntro');
  return state;
}
for (const focus of MACROS_FOOD_FOCUSES) for (const barrier of MACROS_FOOD_BARRIERS) test(`${focus} / ${barrier}: compact route preserves dietary and purchase gate`, () => {
  let state = start();
  assert.equal(usesFoodFirstMacros(state.profile), true);
  assert.equal(reduce(state, { type: 'CONTINUE' }).step, 'branchIntro');
  state = reduce(state, { type: 'ANSWER_SET', key: 'macrosFocus', value: focus });
  state = reduce(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'question1');
  assert.equal(reduce(state, { type: 'CONTINUE' }).step, 'question1');
  state = reduce(state, { type: 'ANSWER_SET', key: 'macrosObstacle', value: barrier });
  state = reduce(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'branchDemo');
  assert.ok(macrosFoodFirstReveal(state.profile).response);
  assert.equal(reduce(state, { type: 'BACK' }).step, 'question1');
  state = reduce(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'dietaryPreferences');
  state = reduce(state, { type: 'DIETARY_SET', preferences: { ...EMPTY_FOOD_PREFERENCES, allergies: ['Peanuts'], dislikes: ['Mushrooms'] } });
  // New users name their fox immediately after the showcase, so the compact
  // macros route returns from dietary setup to the plan summary.
  assert.equal(state.step, 'planReady');
  assert.deepEqual(state.dietaryRestrictions, ['Peanuts']);
  assert.deepEqual(state.dietaryDislikes, ['Mushrooms']);
  state = reduce(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'personalizationChoice');
  state = reduce(state, { type: 'PERSONALIZATION_CONTINUE' });
  assert.equal(state.step, 'paywall');
  assert.equal(reduce(state, { type: 'PURCHASE_CANCELLED' }).step, 'paywall');
  assert.equal(reduce(state, { type: 'PURCHASE_SUCCEEDED', entitled: false }).step, 'paywall');
  assert.equal(reduce(state, { type: 'PURCHASE_SUCCEEDED', entitled: true }).step, 'postPurchase');
  const restored = normalizePersonalizedProfile(JSON.parse(JSON.stringify(state.profile)));
  assert.deepEqual(restored.macroPreferences, state.profile.macroPreferences);
  assert.deepEqual(restored.dietaryPreferences, state.profile.dietaryPreferences);
  assert.equal(restored.nutritionTargets, null);
});
test('own targets validate, survive resume, and clear when opting out', () => {
  let state = start();
  for (const [key, value] of [['macrosFocus', 'Protein'], ['macrosObstacle', 'Boring meals'], ['macrosOwnTargets', 'yes']] as const) state = reduce(state, { type: 'ANSWER_SET', key, value });
  state = reduce(reduce(state, { type: 'CONTINUE' }), { type: 'CONTINUE' });
  assert.equal(state.step, 'question2');
  assert.equal(reduce(state, { type: 'CONTINUE' }).step, 'question2');
  state = reduce(state, { type: 'ANSWER_SET', key: 'macrosDailyProtein', value: 140 });
  state = reduce(state, { type: 'ANSWER_SET', key: 'macrosDailyCalories', value: 100 });
  assert.equal(reduce(state, { type: 'CONTINUE' }).step, 'question2');
  state = reduce(state, { type: 'ANSWER_SET', key: 'macrosDailyCalories', value: 2200 });
  const profile = normalizePersonalizedProfile(JSON.parse(JSON.stringify(state.profile)));
  assert.deepEqual(profile.macroPreferences?.ownDailyReferences, { proteinGrams: 140, calories: 2200 });
  const restored = reduce(initialOnboardingV3State, { type: 'HYDRATE', profile, resumeStep: 'question2', mascotName: 'Kiko', attribution: null });
  assert.equal(restored.resumeStep, 'question2');
  assert.equal(reduce(state, { type: 'CONTINUE' }).step, 'branchDemo');
  state = reduce(state, { type: 'ANSWER_SET', key: 'macrosOwnTargets', value: 'no' });
  assert.deepEqual(state.profile.macroPreferences?.ownDailyReferences, {});
  assert.equal(state.profile.answers.macrosDailyProtein, undefined);
});
test('other branches and legacy macro drafts do not opt into the compact route', () => {
  for (const goal of ['save_money', 'eat_healthier'] as const) {
    const state = start(goal);
    assert.equal(usesFoodFirstMacros(state.profile), false);
    assert.equal(reduce(state, { type: 'CONTINUE' }).step, 'question1');
  }
  assert.equal(usesFoodFirstMacros({ ...initialOnboardingV3State.profile, primaryGoal: 'hit_macros' }), false);
});
