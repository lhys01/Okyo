import assert from 'node:assert/strict';
import test from 'node:test';
import { addLocalDays, createHealthGoal, createMacrosGoal, createSavingsGoal, normalizeOnboardingGoal } from './onboardingGoal';
import { healthReducer, initialHealthDraft, normalizeHealthDraft } from './healthBranch';
import { macrosReducer, initialMacrosDraft, normalizeMacrosDraft } from './macrosBranch';
import { initialSaveMoneyDraft, normalizeSaveMoneyDraft, saveMoneyReducer } from './saveMoneyBranch';

test('goal dates use local calendar arithmetic', () => {
  assert.equal(addLocalDays('2026-09-20', 14), '2026-10-04');
  assert.equal(createHealthGoal('One healthier meal a day', 1, 14, '2026-09-20').targetDate, '2026-10-04');
  const macroGoal = createMacrosGoal(5, 4, '2026-09-20');
  assert.equal(macroGoal.targetDate, '2026-10-18');
  assert.equal(macroGoal.targetValue, 5);
  assert.equal(macroGoal.targetUnit, 'days_per_week');
});

test('savings goal estimates a conservative checkpoint from weekly savings', () => {
  const goal = createSavingsGoal(50000, 2500, '2026-09-20');
  assert.equal(goal.targetDate, '2027-02-07');
  assert.equal(goal.estimatedWeeklySavingsCents, 2500);
  assert.equal(createSavingsGoal(10000, 3000, '2026-09-20').targetDate, '2026-10-14');
});

test('savings branch derives its internal goal from the routine instead of asking for an amount', () => {
  const state = saveMoneyReducer({ ...initialSaveMoneyDraft, weeklyEatingOutCount: 3, eatingOutCostCents: 2000, weeklyReplacementTarget: 2 }, { type: 'COST_SAVED', cents: 2000 });
  assert.equal(state.goal?.displayTitle, 'Save $1,456');
  assert.equal(state.goal?.estimatedWeeklySavingsCents, 2800);
  assert.equal(state.savingsGoalAmountCents, 145600);
});

test('goal normalization rejects malformed values and preserves valid goals', () => {
  assert.equal(normalizeOnboardingGoal({ goalBranch: 'eat_healthier' }), null);
  const goal = createMacrosGoal(5, 4, '2026-09-20');
  assert.deepEqual(normalizeOnboardingGoal(goal), goal);
});

test('each branch stores its selected objective in the persisted draft shape', () => {
  const health = healthReducer({ ...initialHealthDraft, mealToImprove: 'breakfast', currentStep: 'goal' }, { type: 'HEALTH_GOAL_SELECTED', goal: 'one_daily' });
  assert.equal(health.goal?.goalBranch, 'eat_healthier');
  const macros = macrosReducer({ ...initialMacrosDraft, currentStep: 'goal', flexibleCommitment: 'weekly_rhythm' }, { type: 'MACRO_GOAL_SELECTED', goal: 'macro_five' });
  assert.equal(macros.goal?.targetDate, addLocalDays(macros.goal!.startDate, 28));
  const savings = saveMoneyReducer({ ...initialSaveMoneyDraft, weeklyEatingOutCount: 3, eatingOutCostCents: 2000, weeklyReplacementTarget: 2 }, { type: 'COST_SAVED', cents: 2000 });
  assert.equal(savings.goal?.targetValue, 145600);
});

test('health goal copy stays grammatical when no meal is selected', () => {
  const health = healthReducer({ ...initialHealthDraft, currentStep: 'goal', flexibleCommitment: 'one_change_at_a_time' }, { type: 'HEALTH_GOAL_SELECTED', goal: 'one_daily' });
  assert.equal(health.goal?.displayTitle, 'One healthier meal a day');
});

test('expanded health goals keep measurable timeline data', () => {
  const cases = [
    ['four_week', 4, 'meals_per_week', 28],
    ['two_takeout', 2, 'takeout_meals_per_week', 28],
    ['cook_home_three', 3, 'meals_per_week', 28],
    ['whole_foods_daily', 1, 'meal_per_day', 21],
    ['healthier_breakfast_four', 4, 'meals_per_week', 28],
    ['balanced_meals_five', 5, 'meals_per_week', 28],
    ['small_change_daily', 1, 'change_per_day', 14],
  ] as const;
  for (const [id, targetValue, targetUnit, durationDays] of cases) {
    const state = healthReducer({ ...initialHealthDraft, currentStep: 'goal' }, { type: 'HEALTH_GOAL_SELECTED', goal: id });
    assert.equal(state.goal?.targetValue, targetValue, id);
    assert.equal(state.goal?.targetUnit, targetUnit, id);
    assert.equal(state.goal?.durationDays, durationDays, id);
  }
});

test('meal-specific weekly health goals use natural dynamic copy', () => {
  const goal = healthReducer({ ...initialHealthDraft, mealToImprove: 'lunch' }, { type: 'HEALTH_GOAL_SELECTED', goal: 'four_week' }).goal;
  assert.equal(goal?.displayTitle, 'Four healthier lunches each week');
});

test('custom health goals require text and persist through the shared goal model', () => {
  const empty = healthReducer({ ...initialHealthDraft, currentStep: 'goal' }, { type: 'HEALTH_GOAL_SELECTED', goal: 'custom' });
  assert.equal(empty.goal, null);
  const state = healthReducer(empty, { type: 'HEALTH_CUSTOM_GOAL_CHANGED', value: '  Cook dinner twice a week  ' });
  assert.equal(state.healthGoal, 'custom');
  assert.equal(state.customHealthGoal, 'Cook dinner twice a week');
  assert.equal(state.goal?.displayTitle, 'Cook dinner twice a week');
  assert.equal(state.goal?.targetUnit, 'custom');
  assert.equal(state.goal?.targetValue, 1);
  const cleared = healthReducer(state, { type: 'HEALTH_CUSTOM_GOAL_CHANGED', value: '   ' });
  assert.equal(cleared.goal, null);
});

test('hydration never reaches a reveal without a matching goal object', () => {
  assert.equal(normalizeHealthDraft({ version: 1, healthGoal: 'one_daily', currentStep: 'reveal' }).currentStep, 'problem');
  assert.equal(normalizeMacrosDraft({ version: 2, macroFocus: 'more_protein', macroGoal: '5_4', currentStep: 'reveal' }).currentStep, 'barrier');
  assert.equal(normalizeSaveMoneyDraft({ version: 1, savingsGoalAmountCents: 50000, currentStep: 'reveal' }).currentStep, 'planSetup');
});
