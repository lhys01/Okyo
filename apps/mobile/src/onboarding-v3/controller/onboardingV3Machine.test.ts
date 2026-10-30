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

test('splash and showcase lead to the fox introduction before food goals', () => {
  assert.equal(reduce('splash', { type: 'SPLASH_FINISHED', elapsedMs: 699, fontsLoaded: true }).step, 'splash');
  assert.equal(reduce('splash', { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'showcase');
  assert.equal(reduce('showcase', { type: 'SHOWCASE_FINISHED' }).step, 'foxIntro');
  assert.equal(reduce('foxIntro', { type: 'CONTINUE' }).step, 'nameFox');
  assert.equal(reduce('nameFox', { type: 'MASCOT_NAME_SUBMITTED', raw: 'Milo' }).step, 'name');
  assert.equal(reduce('name', { type: 'NAME_SUBMITTED', raw: 'Megan' }).step, 'foxExplainer1');
  assert.equal(reduce('foxExplainer1', { type: 'CONTINUE' }).step, 'foxExplainer2');
  assert.equal(reduce('foxExplainer2', { type: 'CONTINUE' }).step, 'ageEligibility');
  assert.equal(reduce('ageEligibility', { type: 'AGE_VALUE_CHANGED', value: 28 }).profile.age, 28);
  assert.equal(reduce('ageEligibility', { type: 'CONTINUE' }, { profile: { ...initialOnboardingV3State.profile, age: 28, ageEligibility: '18_plus' } }).step, 'primaryGoal');
  const selected = reduce('primaryGoal', { type: 'PRIMARY_GOAL_SELECTED', goal: 'hit_macros' });
  assert.equal(selected.step, 'branchIntro');
  assert.equal(onboardingV3Reducer(selected, { type: 'BACK' }).step, 'primaryGoal');
});

test('the explanation pages resume and Back follows the immediately preceding page', () => {
  const profile = goalState('hit_macros', 'foxExplainer2').profile;
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile, resumeStep: 'foxExplainer2', mascotName: 'Kiko', attribution: null,
  });
  const resumed = onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 1200, fontsLoaded: true });
  assert.equal(resumed.step, 'foxExplainer2');
  assert.equal(onboardingV3Reducer(resumed, { type: 'BACK' }).step, 'foxExplainer1');
  const age = onboardingV3Reducer(resumed, { type: 'CONTINUE' });
  assert.equal(age.step, 'ageEligibility');
  const selectedAge = onboardingV3Reducer(age, { type: 'AGE_VALUE_CHANGED', value: 28 });
  const primaryGoal = onboardingV3Reducer(selectedAge, { type: 'CONTINUE' });
  assert.equal(primaryGoal.step, 'primaryGoal');
  const branchQuestions = onboardingV3Reducer(primaryGoal, { type: 'PRIMARY_GOAL_SELECTED', goal: 'hit_macros' });
  assert.equal(branchQuestions.step, 'branchIntro');
  assert.equal(onboardingV3Reducer(branchQuestions, { type: 'BACK' }).step, 'primaryGoal');
  assert.equal(onboardingV3Reducer(resumed, { type: 'BACK' }).step, 'foxExplainer1');
});

test('one shared plan route precedes signature for every active goal and survives resume', () => {
  for (const goal of PRIMARY_GOALS) {
    const questions = goalState(goal, 'branchIntro');
    const plan = onboardingV3Reducer(questions, { type: 'BRANCH_PLAN_READY' });
    assert.equal(plan.step, 'branchPlan');
    assert.equal(onboardingV3Reducer(plan, { type: 'BACK' }).step, 'branchIntro');
    const signature = onboardingV3Reducer(plan, { type: 'CONTINUE' });
    assert.equal(signature.step, 'branchSignature');
    assert.equal(onboardingV3Reducer(signature, { type: 'BACK' }).step, 'branchPlan');
    const account = onboardingV3Reducer(signature, { type: 'BRANCH_SIGNATURE_COMPLETED' });
    assert.equal(account.step, 'branchAccount');
    assert.equal(onboardingV3Reducer(account, { type: 'BACK' }).step, 'branchSignature');
    assert.equal(onboardingV3Reducer(plan, { type: 'BRANCH_PLAN_READY' }), plan);
  }
  const signature = goalState('hit_macros', 'branchSignature');
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: signature.profile, resumeStep: 'branchPlan', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 1200, fontsLoaded: true }).step, 'branchPlan');
  assert.ok(ONBOARDING_V3_STEPS.indexOf('branchPlan') < ONBOARDING_V3_STEPS.indexOf('branchSignature'));
  assert.ok(ONBOARDING_V3_STEPS.indexOf('branchSignature') < ONBOARDING_V3_STEPS.indexOf('branchAccount'));
  assert.equal(onboardingV3Reducer(goalState('hit_macros', 'branchPlan'), { type: 'MACRO_PLAN_EDIT_REQUESTED' }).step, 'branchIntro');
});

test('fresh onboarding follows the same complete route for every active goal', () => {
  const expected = ['showcase', 'foxIntro', 'nameFox', 'name', 'foxExplainer1', 'foxExplainer2', 'ageEligibility', 'primaryGoal', 'branchIntro', 'branchPlan', 'branchSignature', 'branchAccount'];
  for (const goal of PRIMARY_GOALS) {
    let state = onboardingV3Reducer(initialOnboardingV3State, { type: 'SPLASH_FINISHED', elapsedMs: 1200, fontsLoaded: true });
    const visited = [state.step];
    const advance = (event: OnboardingV3Event) => { state = onboardingV3Reducer(state, event); visited.push(state.step); };
    advance({ type: 'SHOWCASE_FINISHED' });
    advance({ type: 'CONTINUE' });
    advance({ type: 'MASCOT_NAME_SUBMITTED', raw: 'Milo' });
    advance({ type: 'NAME_SUBMITTED', raw: 'Megan' });
    advance({ type: 'CONTINUE' });
    advance({ type: 'CONTINUE' });
    state = onboardingV3Reducer(state, { type: 'AGE_VALUE_CHANGED', value: 28 });
    advance({ type: 'CONTINUE' });
    advance({ type: 'PRIMARY_GOAL_SELECTED', goal });
    advance({ type: 'BRANCH_PLAN_READY' });
    advance({ type: 'CONTINUE' });
    advance({ type: 'BRANCH_SIGNATURE_COMPLETED' });
    assert.deepEqual(visited, expected, goal);
    assert.equal(state.profile.name, 'Megan');
    assert.equal(state.mascotName, 'Milo');
    assert.equal(state.profile.primaryGoal, goal);
    assert.equal(onboardingV3Reducer(state, { type: 'BACK' }).step, 'branchSignature');
  }
});

test('fox naming and user naming precede both explanations and goal questions', () => {
  const branch = goalState('save_money', 'nameFox');
  assert.equal(onboardingV3Reducer(branch, { type: 'MASCOT_NAME_SUBMITTED', raw: '  Milo  ' }).step, 'name');
  assert.equal(onboardingV3Reducer(branch, { type: 'MASCOT_NAME_SKIPPED' }).step, 'name');
  assert.equal(onboardingV3Reducer(branch, { type: 'BACK' }).step, 'foxIntro');
  assert.equal(reduce('nameFox', { type: 'MASCOT_NAME_SUBMITTED', raw: '  Milo  ' }).step, 'name');
  assert.equal(reduce('nameFox', { type: 'MASCOT_NAME_SKIPPED' }).step, 'name');
  assert.equal(reduce('nameFox', { type: 'MASCOT_NAME_SUBMITTED', raw: '  Milo  ' }).mascotName, 'Milo');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'name'), { type: 'NAME_SKIPPED' }).step, 'foxExplainer1');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'name'), { type: 'BACK' }).step, 'nameFox');
  assert.equal(reduce('personalizationChoice', { type: 'PERSONALIZATION_CONTINUE' }).step, 'paywall');
  assert.equal(reduce('personalizationChoice', { type: 'PERSONALIZATION_SKIP' }).step, 'paywall');
  // A user who already named their fox (e.g. under the pre-restructure flow) is never asked twice.
  const alreadyNamed = at('planReady', { mascotName: 'Milo' });
  assert.equal(onboardingV3Reducer(alreadyNamed, { type: 'CONTINUE' }).step, 'paywall');
});

test('user name is trimmed after fox naming and exactly three goals enter the shared route', () => {
  const named = reduce('name', { type: 'NAME_SUBMITTED', raw: '  Megan  ' });
  assert.equal(named.profile.name, 'Megan');
  assert.equal(named.step, 'foxExplainer1');
  assert.deepEqual(PRIMARY_GOALS, ['save_money', 'eat_healthier', 'hit_macros']);
  for (const goal of PRIMARY_GOALS) {
    const selected = onboardingV3Reducer({ ...named, step: 'primaryGoal' }, { type: 'PRIMARY_GOAL_SELECTED', goal });
    assert.equal(selected.step, 'branchIntro');
    assert.equal(selected.profile.primaryGoal, goal);
  }
  assert.equal(PRIMARY_GOALS.includes('waste_less' as PrimaryGoal), false);
});

test('Save Money questions require the shared plan before signature and account', () => {
  const questions = goalState('save_money', 'branchIntro');
  const plan = onboardingV3Reducer(questions, { type: 'BRANCH_PLAN_READY' });
  assert.equal(plan.step, 'branchPlan');
  assert.equal(plan.profile.primaryGoal, 'save_money');
  assert.equal(onboardingV3Reducer(plan, { type: 'CONTINUE' }).step, 'branchSignature');
});

test('branch plan follows questions directly and preserves existing dietary data without showing allergies', () => {
  let state = goalState('save_money', 'branchIntro');
  state = { ...state, profile: { ...state.profile, dietaryPreferences: { allergies: ['Peanuts'], restrictions: [], avoidances: [], dislikes: [] } } };
  state = onboardingV3Reducer(state, { type: 'BRANCH_PLAN_READY' });
  assert.equal(state.step, 'branchPlan');
  assert.deepEqual(state.profile.dietaryPreferences.allergies, ['Peanuts']);
  state = onboardingV3Reducer(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'branchSignature');
  assert.equal(onboardingV3Reducer(state, { type: 'BACK' }).step, 'branchPlan');
  assert.equal(onboardingV3Reducer(state, { type: 'BRANCH_SIGNATURE_COMPLETED' }).step, 'branchAccount');
});

test('fresh reducer state has no cross-session allergy data', () => {
  const fresh = goalState('eat_healthier', 'branchPlan');
  assert.deepEqual(fresh.profile.dietaryPreferences.allergies, []);
  assert.equal(onboardingV3Reducer(fresh, { type: 'BRANCH_ALLERGIES_SET', allergies: ['Milk'] }), fresh);
});

test('a fresh hydration clears a stale device dietary mirror without changing a resumable profile', () => {
  const staleProfile = { ...initialOnboardingV3State.profile, dietaryPreferences: { allergies: ['Peanuts'], restrictions: [], avoidances: [], dislikes: [] } };
  const fresh = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: staleProfile, resumeStep: null, mascotName: 'Kiko', attribution: null,
  });
  assert.deepEqual(fresh.profile.dietaryPreferences.allergies, []);

  const resumable = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: { ...staleProfile, primaryGoal: 'save_money', secondaryGoals: ['save_money'] }, resumeStep: 'branchDietarySafety', mascotName: 'Kiko', attribution: null,
  });
  assert.deepEqual(resumable.profile.dietaryPreferences.allergies, ['Peanuts']);
});

test('legacy allergy route resumes on the shared plan without losing existing dietary data', () => {
  const profile = {
    ...initialOnboardingV3State.profile,
    primaryGoal: 'eat_healthier' as PrimaryGoal,
    secondaryGoals: ['eat_healthier' as const],
    dietaryPreferences: { allergies: ['Tree nuts'], restrictions: [], avoidances: [], dislikes: [] },
  };
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile, resumeStep: 'branchDietarySafety', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'branchPlan');
  assert.deepEqual(hydrated.profile.dietaryPreferences.allergies, ['Tree nuts']);
  assert.deepEqual(hydrated.dietaryRestrictions, ['Tree nuts']);
});

test('Macros questions also require the shared plan before signature', () => {
  const questions = goalState('hit_macros', 'branchIntro');
  const plan = onboardingV3Reducer(questions, { type: 'BRANCH_PLAN_READY' });
  assert.equal(plan.step, 'branchPlan');
  assert.equal(plan.profile.primaryGoal, 'hit_macros');
  assert.equal(onboardingV3Reducer(plan, { type: 'CONTINUE' }).step, 'branchSignature');
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
  assert.equal(state.step, 'question5');
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
  assert.equal(state.step, 'holdReveal');
  assert.deepEqual(state.profile.secondaryGoals, ['save_money', 'cook_more', 'waste_less']);
  assert.deepEqual(state.profile.dietaryRestrictions, ['Peanuts', 'Vegetarian']);
  assert.equal(onboardingV3Reducer(state, { type: 'HOLD_COMPLETED' }).step, 'planReady');
  assert.equal(onboardingV3Reducer(at('planReady', { profile: state.profile }), { type: 'CONTINUE' }).step, 'personalizationChoice');
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

test('when no purchase provider is configured, onboarding completes without granting premium', () => {
  const paywall = at('paywall');
  const completed = onboardingV3Reducer(paywall, { type: 'PAYMENTS_UNAVAILABLE_CONTINUE' });
  assert.equal(completed.step, 'complete');
  assert.equal(completed.profile, paywall.profile);
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
    ['name', 'nameFox'], ['ageEligibility', 'foxExplainer2'], ['primaryGoal', 'ageEligibility'], ['foxIntro', 'showcase'],
    ['foxExplainer1', 'name'], ['foxExplainer2', 'foxExplainer1'],
    ['branchIntro', 'primaryGoal'], ['branchPlan', 'branchIntro'], ['branchSignature', 'branchPlan'],
    ['personalizationChoice', 'planReady'],
  ];
  for (const [from, to] of globalBackPairs) assert.equal(reduce(from, { type: 'BACK' }).step, to);
  assert.equal(onboardingV3Reducer(goalState('save_money', 'nameFox'), { type: 'BACK' }).step, 'foxIntro');
  assert.equal(reduce('nameFox', { type: 'BACK' }).step, 'foxIntro');

  const savingsQuestion2 = goalState('save_money', 'question2');
  assert.equal(onboardingV3Reducer(savingsQuestion2, { type: 'BACK' }).step, 'question1');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'holdReveal'), { type: 'BACK' }).step, 'secondaryGoals');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'branchReveal'), { type: 'BACK' }).step, 'holdReveal');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'branchInsight'), { type: 'BACK' }).step, 'question5');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'branchDemo'), { type: 'BACK' }).step, 'branchInsight');

  assert.equal(onboardingV3Reducer(goalState('hit_macros', 'holdReveal'), { type: 'BACK' }).step, 'secondaryGoals');
  assert.equal(onboardingV3Reducer(goalState('hit_macros', 'nutritionTargets'), { type: 'BACK' }).step, 'question9');
  assert.equal(onboardingV3Reducer(goalState('hit_macros', 'branchDemo'), { type: 'BACK' }).step, 'nutritionTargets');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'dietaryPreferences'), { type: 'BACK' }).step, 'branchDemo');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'secondaryGoals'), { type: 'BACK' }).step, 'dietaryPreferences');
  assert.equal(onboardingV3Reducer(goalState('save_money', 'planReady'), { type: 'BACK' }).step, 'dietaryPreferences');
  const entitlementIndex = ONBOARDING_V3_STEPS.indexOf('paywall');
  for (const step of ONBOARDING_V3_STEPS.slice(0, entitlementIndex)) {
    const next = onboardingV3Reducer(at(step), { type: 'PHOTO_SELECTED', uri: 'file:///blocked.jpg' });
    assert.notEqual(next.step, 'photoConfirm', step);
  }
});

test('fresh legacy fallback starts at splash and advances to showcase', () => {
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile: initialOnboardingV3State.profile, resumeStep: null, mascotName: 'Kiko', attribution: null,
  });
  assert.equal(hydrated.resumeStep, null);
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'showcase');
});

test('resume from a currently valid screen lands back on that exact screen', () => {
  const profile = { ...initialOnboardingV3State.profile, primaryGoal: 'save_money' as PrimaryGoal, secondaryGoals: ['save_money' as const] };
  const hydrated = onboardingV3Reducer(initialOnboardingV3State, {
    type: 'HYDRATE', profile, resumeStep: 'question3', mascotName: 'Kiko', attribution: null,
  });
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'question3');
});

test('mapLegacyResumeStep: restored screens resume directly, no longer redirected', () => {
  // V4's Step 11 briefly removed these steps and this map redirected persisted
  // routes for them; V4 was rejected and all four are live steps again (see
  // onboardingV3Machine.ts), so isResumableStep accepts the raw id and the
  // map is never consulted for them anymore.
  assert.equal(mapLegacyResumeStep('nameFox'), 'nameFox');
  assert.equal(mapLegacyResumeStep('branchIntro'), 'branchIntro');
  assert.equal(mapLegacyResumeStep('secondaryGoals'), 'secondaryGoals');
});

test('mapLegacyResumeStep: personalizedFuture (dead, unrendered) always redirects to planReady', () => {
  // Unlike the other three, personalizedFuture has no reachable forward
  // transition in the restored reducer either (see the HYDRATE branch's
  // explicit ternary) — this is original pre-V4 behavior, not a Step 11
  // artifact, so it keeps redirecting even now that the step is back in
  // ONBOARDING_V3_STEPS.
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
  assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, 'showcase');
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
