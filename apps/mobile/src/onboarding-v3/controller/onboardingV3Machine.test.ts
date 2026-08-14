import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOnboardingActivationPhase,
  initialOnboardingV3State,
  mapLegacyResumeStep,
  onboardingV3Reducer,
  ONBOARDING_V3_STEPS,
  type OnboardingV3Event,
  type OnboardingV3State,
  type OnboardingV3Step,
} from './onboardingV3Machine';
import { FUTURE_PRIMARY_GOALS, isFuturePrimaryGoal, PRIMARY_GOALS, type PrimaryGoal } from '../state/personalizedOnboarding';

const at = (step: OnboardingV3Step, patch: Partial<OnboardingV3State> = {}): OnboardingV3State => ({ ...initialOnboardingV3State, step, ...patch });
const reduce = (step: OnboardingV3Step, event: OnboardingV3Event, patch?: Partial<OnboardingV3State>) => onboardingV3Reducer(at(step, patch), event);

function goalState(goal: PrimaryGoal, step: OnboardingV3Step, answers: Record<string, string | number | string[] | null> = {}) {
  return at(step, { profile: { ...initialOnboardingV3State.profile, name: 'Megan', primaryGoal: goal, secondaryGoals: [goal], answers } });
}

test('legacy fallback starts at the retained name screen', () => {
  assert.equal(reduce('splash', { type: 'SPLASH_FINISHED', elapsedMs: 699, fontsLoaded: true }).step, 'splash');
  assert.equal(reduce('splash', { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'name');
});

test('name is trimmed and exactly three primary goals enter one shared engine', () => {
  const named = reduce('name', { type: 'NAME_SUBMITTED', raw: '  Megan  ' });
  assert.equal(named.profile.name, 'Megan');
  assert.equal(named.step, 'primaryGoal');
  assert.deepEqual(PRIMARY_GOALS, ['save_money', 'eat_healthier', 'hit_macros']);
  for (const goal of PRIMARY_GOALS) {
    const selected = onboardingV3Reducer({ ...named, step: 'primaryGoal' }, { type: 'PRIMARY_GOAL_SELECTED', goal });
    assert.equal(selected.step, 'question1');
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
  let state = goalState('hit_macros', 'question1');
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

test('dietary answers persist directly into the plan without secondary or future screens', () => {
  let state = goalState('save_money', 'dietaryPreferences');
  state = onboardingV3Reducer(state, { type: 'DIETARY_SET', preferences: { allergies: ['Peanuts'], restrictions: ['Vegetarian'], avoidances: [], dislikes: [] } });
  assert.equal(state.step, 'planReady');
  assert.deepEqual(state.profile.secondaryGoals, ['save_money']);
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
  const globalBackPairs: Array<[OnboardingV3Step, OnboardingV3Step]> = [['primaryGoal', 'name'], ['question1', 'primaryGoal']];
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
  assert.equal(onboardingV3Reducer(goalState('save_money', 'planReady'), { type: 'BACK' }).step, 'dietaryPreferences');
  const entitlementIndex = ONBOARDING_V3_STEPS.indexOf('paywall');
  for (const step of ONBOARDING_V3_STEPS.slice(0, entitlementIndex)) {
    const next = onboardingV3Reducer(at(step), { type: 'PHOTO_SELECTED', uri: 'file:///blocked.jpg' });
    assert.notEqual(next.step, 'photoConfirm', step);
  }
});

test('fresh legacy fallback starts at splash and advances to name', () => {
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: initialOnboardingV3State.profile, resumeStep: null, mascotName: 'Kiko', attribution: null,
  });
  assert.equal(hydrated.resumeStep, null);
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'name');
});

test('resume from a currently valid screen lands back on that exact screen', () => {
  const profile = { ...initialOnboardingV3State.profile, primaryGoal: 'save_money' as PrimaryGoal, secondaryGoals: ['save_money' as const] };
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile, resumeStep: 'question3', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'question3');
});

test('mapLegacyResumeStep: removed screens redirect to retained safe successors', () => {
  assert.equal(mapLegacyResumeStep('nameFox'), 'name');
  assert.equal(mapLegacyResumeStep('branchIntro'), 'question1');
  assert.equal(mapLegacyResumeStep('secondaryGoals'), 'dietaryPreferences');
});

test('mapLegacyResumeStep: personalizedFuture (dead, unrendered) always redirects to planReady', () => {
  assert.equal(mapLegacyResumeStep('personalizedFuture'), 'planReady');
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: { ...initialOnboardingV3State.profile, primaryGoal: 'save_money' as PrimaryGoal, secondaryGoals: ['save_money' as const] },
    resumeStep: 'personalizedFuture', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'planReady');
});

test('mapLegacyResumeStep: unknown or malformed route values never crash and fall through to null', () => {
  assert.equal(mapLegacyResumeStep(null), null);
  assert.equal(mapLegacyResumeStep(''), '');
  assert.equal(mapLegacyResumeStep('totally-made-up-step'), 'totally-made-up-step');
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: initialOnboardingV3State.profile, resumeStep: 'totally-made-up-step', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(hydrated.resumeStep, null);
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'name');
});

test('an unknown resume step never lands on complete or marks onboarding finished', () => {
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: initialOnboardingV3State.profile, resumeStep: 'complete', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(hydrated.resumeStep, null);
  assert.notEqual(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'complete');
});

test('existing entitled subscriber state is not disturbed by resume mapping', () => {
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: { ...initialOnboardingV3State.profile, primaryGoal: 'save_money' as PrimaryGoal, secondaryGoals: ['save_money' as const] },
    resumeStep: 'paywall', mascotName: 'Kiko', attribution: null,
  });
  // 'paywall' is real-input-unlocked-adjacent (isRealInputUnlocked covers postPurchase..complete,
  // not paywall itself) and is a valid resumable step, so it must resume exactly there —
  // the paywall screen's own entitlement check (useEntitlement) is what actually skips it.
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'paywall');
});

test('getOnboardingActivationPhase categorizes every step into exactly one phase', () => {
  assert.equal(getOnboardingActivationPhase('splash'), 'questions');
  assert.equal(getOnboardingActivationPhase('planReady'), 'questions');
  assert.equal(getOnboardingActivationPhase('paywall'), 'paywall');
  assert.equal(getOnboardingActivationPhase('postPurchase'), 'entitled');
  assert.equal(getOnboardingActivationPhase('input'), 'entitled');
  assert.equal(getOnboardingActivationPhase('photoConfirm'), 'entitled');
  assert.equal(getOnboardingActivationPhase('analyzing'), 'entitled');
  assert.equal(getOnboardingActivationPhase('recipe'), 'recipe_revealed');
  assert.equal(getOnboardingActivationPhase('cooking'), 'recipe_revealed');
  assert.equal(getOnboardingActivationPhase('cookingComplete'), 'recipe_revealed');
  assert.equal(getOnboardingActivationPhase('complete'), 'complete');
  for (const step of ONBOARDING_V3_STEPS) assert.ok(getOnboardingActivationPhase(step), step);
});

test('not_sure has prepared typing but is not one of the three reachable primary goals', () => {
  assert.equal(PRIMARY_GOALS.includes('not_sure' as PrimaryGoal), false);
  assert.deepEqual(FUTURE_PRIMARY_GOALS, ['save_money', 'eat_healthier', 'hit_macros', 'not_sure']);
  assert.equal(isFuturePrimaryGoal('not_sure'), true);
  assert.equal(isFuturePrimaryGoal('save_money'), true);
  assert.equal(isFuturePrimaryGoal('waste_less'), false);
});
