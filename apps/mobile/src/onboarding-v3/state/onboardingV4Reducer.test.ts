import assert from 'node:assert/strict';
import test from 'node:test';

import { getOnboardingV4StageLabel, ONBOARDING_V4_STAGE_LABELS, ONBOARDING_V4_STEPS } from './onboardingV4Route';
import { isFuturePrimaryGoal, isPrimaryGoal } from './personalizedOnboarding';
import { emptyOnboardingV4Draft } from './onboardingV4Draft';
import { initialOnboardingV4State, isBranchQ1Answered, isBranchQ2Answered, isMacroDetailsAnswered, onboardingV4Reducer, resumeOnboardingV4Step, type OnboardingV4Event, type OnboardingV4State } from './onboardingV4Reducer';

const at = (step: OnboardingV4State['step'], patch: Partial<OnboardingV4State> = {}): OnboardingV4State => ({ ...initialOnboardingV4State, step, ...patch });

function run(events: OnboardingV4Event[]): OnboardingV4State {
  return events.reduce(onboardingV4Reducer, at('splash'));
}

test('splash -> promise -> primaryGoal -> branchQ1, in order', () => {
  let state = at('splash');
  state = onboardingV4Reducer(state, { type: 'SPLASH_FINISHED' });
  assert.equal(state.step, 'promise');

  state = onboardingV4Reducer(state, { type: 'CONTINUE' });
  assert.equal(state.step, 'primaryGoal');

  state = onboardingV4Reducer(state, { type: 'GOAL_SELECTED', goal: 'eat_healthier' });
  assert.equal(state.step, 'branchQ1');
  assert.equal(state.draft.initialGoal, 'eat_healthier');
  assert.equal(state.draft.resolvedPrimaryGoal, 'eat_healthier');
});

test('each of the four goals is selectable and lands on branchQ1', () => {
  for (const goal of ['save_money', 'eat_healthier', 'hit_macros', 'not_sure'] as const) {
    const next = onboardingV4Reducer(at('primaryGoal'), { type: 'GOAL_SELECTED', goal });
    assert.equal(next.step, 'branchQ1');
    assert.equal(next.draft.initialGoal, goal);
  }
});

test('selecting not_sure sets initialGoal but leaves resolvedPrimaryGoal null (Step 04 ownership model)', () => {
  const next = onboardingV4Reducer(at('primaryGoal'), { type: 'GOAL_SELECTED', goal: 'not_sure' });
  assert.equal(isFuturePrimaryGoal(next.draft.initialGoal), true);
  assert.equal(isPrimaryGoal(next.draft.initialGoal), false);
  assert.equal(next.draft.resolvedPrimaryGoal, null);
});

test('back navigation: primaryGoal -> promise, branchQ1 -> primaryGoal', () => {
  assert.equal(onboardingV4Reducer(at('primaryGoal'), { type: 'BACK' }).step, 'promise');
  assert.equal(onboardingV4Reducer(at('branchQ1'), { type: 'BACK' }).step, 'primaryGoal');
});

test('splash ignores non-SPLASH_FINISHED events, promise ignores non-CONTINUE events', () => {
  assert.equal(onboardingV4Reducer(at('splash'), { type: 'CONTINUE' }).step, 'splash');
  assert.equal(onboardingV4Reducer(at('promise'), { type: 'SPLASH_FINISHED' }).step, 'promise');
  assert.equal(onboardingV4Reducer(at('promise'), { type: 'BACK' }).step, 'promise');
});

test('HYDRATE replaces the draft without changing the current step', () => {
  const hydrated = onboardingV4Reducer(at('primaryGoal'), { type: 'HYDRATE', draft: { ...emptyOnboardingV4Draft, initialGoal: 'hit_macros', resolvedPrimaryGoal: 'hit_macros' } });
  assert.equal(hydrated.step, 'primaryGoal');
  assert.equal(hydrated.draft.initialGoal, 'hit_macros');
});

test('an invalid goal value is rejected and the step does not advance', () => {
  // @ts-expect-error deliberately invalid input
  const next = onboardingV4Reducer(at('primaryGoal'), { type: 'GOAL_SELECTED', goal: 'cook_more' });
  assert.equal(next.step, 'primaryGoal');
  assert.equal(next.draft.initialGoal, null);
});

// --- Step 05: full per-branch Q1 -> Q2 -> insight routes --------------------

test('save_money: full route reaches personalInsight in exactly 2 questions (no macroDetails)', () => {
  const state = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'save_money' },
    { type: 'SAVINGS_TAKEOUT_FREQUENCY_ANSWERED', value: '2–3' }, { type: 'CONTINUE' },
    { type: 'SAVINGS_SPEND_PER_MEAL_ANSWERED', value: 20 }, { type: 'CONTINUE' },
  ]);
  assert.equal(state.step, 'personalInsight');
  assert.equal(state.draft.savingsAnswers.takeoutFrequency, '2–3');
  assert.equal(state.draft.savingsAnswers.spendPerMealDollars, 20);
});

test('eat_healthier: full route reaches personalInsight in exactly 2 questions', () => {
  const state = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'eat_healthier' },
    { type: 'HEALTH_DEFINITION_ANSWERED', value: 'More vegetables' }, { type: 'CONTINUE' },
    { type: 'HEALTH_BARRIER_ANSWERED', value: 'Time' }, { type: 'CONTINUE' },
  ]);
  assert.equal(state.step, 'personalInsight');
  assert.equal(state.draft.healthAnswers.healthierDefinition, 'More vegetables');
  assert.equal(state.draft.healthAnswers.healthBarrier, 'Time');
});

test('hit_macros (estimate path): route passes through macroDetails before personalInsight', () => {
  const state = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'hit_macros' },
    { type: 'MACRO_FOCUS_ANSWERED', value: 'Protein' }, { type: 'CONTINUE' },
    { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'estimate' }, { type: 'CONTINUE' },
  ]);
  assert.equal(state.step, 'macroDetails');
  const afterForm = onboardingV4Reducer(
    onboardingV4Reducer(state, { type: 'MACRO_CALCULATOR_INPUTS_ANSWERED', value: { ageYears: 30, heightCm: 175, weightKg: 70, biologicalSex: 'female', activityLevel: 'active', trainingDaysPerWeek: 3 } }),
    { type: 'CONTINUE' },
  );
  assert.equal(afterForm.step, 'personalInsight');
});

test('hit_macros (known path): route also passes through macroDetails before personalInsight', () => {
  const state = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'hit_macros' },
    { type: 'MACRO_FOCUS_ANSWERED', value: 'Calories' }, { type: 'CONTINUE' },
    { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'known' }, { type: 'CONTINUE' },
  ]);
  assert.equal(state.step, 'macroDetails');
  const afterForm = onboardingV4Reducer(
    onboardingV4Reducer(state, { type: 'MACRO_KNOWN_TARGETS_ANSWERED', value: { calories: 2000 } }),
    { type: 'CONTINUE' },
  );
  assert.equal(afterForm.step, 'personalInsight');
});

test('hit_macros (not_sure yet path): skips macroDetails entirely, straight to personalInsight', () => {
  const state = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'hit_macros' },
    { type: 'MACRO_FOCUS_ANSWERED', value: 'Balanced macros' }, { type: 'CONTINUE' },
    { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'not_sure' }, { type: 'CONTINUE' },
  ]);
  assert.equal(state.step, 'personalInsight');
});

test('not_sure: Q2 resolves resolvedPrimaryGoal and reaches personalInsight directly, never through macroDetails even when resolved to hit_macros', () => {
  const state = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'not_sure' },
    { type: 'NOT_SURE_UNIVERSAL_NEED_ANSWERED', value: 'Understand nutrition' }, { type: 'CONTINUE' },
    { type: 'NOT_SURE_TRANSFORMATION_ANSWERED', value: 'more_protein' }, { type: 'CONTINUE' },
  ]);
  assert.equal(state.step, 'personalInsight');
  assert.equal(state.draft.resolvedPrimaryGoal, 'hit_macros');
  assert.equal(state.draft.initialGoal, 'not_sure', 'initialGoal history is preserved even after resolution');
});

test('not_sure never routes back to primaryGoal — BACK from branchQ2 goes to branchQ1, not primaryGoal', () => {
  const state = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'not_sure' },
    { type: 'NOT_SURE_UNIVERSAL_NEED_ANSWERED', value: 'Just explore' }, { type: 'CONTINUE' },
  ]);
  assert.equal(state.step, 'branchQ2');
  assert.equal(onboardingV4Reducer(state, { type: 'BACK' }).step, 'branchQ1');
});

// --- Back navigation + dependent-answer clearing ----------------------------

test('back navigation preserves valid prior answers (Q1 answer survives going back from Q2)', () => {
  const atQ2 = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'save_money' },
    { type: 'SAVINGS_TAKEOUT_FREQUENCY_ANSWERED', value: '4–5' }, { type: 'CONTINUE' },
  ]);
  const back = onboardingV4Reducer(atQ2, { type: 'BACK' });
  assert.equal(back.step, 'branchQ1');
  assert.equal(back.draft.savingsAnswers.takeoutFrequency, '4–5');
});

test('macroDetails BACK goes to branchQ2, and personalInsight BACK returns to macroDetails when it applies', () => {
  const atMacroDetails = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'hit_macros' },
    { type: 'MACRO_FOCUS_ANSWERED', value: 'Protein' }, { type: 'CONTINUE' },
    { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'estimate' }, { type: 'CONTINUE' },
  ]);
  assert.equal(onboardingV4Reducer(atMacroDetails, { type: 'BACK' }).step, 'branchQ2');

  const atInsight = onboardingV4Reducer(
    onboardingV4Reducer(atMacroDetails, { type: 'MACRO_CALCULATOR_INPUTS_ANSWERED', value: { ageYears: 30, heightCm: 175, weightKg: 70, biologicalSex: 'female', activityLevel: 'active', trainingDaysPerWeek: 3 } }),
    { type: 'CONTINUE' },
  );
  assert.equal(atInsight.step, 'personalInsight');
  assert.equal(onboardingV4Reducer(atInsight, { type: 'BACK' }).step, 'macroDetails');
});

test('personalInsight BACK returns to branchQ2 (not macroDetails) for a branch that never used it', () => {
  const atInsight = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'eat_healthier' },
    { type: 'HEALTH_DEFINITION_ANSWERED', value: 'Lower calories' }, { type: 'CONTINUE' },
    { type: 'HEALTH_BARRIER_ANSWERED', value: 'Cravings' }, { type: 'CONTINUE' },
  ]);
  assert.equal(onboardingV4Reducer(atInsight, { type: 'BACK' }).step, 'branchQ2');
});

test('changing targetPath after filling macroDetails clears the stale knownTargets/calculatorInputs (dependent-answer recompute)', () => {
  const filledEstimate = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'hit_macros' },
    { type: 'MACRO_FOCUS_ANSWERED', value: 'Protein' }, { type: 'CONTINUE' },
    { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'estimate' }, { type: 'CONTINUE' },
    { type: 'MACRO_CALCULATOR_INPUTS_ANSWERED', value: { ageYears: 30, heightCm: 175, weightKg: 70, biologicalSex: 'female', activityLevel: 'active', trainingDaysPerWeek: 3 } },
  ]);
  assert.equal(filledEstimate.step, 'macroDetails');
  assert.equal(filledEstimate.draft.macroAnswers.calculatorInputs.ageYears, 30);

  // Changing the path requires going back to branchQ2 first — that's the
  // only step MACRO_TARGET_PATH_ANSWERED is handled at.
  const backAtQ2 = onboardingV4Reducer(filledEstimate, { type: 'BACK' });
  const switchedToKnown = onboardingV4Reducer(backAtQ2, { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'known' });
  assert.equal(switchedToKnown.draft.macroAnswers.targetPath, 'known');
  assert.equal(switchedToKnown.draft.macroAnswers.calculatorInputs.ageYears, null, 'stale calculator inputs must be cleared when the path changes');
  assert.deepEqual(switchedToKnown.draft.macroAnswers.knownTargets, {});
});

test('re-answering targetPath with the SAME value is a no-op (does not spuriously clear anything)', () => {
  const atQ2WithKnownFilled = run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' },
    { type: 'GOAL_SELECTED', goal: 'hit_macros' },
    { type: 'MACRO_FOCUS_ANSWERED', value: 'Protein' }, { type: 'CONTINUE' },
    { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'known' },
  ]);
  const filledForm = onboardingV4Reducer(
    onboardingV4Reducer(atQ2WithKnownFilled, { type: 'CONTINUE' }),
    { type: 'MACRO_KNOWN_TARGETS_ANSWERED', value: { calories: 2000 } },
  );
  const backAtQ2 = onboardingV4Reducer(filledForm, { type: 'BACK' });
  const reAnswered = onboardingV4Reducer(backAtQ2, { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'known' });
  assert.deepEqual(reAnswered.draft.macroAnswers.knownTargets, { calories: 2000 });
});

// --- Resume at every meaningful state ---------------------------------------

test('resumeOnboardingV4Step: a brand-new draft resumes at promise (never skips it)', () => {
  assert.equal(resumeOnboardingV4Step(emptyOnboardingV4Draft), 'promise');
});

test('resumeOnboardingV4Step: resumes at branchQ1 once a goal is picked but Q1 unanswered', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const };
  assert.equal(resumeOnboardingV4Step(draft), 'branchQ1');
});

test('resumeOnboardingV4Step: resumes at branchQ2 once Q1 is answered', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const, savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: null } };
  assert.equal(resumeOnboardingV4Step(draft), 'branchQ2');
});

test('resumeOnboardingV4Step: resumes at macroDetails once macros Q1+Q2 are answered but the form is not', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'hit_macros' as const, resolvedPrimaryGoal: 'hit_macros' as const, macroAnswers: { ...emptyOnboardingV4Draft.macroAnswers, macroFocus: 'Protein' as const, targetPath: 'estimate' as const } };
  assert.equal(resumeOnboardingV4Step(draft), 'macroDetails');
});

test('resumeOnboardingV4Step: resumes at personalInsight once everything meaningful is answered', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const, savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 } };
  assert.equal(resumeOnboardingV4Step(draft), 'personalInsight');
});

test('resumeOnboardingV4Step: a hit_macros draft with targetPath=not_sure never resumes to macroDetails', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'hit_macros' as const, resolvedPrimaryGoal: 'hit_macros' as const, macroAnswers: { ...emptyOnboardingV4Draft.macroAnswers, macroFocus: 'Protein' as const, targetPath: 'not_sure' as const } };
  assert.equal(resumeOnboardingV4Step(draft), 'personalInsight');
});

test('splash SPLASH_FINISHED jumps directly to the resumed step, using the already-hydrated draft', () => {
  const hydrated = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: { ...emptyOnboardingV4Draft, initialGoal: 'eat_healthier', resolvedPrimaryGoal: 'eat_healthier' } });
  const afterSplash = onboardingV4Reducer(hydrated, { type: 'SPLASH_FINISHED' });
  assert.equal(afterSplash.step, 'branchQ1');
});

// --- Stage labels never move backward across the canonical forward order ----

test('stage labels never regress across the canonical forward step order', () => {
  const branchArcSteps = ONBOARDING_V4_STEPS.filter((step) => getOnboardingV4StageLabel(step) !== null);
  let lastIndex = -1;
  for (const step of branchArcSteps) {
    const label = getOnboardingV4StageLabel(step)!;
    const index = ONBOARDING_V4_STAGE_LABELS.indexOf(label);
    assert.ok(index >= lastIndex, `stage label regressed at step ${step}: ${label}`);
    lastIndex = index;
  }
});

// --- Step 06: dietary safety -------------------------------------------------

function routeToDietarySafety(goal: 'save_money' | 'eat_healthier' | 'hit_macros' | 'not_sure'): OnboardingV4State {
  if (goal === 'save_money') {
    return run([
      { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' }, { type: 'GOAL_SELECTED', goal },
      { type: 'SAVINGS_TAKEOUT_FREQUENCY_ANSWERED', value: '2–3' }, { type: 'CONTINUE' },
      { type: 'SAVINGS_SPEND_PER_MEAL_ANSWERED', value: 20 }, { type: 'CONTINUE' }, { type: 'CONTINUE' },
    ]);
  }
  if (goal === 'eat_healthier') {
    return run([
      { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' }, { type: 'GOAL_SELECTED', goal },
      { type: 'HEALTH_DEFINITION_ANSWERED', value: 'More vegetables' }, { type: 'CONTINUE' },
      { type: 'HEALTH_BARRIER_ANSWERED', value: 'Time' }, { type: 'CONTINUE' }, { type: 'CONTINUE' },
    ]);
  }
  if (goal === 'hit_macros') {
    return run([
      { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' }, { type: 'GOAL_SELECTED', goal },
      { type: 'MACRO_FOCUS_ANSWERED', value: 'Protein' }, { type: 'CONTINUE' },
      { type: 'MACRO_TARGET_PATH_ANSWERED', value: 'not_sure' }, { type: 'CONTINUE' }, { type: 'CONTINUE' },
    ]);
  }
  return run([
    { type: 'SPLASH_FINISHED' }, { type: 'CONTINUE' }, { type: 'GOAL_SELECTED', goal },
    { type: 'NOT_SURE_UNIVERSAL_NEED_ANSWERED', value: 'Just explore' }, { type: 'CONTINUE' },
    { type: 'NOT_SURE_TRANSFORMATION_ANSWERED', value: 'cheaper' }, { type: 'CONTINUE' }, { type: 'CONTINUE' },
  ]);
}

for (const goal of ['save_money', 'eat_healthier', 'hit_macros', 'not_sure'] as const) {
  test(`insight -> dietarySafety route works for ${goal}`, () => {
    const state = routeToDietarySafety(goal);
    assert.equal(state.step, 'dietarySafety');
  });
}

test('dietarySafety: toggling an allergy answers it, and CONTINUE is blocked until DIETARY_SAVED', () => {
  let state = routeToDietarySafety('save_money');
  state = onboardingV4Reducer(state, { type: 'DIETARY_ALLERGY_TOGGLED', value: 'Peanuts' });
  assert.deepEqual(state.draft.dietaryAnswers.allergies, ['Peanuts']);
  assert.equal(state.step, 'dietarySafety', 'CONTINUE is not the event that advances this step');
});

test('dietarySafety: toggling the same allergy twice removes it', () => {
  let state = routeToDietarySafety('save_money');
  state = onboardingV4Reducer(state, { type: 'DIETARY_ALLERGY_TOGGLED', value: 'Peanuts' });
  state = onboardingV4Reducer(state, { type: 'DIETARY_ALLERGY_TOGGLED', value: 'Peanuts' });
  assert.deepEqual(state.draft.dietaryAnswers.allergies, []);
});

test('dietarySafety: toggling a restriction and setting dislikes both persist into the draft', () => {
  let state = routeToDietarySafety('eat_healthier');
  state = onboardingV4Reducer(state, { type: 'DIETARY_RESTRICTION_TOGGLED', value: 'Vegan' });
  state = onboardingV4Reducer(state, { type: 'DIETARY_DISLIKES_CHANGED', value: ['Cilantro'] });
  assert.deepEqual(state.draft.dietaryAnswers.restrictions, ['Vegan']);
  assert.deepEqual(state.draft.dietaryAnswers.dislikes, ['Cilantro']);
});

test('dietarySafety: DIETARY_NONE_OF_THESE_TOGGLED clears prior selections and toggling again deselects it', () => {
  let state = routeToDietarySafety('save_money');
  state = onboardingV4Reducer(state, { type: 'DIETARY_ALLERGY_TOGGLED', value: 'Peanuts' });
  state = onboardingV4Reducer(state, { type: 'DIETARY_NONE_OF_THESE_TOGGLED' });
  assert.equal(state.draft.dietaryAnswers.noneOfThese, true);
  assert.deepEqual(state.draft.dietaryAnswers.allergies, []);

  state = onboardingV4Reducer(state, { type: 'DIETARY_NONE_OF_THESE_TOGGLED' });
  assert.equal(state.draft.dietaryAnswers.noneOfThese, false);
});

test('dietarySafety: DIETARY_SAVED is a no-op when unanswered, and marks completed + advances to plan when answered', () => {
  let state = routeToDietarySafety('save_money');
  const unanswered = onboardingV4Reducer(state, { type: 'DIETARY_SAVED' });
  assert.equal(unanswered.step, 'dietarySafety', 'cannot save an unanswered screen');
  assert.equal(unanswered.draft.dietaryAnswers.completed, false);

  state = onboardingV4Reducer(state, { type: 'DIETARY_NONE_OF_THESE_TOGGLED' });
  const saved = onboardingV4Reducer(state, { type: 'DIETARY_SAVED' });
  assert.equal(saved.step, 'plan');
  assert.equal(saved.draft.dietaryAnswers.completed, true);
  assert.equal(saved.draft.dietaryAnswers.noneOfThese, true, 'explicit none is preserved through save');
});

test('dietarySafety BACK returns to personalInsight and preserves valid prior choices', () => {
  let state = routeToDietarySafety('save_money');
  state = onboardingV4Reducer(state, { type: 'DIETARY_ALLERGY_TOGGLED', value: 'Peanuts' });
  const back = onboardingV4Reducer(state, { type: 'BACK' });
  assert.equal(back.step, 'personalInsight');
  assert.deepEqual(back.draft.dietaryAnswers.allergies, ['Peanuts'], 'back navigation preserves valid choices');
});

test('resumeOnboardingV4Step: a user who has not viewed the insight yet resumes at personalInsight even with branch answers complete', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const, savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 }, insightViewed: false };
  assert.equal(resumeOnboardingV4Step(draft), 'personalInsight');
});

test('resumeOnboardingV4Step: a user who viewed the insight but has not completed dietary safety resumes at dietarySafety, not personalInsight (Step 06 repair)', () => {
  const draft = { ...emptyOnboardingV4Draft, initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const, savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 }, insightViewed: true };
  assert.equal(resumeOnboardingV4Step(draft), 'dietarySafety');
});

test('resumeOnboardingV4Step: a user with partially-edited dietary selections resumes at dietarySafety with those selections intact', () => {
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 },
    insightViewed: true,
    dietaryAnswers: { allergies: ['Peanuts'], restrictions: [], dislikes: [], noneOfThese: false, completed: false },
  };
  assert.equal(resumeOnboardingV4Step(draft), 'dietarySafety');
});

test('resumeOnboardingV4Step: a real reducer walk through insight then BACK-ing out preserves dietarySafety resume (not a re-shown insight)', () => {
  let state = routeToDietarySafety('save_money');
  state = onboardingV4Reducer(state, { type: 'DIETARY_ALLERGY_TOGGLED', value: 'Peanuts' });
  assert.equal(state.draft.insightViewed, true, 'CONTINUE out of personalInsight already set this');
  assert.equal(resumeOnboardingV4Step(state.draft), 'dietarySafety');
});

test('resumeOnboardingV4Step: migrated v3 draft (insightViewed defaulted false) with dietary already completed still resumes at plan, not personalInsight', () => {
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 },
    insightViewed: false, // exactly what a migrated pre-repair draft looks like
    dietaryAnswers: { allergies: [], restrictions: [], dislikes: [], noneOfThese: true, completed: true },
  };
  assert.equal(resumeOnboardingV4Step(draft), 'plan');
});

test('resumeOnboardingV4Step: resumes at plan once dietary safety is explicitly completed', () => {
  const draft = {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 },
    dietaryAnswers: { allergies: [], restrictions: [], dislikes: [], noneOfThese: true, completed: true },
  };
  assert.equal(resumeOnboardingV4Step(draft), 'plan');
});

// --- Step 07: plan / scanEntry ---------------------------------------------

function dietaryCompletedDraft() {
  return {
    ...emptyOnboardingV4Draft,
    initialGoal: 'save_money' as const, resolvedPrimaryGoal: 'save_money' as const,
    savingsAnswers: { takeoutFrequency: '1' as const, spendPerMealDollars: 15 },
    dietaryAnswers: { allergies: [], restrictions: [], dislikes: [], noneOfThese: true, completed: true },
  };
}

test('plan step: BACK returns to dietarySafety', () => {
  const state = onboardingV4Reducer(at('plan', { draft: dietaryCompletedDraft() }), { type: 'BACK' });
  assert.equal(state.step, 'dietarySafety');
});

test('plan step: PLAN_COMMITTED advances to scanEntry and sets planCommitted', () => {
  const state = onboardingV4Reducer(at('plan', { draft: dietaryCompletedDraft() }), { type: 'PLAN_COMMITTED' });
  assert.equal(state.step, 'scanEntry');
  assert.equal(state.draft.planCommitted, true);
});

function committedDraft() {
  return { ...dietaryCompletedDraft(), planCommitted: true };
}

test('scanEntry step: BACK returns to plan', () => {
  const state = onboardingV4Reducer(at('scanEntry', { draft: committedDraft() }), { type: 'BACK' });
  assert.equal(state.step, 'plan');
});

test('scanEntry step: selecting a method records it and clears any prior image flag', () => {
  let state = at('scanEntry', { draft: committedDraft() });
  state = onboardingV4Reducer(state, { type: 'SCAN_INPUT_METHOD_SELECTED', method: 'camera' });
  assert.equal(state.draft.scanInput.method, 'camera');
  assert.equal(state.draft.scanInput.hasSelectedImage, false);
});

test('scanEntry step: selected image advances to photo confirmation and BACK clears it', () => {
  let state = onboardingV4Reducer(at('scanEntry', { draft: committedDraft() }), { type: 'SCAN_INPUT_METHOD_SELECTED', method: 'library' });
  state = onboardingV4Reducer(state, { type: 'SCAN_IMAGE_SELECTED' });
  assert.equal(state.step, 'photoConfirm');
  assert.equal(state.draft.scanInput.hasSelectedImage, true);
  assert.equal(state.draft.scanInput.method, 'library');
  state = onboardingV4Reducer(state, { type: 'BACK' });
  assert.equal(state.draft.scanInput.hasSelectedImage, false);
});

test('scanEntry step: SCAN_DESCRIPTION_CHANGED stores the raw text (normalization happens in onboardingV4Draft.ts on persist)', () => {
  const state = onboardingV4Reducer(at('scanEntry', { draft: committedDraft() }), { type: 'SCAN_DESCRIPTION_CHANGED', value: 'A crispy sandwich' });
  assert.equal(state.draft.scanInput.description, 'A crispy sandwich');
});

test('resumeOnboardingV4Step: dietary completed but plan not committed resumes at plan (covers both "never viewed" and "viewed but commit incomplete")', () => {
  assert.equal(resumeOnboardingV4Step(dietaryCompletedDraft()), 'plan');
});

test('resumeOnboardingV4Step: planCommitted true resumes at scanEntry, restoring recoverable input state', () => {
  const draft = { ...committedDraft(), scanInput: { method: 'description' as const, description: 'Leftover text', hasSelectedImage: false } };
  assert.equal(resumeOnboardingV4Step(draft), 'scanEntry');
});

// --- Step 08: durable free first scan --------------------------------------

const inFlight = { scanSessionId: 'scan-1', source: 'description' as const, mealDescription: 'Tofu bowl', startedAt: '2026-08-13T10:00:00.000Z' };

test('fresh hydrate retains a recoverable in-flight scan and free-result state', () => {
  const state = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: committedDraft(), inFlightScan: inFlight, freeRecipeConsumed: false });
  assert.deepEqual(state.inFlightScan, inFlight);
  assert.equal(state.freeRecipeConsumed, false);
  const resumed = onboardingV4Reducer({ ...state, step: 'scanEntry' }, { type: 'RESUME_SCAN' });
  assert.equal(resumed.step, 'analyzing');
});

test('rejection, failure, recipe failure, and cancellation never consume the free recipe', () => {
  for (const event of [
    { type: 'ANALYSIS_REJECTED', message: 'rejected' },
    { type: 'ANALYSIS_FAILED', message: 'failed' },
    { type: 'RECIPE_FAILED', message: 'failed' },
    { type: 'ANALYSIS_CANCELLED' },
  ] as const) {
    const next = onboardingV4Reducer(at('analyzing', { inFlightScan: inFlight }), event);
    assert.equal(next.step, 'scanEntry');
    assert.equal(next.freeRecipeConsumed, false);
    assert.equal(next.inFlightScan, null);
  }
});

test('analysis success alone does not consume; RECIPE_READY after it does', () => {
  let state = onboardingV4Reducer(at('analyzing', { inFlightScan: inFlight }), { type: 'ANALYSIS_SUCCEEDED', analysisId: 'analysis-1' });
  assert.equal(state.freeRecipeConsumed, false);
  state = onboardingV4Reducer(state, { type: 'RECIPE_READY', recipeId: 'recipe-scan-1' });
  assert.equal(state.step, 'recipe');
  assert.equal(state.freeRecipeConsumed, true);
  assert.equal(state.inFlightScan, null);
});

// --- Step 09: durable free result ------------------------------------------

test('hydrated consumed result reopens the same recipe directly after splash', () => {
  let state = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: committedDraft(), freeRecipeConsumed: true, recipeId: 'recipe-stable' });
  state = onboardingV4Reducer(state, { type: 'SPLASH_FINISHED' });
  assert.equal(state.step, 'recipe');
  assert.equal(state.recipeId, 'recipe-stable');
  assert.equal(state.freeRecipeConsumed, true);
});

test('opening and interacting with a not_sure result cannot mutate its already-resolved goal or return to primary-goal selection', () => {
  const draft = { ...committedDraft(), initialGoal: 'not_sure' as const, resolvedPrimaryGoal: 'save_money' as const, notSureAnswers: { universalNeed: 'Spend less' as const, preferredTransformation: 'cheaper' as const } };
  const before = at('recipe', { draft, recipeId: 'recipe-stable', freeRecipeConsumed: true });
  const after = onboardingV4Reducer(before, { type: 'GOAL_SELECTED', goal: 'hit_macros' });
  assert.equal(after.draft.initialGoal, 'not_sure');
  assert.equal(after.draft.notSureAnswers.preferredTransformation, 'cheaper');
  assert.equal(after.draft.resolvedPrimaryGoal, 'save_money');
  assert.equal(after.step, 'recipe');
  assert.equal(after.recipeId, 'recipe-stable');
  assert.equal(after.freeRecipeConsumed, true);
});

test('restart reopens the identical not_sure result branch without creating or consuming another recipe', () => {
  const draft = { ...committedDraft(), initialGoal: 'not_sure' as const, resolvedPrimaryGoal: 'hit_macros' as const, notSureAnswers: { universalNeed: 'Recreate food I see' as const, preferredTransformation: 'more_protein' as const } };
  let state = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft, freeRecipeConsumed: true, recipeId: 'recipe-stable' });
  state = onboardingV4Reducer(state, { type: 'SPLASH_FINISHED' });
  assert.equal(state.step, 'recipe');
  assert.equal(state.draft.initialGoal, 'not_sure');
  assert.equal(state.draft.notSureAnswers.preferredTransformation, 'more_protein');
  assert.equal(state.draft.resolvedPrimaryGoal, 'hit_macros');
  assert.equal(state.recipeId, 'recipe-stable');
  assert.equal(state.freeRecipeConsumed, true);
});

test('a persisted premium action remains on the fully visible recipe until entitlement decides the Step 10 route', () => {
  const action = { actionId: 'action-1', type: 'cook' as const, recipeId: 'recipe-stable', status: 'pending_entitlement' as const, createdAt: '2026-08-13T12:00:00.000Z' };
  const state = onboardingV4Reducer(at('recipe', { recipeId: 'recipe-stable', freeRecipeConsumed: true }), { type: 'PREMIUM_ACTION_PERSISTED', action });
  assert.equal(state.step, 'recipe');
  assert.deepEqual(state.pendingPremiumAction, action);
  assert.equal(state.freeRecipeConsumed, true);
});

test('only a persisted explicit action can open paywall, dismissal returns to the same free recipe', () => {
  const action = { actionId: 'action-1', type: 'customize' as const, recipeId: 'recipe-stable', customizationText: 'less spicy', status: 'paywall' as const, createdAt: '2026-08-13T12:00:00.000Z' };
  const dismissedAction = { ...action, status: 'dismissed' as const };
  const before = at('recipe', { recipeId: 'recipe-stable', freeRecipeConsumed: true });
  assert.equal(onboardingV4Reducer(before, { type: 'CONTINUE' }).step, 'recipe');
  const paywall = onboardingV4Reducer(before, { type: 'PAYWALL_REQUIRED', action });
  assert.equal(paywall.step, 'paywall');
  const dismissed = onboardingV4Reducer(paywall, { type: 'PAYWALL_DISMISSED', action: dismissedAction });
  assert.equal(dismissed.step, 'recipe');
  assert.equal(dismissed.recipeId, 'recipe-stable');
  assert.equal(dismissed.freeRecipeConsumed, true);
  assert.deepEqual(dismissed.pendingPremiumAction, dismissedAction);
  let restarted = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: committedDraft(), freeRecipeConsumed: true, recipeId: 'recipe-stable', pendingPremiumAction: dismissedAction });
  restarted = onboardingV4Reducer(restarted, { type: 'SPLASH_FINISHED' });
  assert.equal(restarted.step, 'recipe');
  assert.deepEqual(restarted.pendingPremiumAction, dismissedAction);
});

test('verified exact-action resumption enters postPurchase once without changing recipe or consumption', () => {
  const action = { actionId: 'action-1', type: 'cook' as const, recipeId: 'recipe-stable', status: 'completed' as const, createdAt: '2026-08-13T12:00:00.000Z' };
  const before = at('paywall', { recipeId: 'recipe-stable', freeRecipeConsumed: true, pendingPremiumAction: action });
  const resumed = onboardingV4Reducer(before, { type: 'PREMIUM_ACTION_RESUMED', action });
  assert.equal(resumed.step, 'postPurchase');
  assert.equal(resumed.pendingPremiumAction?.type, 'cook');
  assert.equal(resumed.recipeId, 'recipe-stable');
  assert.equal(resumed.freeRecipeConsumed, true);
  assert.equal(onboardingV4Reducer(resumed, { type: 'PREMIUM_ACTION_RESUMED', action }).step, 'postPurchase');
});

test('restart during paywall restores paywall only because a durable explicit action exists', () => {
  const action = { actionId: 'action-1', type: 'customize' as const, recipeId: 'recipe-stable', customizationText: 'more vegetables', status: 'paywall' as const, createdAt: '2026-08-13T12:00:00.000Z' };
  let state = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: committedDraft(), freeRecipeConsumed: true, recipeId: 'recipe-stable', pendingPremiumAction: action });
  state = onboardingV4Reducer(state, { type: 'SPLASH_FINISHED' });
  assert.equal(state.step, 'paywall');
  assert.equal(state.pendingPremiumAction?.customizationText, 'more vegetables');
  assert.equal(state.recipeId, 'recipe-stable');
});

test('restart with executing Cook or customization restores the durable post-purchase recovery destination', () => {
  for (const action of [
    { actionId: 'cook-executing', type: 'cook' as const, recipeId: 'recipe-stable', status: 'executing' as const, createdAt: '2026-08-13T12:00:00.000Z' },
    { actionId: 'custom-executing', type: 'customize' as const, recipeId: 'recipe-stable', customizationText: 'add lime', status: 'executing' as const, createdAt: '2026-08-13T12:00:00.000Z' },
  ]) {
    let state = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: committedDraft(), freeRecipeConsumed: true, recipeId: 'recipe-stable', pendingPremiumAction: action });
    state = onboardingV4Reducer(state, { type: 'SPLASH_FINISHED' });
    assert.equal(state.step, 'postPurchase');
  }
});

test('completed Cook restarts in Cook destination while completed customization restores the corrected recipe', () => {
  const cook = { actionId: 'cook-completed', type: 'cook' as const, recipeId: 'recipe-stable', status: 'completed' as const, createdAt: '2026-08-13T12:00:00.000Z' };
  const correctedRecipe = { id: 'revision-1', title: 'Lime bowl', ingredients: [{ name: 'Lime', quantity: '1' }], steps: ['Add lime'] } as never;
  const correctedScan = { id: 'scan-corrected', dishName: 'Lime bowl' } as never;
  const customize = { actionId: 'custom-completed', type: 'customize' as const, recipeId: 'recipe-stable', customizationText: 'add lime', status: 'completed' as const, correctedRecipe, correctedScan, createdAt: '2026-08-13T12:00:00.000Z' };
  let cookState = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: committedDraft(), freeRecipeConsumed: true, recipeId: 'recipe-stable', pendingPremiumAction: cook });
  cookState = onboardingV4Reducer(cookState, { type: 'SPLASH_FINISHED' });
  assert.equal(cookState.step, 'postPurchase');
  let customState = onboardingV4Reducer(at('splash'), { type: 'HYDRATE', draft: committedDraft(), freeRecipeConsumed: true, recipeId: 'recipe-stable', pendingPremiumAction: customize });
  customState = onboardingV4Reducer(customState, { type: 'SPLASH_FINISHED' });
  assert.equal(customState.step, 'recipe');
  assert.equal(customState.recipeId, 'recipe-stable');
});

test('completed customization resumption returns directly to the corrected recipe rather than an editor', () => {
  const action = { actionId: 'custom-completed', type: 'customize' as const, recipeId: 'recipe-stable', customizationText: 'add lime', status: 'completed' as const, correctedRecipe: { id: 'revision-1' } as never, correctedScan: { id: 'scan-1' } as never, createdAt: '2026-08-13T12:00:00.000Z' };
  const resumed = onboardingV4Reducer(at('postPurchase', { recipeId: 'recipe-stable', pendingPremiumAction: { ...action, status: 'destination_ready' } }), { type: 'PREMIUM_ACTION_RESUMED', action });
  assert.equal(resumed.step, 'recipe');
  assert.equal(resumed.recipeId, 'recipe-stable');
});
