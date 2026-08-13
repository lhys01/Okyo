import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialOnboardingV3State,
  onboardingV3Reducer,
  ONBOARDING_V3_STEPS,
  type OnboardingV3Event,
  type OnboardingV3State,
  type OnboardingV3Step,
} from './onboardingV3Machine';
import { PRIMARY_GOALS, type PrimaryGoal } from '../state/personalizedOnboarding';

const at = (step: OnboardingV3Step, patch: Partial<OnboardingV3State> = {}): OnboardingV3State => ({ ...initialOnboardingV3State, step, ...patch });
const reduce = (step: OnboardingV3Step, event: OnboardingV3Event, patch?: Partial<OnboardingV3State>) => onboardingV3Reducer(at(step, patch), event);

function goalState(goal: PrimaryGoal, step: OnboardingV3Step, answers: Record<string, string | number | string[] | null> = {}) {
  return at(step, { profile: { ...initialOnboardingV3State.profile, name: 'Megan', primaryGoal: goal, secondaryGoals: [goal], answers } });
}

test('splash and locked onboarding2 lead through onboarding11 before the user name screen', () => {
  assert.equal(reduce('splash', { type: 'SPLASH_FINISHED', elapsedMs: 699, fontsLoaded: true }).step, 'splash');
  assert.equal(reduce('splash', { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'showcase');
  assert.equal(reduce('showcase', { type: 'SHOWCASE_FINISHED' }).step, 'nameFox');
  assert.equal(reduce('nameFox', { type: 'MASCOT_NAME_SUBMITTED', raw: '  Kiko  ' }).step, 'name');
});

test('name is trimmed and exactly three primary goals enter one shared engine', () => {
  const named = reduce('name', { type: 'NAME_SUBMITTED', raw: '  Megan  ' });
  assert.equal(named.profile.name, 'Megan');
  assert.equal(named.step, 'primaryGoal');
  assert.deepEqual(PRIMARY_GOALS, ['save_money', 'eat_healthier', 'hit_macros']);
  for (const goal of PRIMARY_GOALS) {
    const selected = onboardingV3Reducer({ ...named, step: 'primaryGoal' }, { type: 'PRIMARY_GOAL_SELECTED', goal });
    assert.equal(selected.step, 'branchIntro');
    assert.equal(selected.profile.primaryGoal, goal);
  }
  assert.equal(PRIMARY_GOALS.includes('waste_less' as PrimaryGoal), false);
});

test('old cook-more primary state returns safely to goal selection', () => {
  const legacyProfile = {
    ...initialOnboardingV3State.profile,
    name: 'Megan',
    primaryGoal: 'cook_more',
    secondaryGoals: ['cook_more'],
  } as unknown as OnboardingV3State['profile'];
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: legacyProfile, resumeStep: 'question2', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(hydrated.profile.primaryGoal, null);
  assert.equal(hydrated.resumeStep, 'primaryGoal');
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'primaryGoal');
});

test('branch questions insert meaningful reveals and macro target screens', () => {
  let state = goalState('hit_macros', 'branchIntro');
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'macroGoal', value: 'Build muscle' });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'ageYears', value: 28 });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'heightCm', value: 178 });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'weightKg', value: 75 });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'holdReveal');
  state = onboardingV3Reducer(state, { type: 'HOLD_COMPLETED' });
  assert.equal(state.step, 'branchReveal');
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'biologicalSex', value: 'Male' });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'activityLevel', value: 'Active' });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'trainingDaysPerWeek', value: 4 });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'desiredRatePerWeek', value: 'Slow' });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'branchInsight');
  assert.ok(state.profile.nutritionTargets);
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'question9');
  state = onboardingV3Reducer(state, { type: 'ANSWER_SET', key: 'proteinTarget', value: null });
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'nutritionTargets');
  assert.ok(state.profile.nutritionTargets?.proteinGrams);
});

test('secondary and dietary answers persist into the plan without a redundant future screen', () => {
  let state = goalState('save_money', 'dietaryPreferences');
  state = onboardingV3Reducer(state, { type: 'DIETARY_SET', preferences: { allergies: ['Peanuts'], restrictions: ['Vegetarian'], avoidances: [], dislikes: [] } });
  assert.equal(state.step, 'secondaryGoals');
  state = onboardingV3Reducer(state, { type: 'SECONDARY_GOALS_SET', goals: ['cook_more', 'waste_less'] });
  assert.equal(state.step, 'planReady');
  assert.deepEqual(state.profile.secondaryGoals, ['save_money', 'cook_more', 'waste_less']);
  assert.deepEqual(state.profile.dietaryRestrictions, ['Peanuts', 'Vegetarian']);
  assert.equal(onboardingV3Reducer(at('planReady', { profile: state.profile }), { type: 'CONTINUE' }).step, 'paywall');
});

test('the paywall fails closed and entitlement unlocks post-purchase real input, not Home', () => {
  const paywall = at('paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_CANCELLED' }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_FAILED', message: 'Try again' }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_SUCCEEDED', entitled: false }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'RESTORE_SUCCEEDED', entitled: false }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_SUCCEEDED', entitled: true }).step, 'postPurchase');
  assert.equal(onboardingV3Reducer(paywall, { type: 'RESTORE_SUCCEEDED', entitled: true }).step, 'postPurchase');
});

test('the dev paywall bypass finishes onboarding directly, skipping the post-purchase handoff', () => {
  // DEV_BYPASS_COMPLETED is only ever dispatched when DEV_BYPASS_PAYWALL is on.
  // It must never route through 'postPurchase' (the "Okyo Pro unlocked" screen).
  const paywall = at('paywall');
  const bypassed = onboardingV3Reducer(paywall, { type: 'DEV_BYPASS_COMPLETED' });
  assert.equal(bypassed.step, 'complete');
  assert.notEqual(bypassed.step, 'postPurchase');
});

test('camera, picker, and scan states exist only after the entitlement gate', () => {
  const postPurchase = at('postPurchase');
  assert.equal(onboardingV3Reducer(postPurchase, { type: 'PHOTO_SELECTED', uri: 'file:///meal.jpg' }).step, 'photoConfirm');
  assert.equal(onboardingV3Reducer(postPurchase, { type: 'DESCRIPTION_SUBMITTED', text: 'ramen', scanSessionId: 'scan-1' }).step, 'analyzing');
  const success = reduce('analyzing', { type: 'ANALYSIS_SUCCEEDED', analysisId: 'analysis-1', dishName: 'Ramen' });
  assert.equal(success.step, 'recipe');
  const ready = onboardingV3Reducer(success, { type: 'RECIPE_READY', recipeId: 'recipe-1' });
  assert.equal(onboardingV3Reducer(ready, { type: 'CONTINUE' }).step, 'complete');
});

test('Back is deterministic and no pre-paywall state can bypass into real input', () => {
  const globalBackPairs: Array<[OnboardingV3Step, OnboardingV3Step]> = [
    ['nameFox', 'showcase'], ['name', 'nameFox'], ['primaryGoal', 'name'], ['branchIntro', 'primaryGoal'],
  ];
  for (const [from, to] of globalBackPairs) assert.equal(reduce(from, { type: 'BACK' }).step, to);

  const savingsQuestion2 = goalState('save_money', 'question2');
  assert.equal(onboardingV3Reducer(savingsQuestion2, { type: 'BACK' }).step, 'question1');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'holdReveal'), { type: 'BACK' }).step, 'question2');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'branchReveal'), { type: 'BACK' }).step, 'holdReveal');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'branchInsight'), { type: 'BACK' }).step, 'question5');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'branchDemo'), { type: 'BACK' }).step, 'branchInsight');

  assert.equal(onboardingV3Reducer(goalState('hit_macros', 'holdReveal'), { type: 'BACK' }).step, 'question4');
  assert.equal(onboardingV3Reducer(goalState('hit_macros', 'nutritionTargets'), { type: 'BACK' }).step, 'question9');
  assert.equal(onboardingV3Reducer(goalState('hit_macros', 'branchDemo'), { type: 'BACK' }).step, 'nutritionTargets');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'dietaryPreferences'), { type: 'BACK' }).step, 'branchDemo');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'secondaryGoals'), { type: 'BACK' }).step, 'dietaryPreferences');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'planReady'), { type: 'BACK' }).step, 'secondaryGoals');
  const entitlementIndex = ONBOARDING_V3_STEPS.indexOf('paywall');
  for (const step of ONBOARDING_V3_STEPS.slice(0, entitlementIndex)) {
    const next = onboardingV3Reducer(at(step), { type: 'PHOTO_SELECTED', uri: 'file:///blocked.jpg' });
    assert.notEqual(next.step, 'photoConfirm', step);
  }
});
