import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH_QUESTION_STEPS,
  HEALTH_STEPS,
  healthReducer,
  initialHealthDraft,
  normalizeHealthDraft,
  routeForHealthDraft,
} from './healthBranch';
import { createHealthBranchPersistence } from './healthBranchPersistence';

test('the fourteen ordered steps end at the completion handoff', () => {
  assert.deepEqual([...HEALTH_STEPS], [
    'intro', 'meaning', 'meaningInsight', 'barrier', 'barrierResponse', 'mealToImprove',
    'mealInsight', 'foodStyle', 'reassurance', 'approach', 'whatOkyoDoes', 'commitment',
    'reveal', 'complete',
  ]);
  assert.deepEqual([...HEALTH_QUESTION_STEPS], ['meaning', 'barrier', 'mealToImprove', 'foodStyle', 'commitment']);
});

test('an empty draft routes to intro and Next advances one step at a time', () => {
  assert.equal(routeForHealthDraft(initialHealthDraft), 'intro');
  let state = healthReducer(initialHealthDraft, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'meaning');
  state = healthReducer(state, { type: 'DEFINITION_SELECTED', definition: 'more_balanced_meals' });
  state = healthReducer(state, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'meaningInsight');
  state = healthReducer(state, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'barrier');
});

test('every question answer is represented in the draft immediately', () => {
  let state = healthReducer(initialHealthDraft, { type: 'DEFINITION_SELECTED', definition: 'more_vegetables_fruit' });
  state = healthReducer(state, { type: 'BARRIER_SELECTED', barrier: 'not_enough_time' });
  state = healthReducer(state, { type: 'MEAL_TO_IMPROVE_SELECTED', meal: 'dinner' });
  state = healthReducer(state, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'comfort_food' });
  state = healthReducer(state, { type: 'COMMITMENT_SELECTED', commitment: 'small_changes_daily' });
  assert.deepEqual(
    [state.healthDefinition, state.healthBarrier, state.mealToImprove, state.foodStyles, state.flexibleCommitment],
    ['more_vegetables_fruit', 'not_enough_time', 'dinner', ['comfort_food'], 'small_changes_daily'],
  );
});

test('food styles are multi-select and "a little bit of everything" is exclusive', () => {
  let state = healthReducer(initialHealthDraft, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'comfort_food' });
  state = healthReducer(state, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'high_protein' });
  assert.deepEqual(state.foodStyles, ['comfort_food', 'high_protein']);
  state = healthReducer(state, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'a_bit_of_everything' });
  assert.deepEqual(state.foodStyles, ['a_bit_of_everything']);
  state = healthReducer(state, { type: 'FOOD_STYLE_TOGGLED', foodStyle: 'quick_simple' });
  assert.deepEqual(state.foodStyles, ['quick_simple']);
});

test('legacy answer ids from the previous preview are remapped on hydrate', () => {
  const draft = normalizeHealthDraft({
    version: 1,
    healthDefinition: 'more_vegetables',
    healthBarrier: 'cost',
    foodStyles: ['pasta_and_noodles', 'global_flavors'],
  });
  assert.equal(draft.healthDefinition, 'more_vegetables_fruit');
  assert.equal(draft.healthBarrier, 'too_expensive');
  assert.deepEqual(draft.foodStyles, ['comfort_food', 'international']);
});

test('unknown versions and malformed fields fall back safely', () => {
  assert.deepEqual(normalizeHealthDraft(null), initialHealthDraft);
  assert.deepEqual(normalizeHealthDraft('nope'), initialHealthDraft);
  assert.equal(normalizeHealthDraft({ version: 9 }).currentStep, 'intro');
  const draft = normalizeHealthDraft({ version: 1, healthDefinition: 'not_real', healthBarrier: 'not_enough_time', foodStyles: 'nope', mealToImprove: 'dinner' });
  assert.equal(draft.healthDefinition, null);
  assert.equal(draft.healthBarrier, 'not_enough_time');
  assert.deepEqual(draft.foodStyles, []);
  assert.equal(draft.mealToImprove, 'dinner');
});

test('resume routing lands on the earliest unanswered question', () => {
  assert.equal(routeForHealthDraft({ ...initialHealthDraft, healthDefinition: 'more_energy' }), 'barrier');
  assert.equal(routeForHealthDraft({ ...initialHealthDraft, healthDefinition: 'more_energy', healthBarrier: 'feels_boring' }), 'mealToImprove');
  assert.equal(routeForHealthDraft({ ...initialHealthDraft, healthDefinition: 'more_energy', healthBarrier: 'feels_boring', mealToImprove: 'lunch' }), 'foodStyle');
  assert.equal(routeForHealthDraft({ ...initialHealthDraft, healthDefinition: 'more_energy', healthBarrier: 'feels_boring', mealToImprove: 'lunch', foodStyles: ['quick_simple'] }), 'commitment');
  assert.equal(routeForHealthDraft({ ...initialHealthDraft, healthDefinition: 'more_energy', healthBarrier: 'feels_boring', mealToImprove: 'lunch', foodStyles: ['quick_simple'], flexibleCommitment: 'not_sure' }), 'reveal');
});

test('a persisted transient (non-question) step is restored as-is', () => {
  const answered = { version: 1 as const, healthDefinition: 'more_whole_foods' as const, healthBarrier: 'too_expensive' as const, mealToImprove: 'dinner' as const, foodStyles: ['comfort_food' as const], flexibleCommitment: 'improve_gradually' as const };
  for (const step of ['meaningInsight', 'barrierResponse', 'mealInsight', 'reassurance', 'approach', 'whatOkyoDoes', 'reveal'] as const) {
    assert.equal(normalizeHealthDraft({ ...answered, currentStep: step }).currentStep, step);
  }
});

test('back navigation preserves valid answers', () => {
  const state = healthReducer(
    { ...initialHealthDraft, currentStep: 'barrier', healthDefinition: 'more_whole_foods', healthBarrier: 'too_expensive' },
    { type: 'BACK_PRESSED' },
  );
  assert.equal(state.currentStep, 'meaningInsight');
  assert.equal(state.healthDefinition, 'more_whole_foods');
  assert.equal(state.healthBarrier, 'too_expensive');
});

test('completion is stable and a backed reveal keeps answers', () => {
  const answers = { version: 1 as const, healthDefinition: 'more_balanced_meals' as const, healthBarrier: 'struggle_consistency' as const, mealToImprove: 'dinner' as const, foodStyles: ['comfort_food' as const], flexibleCommitment: 'few_meals_weekly' as const };
  const completed = normalizeHealthDraft({ ...answers, currentStep: 'complete', branchCompleted: true });
  assert.equal(completed.currentStep, 'complete');
  assert.equal(completed.branchCompleted, true);
  const backed = healthReducer(completed, { type: 'BACK_PRESSED' });
  assert.equal(backed.currentStep, 'reveal');
  assert.equal(backed.branchCompleted, true);
  assert.equal(healthReducer(backed, { type: 'BRANCH_COMPLETED' }).currentStep, 'complete');
});

test('a completed snapshot routes to complete unless it was explicitly backed to reveal', () => {
  const answers = { version: 1, branchCompleted: true, healthDefinition: 'more_energy', healthBarrier: 'feels_boring', mealToImprove: 'lunch', foodStyles: ['quick_simple'], flexibleCommitment: 'not_sure' };
  assert.equal(routeForHealthDraft(normalizeHealthDraft({ ...answers, currentStep: 'complete' })), 'complete');
  assert.equal(routeForHealthDraft(normalizeHealthDraft({ ...answers, currentStep: 'reveal' })), 'reveal');
});

test('retained legacy events still update the draft without breaking the flow', () => {
  let state = healthReducer(initialHealthDraft, { type: 'FREQUENCY_SAVED', count: 5 });
  assert.equal(state.weeklyCookingCount, 5);
  assert.equal(healthReducer(initialHealthDraft, { type: 'FREQUENCY_SAVED', count: 30 }).weeklyCookingCount, null);
  state = healthReducer(state, { type: 'TRADEOFF_SELECTED', tradeoff: 'sometimes' });
  assert.equal(state.favoriteFoodTradeoff, 'sometimes');
  state = healthReducer(state, { type: 'DEALBREAKER_SELECTED', dealbreaker: 'bland' });
  assert.equal(state.recipeDealbreaker, 'bland');
  assert.equal(state.currentStep, 'intro');
});

test('answers survive a persistence round-trip until an explicit Next', async () => {
  const cases = [
    { step: 'meaning' as const, draft: { ...initialHealthDraft, currentStep: 'meaning' as const }, event: { type: 'DEFINITION_SELECTED' as const, definition: 'more_whole_foods' as const }, read: (s: ReturnType<typeof healthReducer>) => s.healthDefinition, next: 'meaningInsight' as const },
    { step: 'barrier' as const, draft: { ...initialHealthDraft, currentStep: 'barrier' as const, healthDefinition: 'more_whole_foods' as const }, event: { type: 'BARRIER_SELECTED' as const, barrier: 'too_expensive' as const }, read: (s: ReturnType<typeof healthReducer>) => s.healthBarrier, next: 'barrierResponse' as const },
    { step: 'mealToImprove' as const, draft: { ...initialHealthDraft, currentStep: 'mealToImprove' as const, healthDefinition: 'more_whole_foods' as const, healthBarrier: 'too_expensive' as const }, event: { type: 'MEAL_TO_IMPROVE_SELECTED' as const, meal: 'dinner' as const }, read: (s: ReturnType<typeof healthReducer>) => s.mealToImprove, next: 'mealInsight' as const },
    { step: 'foodStyle' as const, draft: { ...initialHealthDraft, currentStep: 'foodStyle' as const, healthDefinition: 'more_whole_foods' as const, healthBarrier: 'too_expensive' as const, mealToImprove: 'dinner' as const }, event: { type: 'FOOD_STYLE_TOGGLED' as const, foodStyle: 'comfort_food' as const }, read: (s: ReturnType<typeof healthReducer>) => s.foodStyles[0], next: 'reassurance' as const },
    { step: 'commitment' as const, draft: { ...initialHealthDraft, currentStep: 'commitment' as const, healthDefinition: 'more_whole_foods' as const, healthBarrier: 'too_expensive' as const, mealToImprove: 'dinner' as const, foodStyles: ['comfort_food' as const] }, event: { type: 'COMMITMENT_SELECTED' as const, commitment: 'few_meals_weekly' as const }, read: (s: ReturnType<typeof healthReducer>) => s.flexibleCommitment, next: 'reveal' as const },
  ] as const;
  for (const testCase of cases) {
    const state = healthReducer({ ...testCase.draft, foodStyles: [...testCase.draft.foodStyles] }, testCase.event);
    const values = new Map<string, string>();
    const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
    await createHealthBranchPersistence(storage).write(state);
    const restored = await createHealthBranchPersistence(storage).read();
    assert.equal(restored.currentStep, testCase.step);
    assert.equal(testCase.read(restored), testCase.read(state));
    assert.equal(healthReducer(restored, { type: 'NEXT_PRESSED' }).currentStep, testCase.next);
  }
});
