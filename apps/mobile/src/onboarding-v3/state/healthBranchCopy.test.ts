import test from 'node:test';
import assert from 'node:assert/strict';
import { initialHealthDraft, type HealthBarrierId, type HealthDefinitionId, type MealToImproveId } from './healthBranch';
import {
  approachHeadline,
  barrierResponse,
  meaningInsightBody,
  mealInsightBody,
  planSummaryRows,
  revealSummary,
  startingPointValue,
  HEALTH_DEFINITION_LABELS,
  HEALTH_BARRIER_LABELS,
} from './healthBranchCopy';

const DEFINITIONS: HealthDefinitionId[] = ['more_balanced_meals', 'more_whole_foods', 'more_vegetables_fruit', 'more_energy', 'better_portions', 'less_takeout', 'something_else'];
const BARRIERS: HealthBarrierId[] = ['not_enough_time', 'too_expensive', 'dont_know_what_to_cook', 'feels_boring', 'struggle_consistency', 'too_hungry_tired', 'something_else'];
const MEALS: MealToImproveId[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'it_varies'];

const NO_MEDICAL = /lose weight|weight loss|BMI|diagnos|cure\b|calorie target|deficit|guaranteed/i;

test('the meaning insight is distinct per definition and matches the spec strings', () => {
  const seen = new Set<string>();
  for (const id of DEFINITIONS) {
    const body = meaningInsightBody(id);
    assert.ok(body.length > 0);
    assert.doesNotMatch(body, NO_MEDICAL);
    seen.add(body);
  }
  assert.equal(seen.size, DEFINITIONS.length);
  assert.equal(meaningInsightBody('more_balanced_meals'), 'We’ll help you build meals that feel satisfying and well-rounded.');
  assert.equal(meaningInsightBody('less_takeout'), 'We’ll find easy homemade options for the meals you usually order.');
  assert.equal(meaningInsightBody(null), meaningInsightBody('something_else'));
});

test('the barrier response is distinct per barrier and matches the spec strings', () => {
  const seen = new Set<string>();
  for (const id of BARRIERS) {
    const { title, body } = barrierResponse(id);
    assert.ok(title.length > 0 && body.length > 0);
    assert.doesNotMatch(`${title} ${body}`, NO_MEDICAL);
    seen.add(title + body);
  }
  assert.equal(seen.size, BARRIERS.length);
  assert.deepEqual(barrierResponse('not_enough_time'), {
    title: 'We’ll keep it practical.',
    body: 'Okyo will prioritize simple recipes, shorter prep, and meals that fit busy days.',
  });
  assert.deepEqual(barrierResponse('too_expensive'), {
    title: 'Healthy does not have to be expensive.',
    body: 'We’ll look for affordable ingredients and flexible recipes that make sense for your budget.',
  });
});

test('the meal insight is distinct per meal and matches the spec strings', () => {
  const seen = new Set(MEALS.map(mealInsightBody));
  assert.equal(seen.size, MEALS.length);
  assert.equal(mealInsightBody('dinner'), 'We’ll make dinner feel more balanced without making it feel like work.');
  assert.equal(mealInsightBody('it_varies'), 'We’ll keep the plan flexible so it can work across your whole day.');
});

test('the approach headline changes with different answer combinations', () => {
  const a = approachHeadline({ healthDefinition: 'more_balanced_meals', healthBarrier: 'not_enough_time', mealToImprove: 'dinner', foodStyles: [] });
  const b = approachHeadline({ healthDefinition: 'more_whole_foods', healthBarrier: 'struggle_consistency', mealToImprove: 'breakfast', foodStyles: [] });
  const c = approachHeadline({ healthDefinition: 'something_else', healthBarrier: 'something_else', mealToImprove: 'lunch', foodStyles: ['comfort_food'] });
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.match(a, /^More balanced dinners, without complicated recipes\.$/);
  assert.match(c, /without giving up comfort food\.$/);
  for (const s of [a, b, c]) assert.doesNotMatch(s, NO_MEDICAL);
});

test('the reveal summary is a truthful three-part sentence built from the answers', () => {
  const draft = { healthDefinition: 'more_balanced_meals' as const, healthBarrier: 'not_enough_time' as const, mealToImprove: 'dinner' as const, foodStyles: ['comfort_food' as const] };
  const summary = revealSummary(draft);
  assert.match(summary, /^We’ll help you make more balanced dinners, keep things practical when time is tight, and keep room for the comfort food you love\.$/);
  assert.notEqual(summary, revealSummary({ ...draft, healthBarrier: 'too_expensive' }));
  assert.doesNotMatch(summary, NO_MEDICAL);
});

test('the starting-point value reflects the commitment and casing option', () => {
  const few = { healthDefinition: 'more_balanced_meals' as const, mealToImprove: 'dinner' as const, flexibleCommitment: 'few_meals_weekly' as const };
  assert.equal(startingPointValue(few), 'More balanced dinners');
  assert.equal(startingPointValue(few, { lowercase: true }), 'more balanced dinners');
  const gradual = { ...few, flexibleCommitment: 'improve_gradually' as const };
  assert.equal(startingPointValue(gradual), 'Small changes that fit your routine');
  assert.equal(startingPointValue({ ...few, flexibleCommitment: 'not_sure' as const }), 'Small changes that fit your routine');
});

test('the plan summary rows reflect real answers and cap at three', () => {
  const rows = planSummaryRows({ healthDefinition: 'more_whole_foods', healthBarrier: 'feels_boring', mealToImprove: 'lunch', foodStyles: ['fresh_colorful'] });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.value), [
    HEALTH_DEFINITION_LABELS.more_whole_foods,
    HEALTH_BARRIER_LABELS.feels_boring,
    'Lunch',
  ]);
  const noMeal = planSummaryRows({ healthDefinition: 'more_whole_foods', healthBarrier: 'feels_boring', mealToImprove: null, foodStyles: ['fresh_colorful', 'high_protein'] });
  assert.equal(noMeal[2].value, 'Fresh and colorful, High-protein meals');
  assert.deepEqual(planSummaryRows(initialHealthDraft), []);
});
