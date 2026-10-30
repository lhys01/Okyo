import test from 'node:test';
import assert from 'node:assert/strict';
import { HEALTH_STEPS, HEALTH_QUESTION_STEPS, HEALTH_PROGRESS_QUESTION_INDEX, healthReducer, initialHealthDraft, normalizeHealthDraft, type HealthDraft, type HealthEvent } from './healthBranch';

const answers: HealthEvent[] = [
  { type: 'PROBLEM_SELECTED', problem: 'too_much_takeout' }, { type: 'BARRIER_SELECTED', barrier: 'not_enough_time' },
  { type: 'MEAL_TO_IMPROVE_SELECTED', meal: 'dinner' },
  { type: 'DEFINITION_SELECTED', definition: 'less_takeout' }, { type: 'MEAL_PRIORITY_SELECTED', priority: 'tastes_good' },
  { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'comfort_food' }, { type: 'COMMITMENT_SELECTED', commitment: 'one_meal_daily' },
];
const filled = answers.reduce(healthReducer, initialHealthDraft);

test('Health branch skips two acknowledgements and the unused cooking-frequency question', () => {
  assert.deepEqual(HEALTH_STEPS, ['intro', 'problem', 'barrier', 'mealToImprove', 'meaning', 'mealPriority', 'foodStyle', 'commitment', 'goal', 'solutionValue', 'reveal', 'complete']);
  assert.deepEqual(HEALTH_QUESTION_STEPS, ['problem', 'barrier', 'mealToImprove', 'meaning', 'mealPriority', 'foodStyle', 'commitment']);
  assert.equal(new Set(HEALTH_STEPS.map(s => s === 'complete' ? 'reveal' : s)).size, 11);
});
test('progress is the current question index and freezes on interstitials', () => {
  assert.deepEqual(HEALTH_STEPS.map(s => HEALTH_PROGRESS_QUESTION_INDEX[s]), [0, 1, 2, 3, 4, 5, 6, 7, 7, 7, 7, 7]);
});
test('full flow preserves every answer and every new draft resume position', () => {
  let draft = { ...initialHealthDraft };
  let question = 0;
  for (const step of HEALTH_STEPS) {
    assert.equal(draft.currentStep, step);
    assert.equal(normalizeHealthDraft(JSON.parse(JSON.stringify(draft))).currentStep, step);
    if (step === 'goal') draft = healthReducer(draft, { type: 'HEALTH_GOAL_TYPE_SELECTED', goalType: 'healthier_meals' });
    if (step === 'solutionValue') {
      draft = healthReducer(draft, { type: 'HEALTH_GOAL_TARGET_CHANGED', value: 7 });
      draft = healthReducer(draft, { type: 'HEALTH_GOAL_DURATION_CHANGED', value: 3 });
    }
    if (HEALTH_QUESTION_STEPS.includes(step)) {
      draft = healthReducer(draft, answers[question++]);
      assert.deepEqual(normalizeHealthDraft(draft), draft);
    }
    if (step === 'reveal') draft = healthReducer(draft, { type: 'BRANCH_COMPLETED' });
    else draft = healthReducer(draft, { type: 'NEXT_PRESSED' });
  }
  assert.equal(draft.branchCompleted, true);
  for (const key of ['healthProblem', 'healthBarrier', 'mealToImprove', 'cookingFrequency', 'healthDefinition', 'mealPriority', 'foodStyles', 'flexibleCommitment'] as const) assert.deepEqual(draft[key], filled[key]);
});
test('Back from each screen preserves answers and returns to the prior screen', () => {
  for (let i = 1; i < HEALTH_STEPS.length; i++) {
    const draft = { ...filled, currentStep: HEALTH_STEPS[i] };
    const back = healthReducer(draft, { type: 'BACK_PRESSED' });
    assert.equal(back.currentStep, HEALTH_STEPS[i - 1]);
    assert.deepEqual({ ...back, currentStep: draft.currentStep }, draft);
  }
});
test('missing prerequisites cannot be bypassed by a later persisted route', () => {
  const fields = ['healthProblem', 'healthBarrier', 'mealToImprove', 'healthDefinition', 'mealPriority', 'foodStyles', 'flexibleCommitment'] as const;
  fields.forEach((field, i) => {
    assert.equal(normalizeHealthDraft({ ...filled, currentStep: 'reveal', [field]: field === 'foodStyles' ? [] : null }).currentStep, HEALTH_QUESTION_STEPS[i]);
  });
});
test('legacy cooking-frequency answers survive hydration while retired routes resume at the next live screen', () => {
  const legacy = { ...initialHealthDraft, healthProblem: 'too_much_takeout' as const, healthBarrier: 'not_enough_time' as const, mealToImprove: 'dinner' as const, currentStep: 'problemDiagnosis' as const, cookingFrequency: 'one_to_two_week' as const };
  const restored = normalizeHealthDraft(legacy);
  assert.equal(restored.cookingFrequency, 'one_to_two_week');
  assert.equal(restored.currentStep, 'meaning');
  assert.equal(normalizeHealthDraft({ ...legacy, currentStep: 'cookingFrequency' }).currentStep, 'meaning');
});
test('food styles are multi-select with an exclusive everything choice', () => {
  let state = healthReducer(filled, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'high_protein' });
  assert.deepEqual(state.foodStyles, ['comfort_food', 'high_protein']);
  state = healthReducer(state, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'a_bit_of_everything' });
  assert.deepEqual(state.foodStyles, ['a_bit_of_everything']);
  state = healthReducer(state, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'quick_simple' });
  assert.deepEqual(state.foodStyles, ['quick_simple']);
});
test('malformed values, removed choices, and unknown versions normalize safely', () => {
  for (const raw of [null, 'nope', { version: 9 }]) assert.deepEqual(normalizeHealthDraft(raw), initialHealthDraft);
  const draft = normalizeHealthDraft({ version: 1, healthProblem: {}, cookingFrequency: 4, mealPriority: 'nope', healthDefinition: 'something_else', healthBarrier: 'something_else', flexibleCommitment: 'not_sure', foodStyles: 'bad' });
  assert.deepEqual(draft, initialHealthDraft);
});
test('legacy answer mappings and deprecated fields remain supported', () => {
  const draft = normalizeHealthDraft({ version: 1, healthDefinition: 'more_vegetables', healthBarrier: 'cost', foodStyles: ['pasta_and_noodles', 'global_flavors'] });
  assert.equal(draft.healthDefinition, 'more_vegetables_fruit');
  assert.equal(draft.healthBarrier, 'too_expensive');
  assert.deepEqual(draft.foodStyles, ['comfort_food', 'international']);
  let state: HealthDraft = healthReducer(initialHealthDraft, { type: 'FREQUENCY_SAVED', count: 5 });
  state = healthReducer(state, { type: 'TRADEOFF_SELECTED', tradeoff: 'sometimes' });
  state = healthReducer(state, { type: 'DEALBREAKER_SELECTED', dealbreaker: 'bland' });
  assert.deepEqual([state.weeklyCookingCount, state.favoriteFoodTradeoff, state.recipeDealbreaker], [5, 'sometimes', 'bland']);
});
