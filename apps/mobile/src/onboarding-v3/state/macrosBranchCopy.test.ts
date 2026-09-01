import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMacrosDraft, type CalorieTrackingStatus, type MacroBarrierId, type MacroFocusId, type MacrosMealToImproveId } from './macrosBranch';
import {
  approachHeadline, barrierResponse, calorieInsightBody, focusInsightBody, mealInsightBody,
  planSummaryRows, proteinPreferenceLine, revealSummary, startingPointValue,
  MACRO_FOCUS_LABELS, MACRO_BARRIER_LABELS,
} from './macrosBranchCopy';

const FOCUSES: MacroFocusId[] = ['more_protein', 'fewer_calories', 'more_balanced_macros', 'better_workout_fuel', 'maintain', 'not_sure'];
const CALORIES: CalorieTrackingStatus[] = ['yes_has_target', 'sometimes', 'no', 'not_sure'];
const BARRIERS: MacroBarrierId[] = ['estimating_portions', 'getting_enough_protein', 'inaccurate_nutrition', 'doesnt_taste_good', 'meal_prep_time', 'staying_consistent', 'dont_know_targets'];
const MEALS: MacrosMealToImproveId[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'it_varies'];

const NO_MEDICAL = /lose weight|weight loss|BMI|diagnos|cure\b|recommended daily|deficit|guaranteed/i;

test('focus insight is distinct per focus and makes no medical claims', () => {
  const seen = new Set(FOCUSES.map(focusInsightBody));
  assert.equal(seen.size, FOCUSES.length);
  for (const s of seen) assert.doesNotMatch(s, NO_MEDICAL);
  assert.equal(focusInsightBody('more_protein'), 'We’ll keep protein front and center without turning every meal into a shake.');
  assert.equal(focusInsightBody(null), focusInsightBody('not_sure'));
});

test('calorie insight is distinct per status', () => {
  const seen = new Set(CALORIES.map(calorieInsightBody));
  assert.equal(seen.size, CALORIES.length);
  assert.equal(calorieInsightBody('no'), 'No problem—we’ll focus on protein and balance instead of a calorie count.');
});

test('barrier response is distinct per barrier and non-medical', () => {
  const seen = new Set<string>();
  for (const id of BARRIERS) {
    const { title, body } = barrierResponse(id);
    assert.ok(title.length > 0 && body.length > 0);
    assert.doesNotMatch(`${title} ${body}`, NO_MEDICAL);
    seen.add(title + body);
  }
  assert.equal(seen.size, BARRIERS.length);
  assert.deepEqual(barrierResponse('getting_enough_protein'), {
    title: 'We’ll make protein the easy default.',
    body: 'Okyo will lean toward protein-forward recipes and simple swaps that add grams.',
  });
});

test('meal insight is distinct per meal', () => {
  const seen = new Set(MEALS.map(mealInsightBody));
  assert.equal(seen.size, MEALS.length);
  assert.equal(mealInsightBody('dinner'), 'We’ll make dinner hit your targets without a lot of extra effort.');
});

test('approach headline changes with different answer combinations', () => {
  const a = approachHeadline({ macroFocus: 'more_protein', mealToImprove: 'dinner', trackingStyle: 'flexible_ranges' });
  const b = approachHeadline({ macroFocus: 'fewer_calories', mealToImprove: 'lunch', trackingStyle: 'simple_suggestions' });
  assert.notEqual(a, b);
  assert.equal(a, 'More protein at dinners, tracked in simple ranges.');
  assert.equal(b, 'Lighter lunches, with simple suggestions instead of math.');
  for (const s of [a, b]) assert.doesNotMatch(s, NO_MEDICAL);
});

test('reveal summary is a truthful three-part sentence built from the answers', () => {
  const draft = { macroFocus: 'more_protein' as const, macroBarrier: 'meal_prep_time' as const, mealToImprove: 'dinner' as const, trackingStyle: 'exact_numbers' as const };
  const summary = revealSummary(draft);
  assert.equal(summary, 'We’ll help you get more protein into your dinners, keep prep short, and show the exact grams when you want them.');
  assert.notEqual(summary, revealSummary({ ...draft, macroBarrier: 'staying_consistent' }));
  assert.doesNotMatch(summary, NO_MEDICAL);
});

test('starting-point value reflects the commitment and casing option', () => {
  const few = { macroFocus: 'more_protein' as const, mealToImprove: 'dinner' as const, flexibleCommitment: 'few_aligned_meals' as const };
  assert.equal(startingPointValue(few), 'More-protein dinners');
  assert.equal(startingPointValue(few, { lowercase: true }), 'more-protein dinners');
  assert.equal(startingPointValue({ ...few, flexibleCommitment: 'ease_in' as const }), 'Small steps toward your targets');
  assert.equal(startingPointValue({ ...few, flexibleCommitment: 'not_sure' as const }), 'Small steps toward your targets');
});

test('protein preference line is a preference, never advice', () => {
  assert.equal(proteinPreferenceLine({ proteinTargetGrams: 195 }), '195g protein a day');
  assert.equal(proteinPreferenceLine({ proteinTargetGrams: null }), 'Protein kept flexible');
});

test('plan summary rows reflect real answers and cap at three', () => {
  const rows = planSummaryRows({ macroFocus: 'more_protein', macroBarrier: 'estimating_portions', mealToImprove: 'lunch', trackingStyle: 'exact_numbers' });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.value), [MACRO_FOCUS_LABELS.more_protein, MACRO_BARRIER_LABELS.estimating_portions, 'Lunch']);
  const noMeal = planSummaryRows({ macroFocus: 'more_protein', macroBarrier: 'estimating_portions', mealToImprove: null, trackingStyle: 'flexible_ranges' });
  assert.equal(noMeal[2].value, 'Flexible ranges');
  assert.deepEqual(planSummaryRows(initialMacrosDraft), []);
});
