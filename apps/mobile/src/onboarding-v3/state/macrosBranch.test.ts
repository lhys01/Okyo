import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateProteinPreferenceGrams, initialMacrosDraft, MACROS_QUESTION_STEPS, MACROS_STEPS,
  macrosReducer, normalizeMacrosDraft, routeForMacrosDraft,
} from './macrosBranch';

test('the eighteen ordered steps end at the completion handoff', () => {
  assert.deepEqual([...MACROS_STEPS], [
    'intro', 'focus', 'focusInsight', 'proteinWeight', 'proteinPreference', 'calorieCheck',
    'calorieInsight', 'barrier', 'barrierResponse', 'mealToImprove', 'mealInsight', 'trackingStyle',
    'reassurance', 'approach', 'whatOkyoDoes', 'commitment', 'reveal', 'complete',
  ]);
  assert.deepEqual([...MACROS_QUESTION_STEPS], ['focus', 'proteinWeight', 'calorieCheck', 'barrier', 'mealToImprove', 'trackingStyle', 'commitment']);
  assert.equal(initialMacrosDraft.currentStep, 'intro');
});

test('an empty draft routes to focus and Next advances one step at a time', () => {
  assert.equal(routeForMacrosDraft(initialMacrosDraft), 'focus');
  let state = macrosReducer(initialMacrosDraft, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'focus');
  state = macrosReducer(state, { type: 'FOCUS_SELECTED', focus: 'more_protein' });
  state = macrosReducer(state, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'focusInsight');
  state = macrosReducer(state, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'proteinWeight');
});

test('body weight protein preferences calculate consistently for pounds and kilograms', () => {
  assert.equal(calculateProteinPreferenceGrams(150, 'lb', 1), 150);
  assert.equal(calculateProteinPreferenceGrams(150, 'lb', 1.3), 195);
  assert.equal(calculateProteinPreferenceGrams(150, 'lb', 1.6), 240);
  assert.equal(calculateProteinPreferenceGrams(70, 'kg', 1.3), 201);
});

test('known and skipped body weight paths keep protein data honest', () => {
  let known = macrosReducer({ ...initialMacrosDraft, macroFocus: 'more_protein', currentStep: 'proteinWeight' }, { type: 'BODY_WEIGHT_SAVED', weight: 150, unit: 'lb' });
  known = macrosReducer(known, { type: 'NEXT_PRESSED' });
  assert.equal(known.currentStep, 'proteinPreference');
  known = macrosReducer(known, { type: 'PROTEIN_MULTIPLIER_SELECTED', multiplier: 1.3 });
  assert.equal(known.proteinTargetGrams, 195);
  const skipped = macrosReducer({ ...initialMacrosDraft, macroFocus: 'more_protein', currentStep: 'proteinWeight' }, { type: 'BODY_WEIGHT_SKIPPED' });
  assert.equal(skipped.proteinTargetGrams, null);
  assert.equal(skipped.proteinTargetStatus, 'not_sure');
  assert.equal(macrosReducer(skipped, { type: 'NEXT_PRESSED' }).currentStep, 'calorieCheck');
});

test('weight validation rejects implausible values without fabricating a target', () => {
  const state = macrosReducer(initialMacrosDraft, { type: 'BODY_WEIGHT_SAVED', weight: 10, unit: 'lb' });
  assert.equal(state.bodyWeight, null);
  assert.equal(state.proteinTargetGrams, null);
});

test('every question answer is represented in the draft immediately', () => {
  let state = macrosReducer(initialMacrosDraft, { type: 'FOCUS_SELECTED', focus: 'fewer_calories' });
  state = macrosReducer(state, { type: 'BODY_WEIGHT_SKIPPED' });
  state = macrosReducer(state, { type: 'CALORIE_STATUS_SELECTED', status: 'sometimes' });
  state = macrosReducer(state, { type: 'BARRIER_SELECTED', barrier: 'meal_prep_time' });
  state = macrosReducer(state, { type: 'MEAL_TO_IMPROVE_SELECTED', meal: 'dinner' });
  state = macrosReducer(state, { type: 'TRACKING_STYLE_SELECTED', style: 'flexible_ranges' });
  state = macrosReducer(state, { type: 'COMMITMENT_SELECTED', commitment: 'most_days' });
  assert.deepEqual(
    [state.macroFocus, state.proteinTargetStatus, state.calorieTrackingStatus, state.macroBarrier, state.mealToImprove, state.trackingStyle, state.flexibleCommitment],
    ['fewer_calories', 'not_sure', 'sometimes', 'meal_prep_time', 'dinner', 'flexible_ranges', 'most_days'],
  );
});

test('resume routing lands on the earliest unanswered question', () => {
  const base = { ...initialMacrosDraft, macroFocus: 'more_protein' as const, proteinTargetStatus: 'not_sure' as const };
  assert.equal(routeForMacrosDraft(base), 'calorieCheck');
  assert.equal(routeForMacrosDraft({ ...base, calorieTrackingStatus: 'no' }), 'barrier');
  assert.equal(routeForMacrosDraft({ ...base, calorieTrackingStatus: 'no', macroBarrier: 'estimating_portions' }), 'mealToImprove');
  assert.equal(routeForMacrosDraft({ ...base, calorieTrackingStatus: 'no', macroBarrier: 'estimating_portions', mealToImprove: 'lunch' }), 'trackingStyle');
  assert.equal(routeForMacrosDraft({ ...base, calorieTrackingStatus: 'no', macroBarrier: 'estimating_portions', mealToImprove: 'lunch', trackingStyle: 'exact_numbers' }), 'commitment');
  assert.equal(routeForMacrosDraft({ ...base, calorieTrackingStatus: 'no', macroBarrier: 'estimating_portions', mealToImprove: 'lunch', trackingStyle: 'exact_numbers', flexibleCommitment: 'ease_in' }), 'reveal');
});

test('legacy step ids are remapped on hydrate', () => {
  assert.equal(normalizeMacrosDraft({ version: 2, currentStep: 'bodyWeight', macroFocus: 'more_protein' }).currentStep, 'proteinWeight');
  assert.equal(normalizeMacrosDraft({ version: 2, currentStep: 'calorieTracking', macroFocus: 'more_protein', proteinTargetStatus: 'not_sure' }).currentStep, 'calorieCheck');
  assert.equal(normalizeMacrosDraft({ version: 1, currentStep: 'acknowledgment', macroFocus: 'more_protein' }).currentStep, 'proteinWeight');
  assert.equal(normalizeMacrosDraft({ version: 1, currentStep: 'intro' }).currentStep, 'focus');
});

test('a persisted transient beat is restored as-is', () => {
  const answered = {
    version: 2 as const, macroFocus: 'more_protein' as const, proteinTargetStatus: 'not_sure' as const,
    calorieTrackingStatus: 'no' as const, macroBarrier: 'staying_consistent' as const, mealToImprove: 'dinner' as const,
    trackingStyle: 'exact_numbers' as const, flexibleCommitment: 'few_aligned_meals' as const,
  };
  for (const step of ['focusInsight', 'calorieInsight', 'barrierResponse', 'mealInsight', 'reassurance', 'approach', 'whatOkyoDoes', 'reveal'] as const) {
    assert.equal(normalizeMacrosDraft({ ...answered, currentStep: step }).currentStep, step);
  }
});

test('back navigation preserves valid answers', () => {
  const known = { ...initialMacrosDraft, currentStep: 'proteinPreference' as const, macroFocus: 'more_protein' as const, bodyWeight: 150, proteinMultiplier: 1.3 as const, proteinTargetStatus: 'yes_know_it' as const, proteinTargetGrams: 195 };
  assert.equal(macrosReducer(known, { type: 'BACK_PRESSED' }).currentStep, 'proteinWeight');
  const skipped = { ...initialMacrosDraft, currentStep: 'calorieCheck' as const, macroFocus: 'more_protein' as const, proteinTargetStatus: 'not_sure' as const };
  assert.equal(macrosReducer(skipped, { type: 'BACK_PRESSED' }).currentStep, 'proteinWeight');
});

test('completion is stable and Back returns to reveal', () => {
  const complete = macrosReducer({ ...initialMacrosDraft, currentStep: 'reveal' }, { type: 'BRANCH_COMPLETED' });
  assert.equal(complete.currentStep, 'complete');
  assert.equal(complete.branchCompleted, true);
  assert.equal(macrosReducer(complete, { type: 'BACK_PRESSED' }).currentStep, 'reveal');
  assert.equal(normalizeMacrosDraft(complete).currentStep, 'complete');
});

test('retained legacy events still update the draft without breaking the flow', () => {
  const state = macrosReducer(initialMacrosDraft, { type: 'FREQUENCY_SAVED', count: 6 });
  assert.equal(state.weeklyCookingCount, 6);
  assert.equal(macrosReducer(initialMacrosDraft, { type: 'FREQUENCY_SAVED', count: 30 }).weeklyCookingCount, null);
  assert.equal(state.currentStep, 'intro');
});

test('invalid hydrated forward steps recover to the earliest valid route', () => {
  assert.equal(normalizeMacrosDraft({ version: 2, currentStep: 'complete', macroFocus: 'more_protein' }).currentStep, 'proteinWeight');
});
