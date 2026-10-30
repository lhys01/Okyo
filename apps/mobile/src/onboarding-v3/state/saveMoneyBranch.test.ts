import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVE_MONEY_VISIBLE_STEPS,
  calculateEatingOutSpend,
  calculateSavingsProjection,
  initialSaveMoneyDraft,
  normalizeSaveMoneyDraft,
  routeForSaveMoneyDraft,
  saveMoneyReducer,
  type FrictionId,
  type HouseholdSize,
} from './saveMoneyBranch';

test('save money uses five visible screens and a non-rendered completion handoff', () => {
  assert.deepEqual(SAVE_MONEY_VISIBLE_STEPS, ['intro', 'weeklySnapshot', 'projection', 'planSetup', 'reveal']);
  let state = initialSaveMoneyDraft;
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'weeklySnapshot');
});

test('one Continue event advances one Savings screen in order', () => {
  let state = initialSaveMoneyDraft;
  const sequence: string[] = [state.currentStep];
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  sequence.push(state.currentStep);
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  sequence.push(state.currentStep);
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  sequence.push(state.currentStep);
  assert.deepEqual(sequence, ['intro', 'weeklySnapshot', 'projection', 'planSetup']);
  assert.equal(saveMoneyReducer(state, { type: 'NEXT_PRESSED' }).currentStep, 'planSetup');
});

test('weekly values cover 0 through 30 exactly and replacements clamp when frequency drops', () => {
  let state = saveMoneyReducer(initialSaveMoneyDraft, { type: 'FREQUENCY_SAVED', count: 6 });
  state = saveMoneyReducer(state, { type: 'REPLACEMENT_TARGET_SAVED', target: 5 });
  state = saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 2 });
  assert.equal(state.weeklyReplacementTarget, 2);
  assert.equal(saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 21 }).weeklyEatingOutCount, 21);
  assert.equal(saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 30 }).weeklyEatingOutCount, 30);
  assert.equal(saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 31 }).weeklyEatingOutCount, 2);
  assert.equal(saveMoneyReducer(state, { type: 'COST_SAVED', cents: 99 }).eatingOutCostCents, state.eatingOutCostCents);
  assert.equal(saveMoneyReducer(state, { type: 'REPLACEMENT_TARGET_SAVED', target: 3 }).weeklyReplacementTarget, 2);
});

test('spend and potential-savings calculations use integer cents', () => {
  assert.deepEqual(calculateEatingOutSpend(3, 2_000), { weeklySpendCents: 6_000, annualSpendCents: 312_000, monthlySpendCents: 26_000 });
  assert.deepEqual(calculateSavingsProjection({ weeklyEatingOutCount: 4, eatingOutCostCents: 2_000, weeklyReplacementTarget: 2 }), {
    currentWeeklyCostCents: 8_000,
    projectedWeeklyCostCents: 5_200,
    weeklyPotentialSavingsCents: 2_800,
    monthlyPotentialSavingsCents: 12_133,
    annualPotentialSavingsCents: 145_600,
    estimatedHomeCostCents: 600,
    replacements: 2,
  });
});

test('canonical calculations cover requested range and cost boundaries', () => {
  for (const count of [0, 1, 21, 30]) {
    const projection = calculateSavingsProjection({ weeklyEatingOutCount: count, eatingOutCostCents: 50_000, weeklyReplacementTarget: count });
    assert.equal(projection.replacements, count);
    assert.equal(projection.currentWeeklyCostCents, count * 50_000);
    assert.ok(projection.projectedWeeklyCostCents <= projection.currentWeeklyCostCents);
  }
  const minimum = calculateSavingsProjection({ weeklyEatingOutCount: 30, eatingOutCostCents: 100, weeklyReplacementTarget: 30 });
  assert.equal(minimum.weeklyPotentialSavingsCents, 0);
});

test('zero and low-cost scenarios never show negative potential savings', () => {
  assert.equal(calculateSavingsProjection({ weeklyEatingOutCount: 0, eatingOutCostCents: 2_000, weeklyReplacementTarget: 8 }).weeklyPotentialSavingsCents, 0);
  const low = calculateSavingsProjection({ weeklyEatingOutCount: 3, eatingOutCostCents: 400, weeklyReplacementTarget: 3 });
  assert.equal(low.projectedWeeklyCostCents, low.currentWeeklyCostCents);
  assert.equal(low.weeklyPotentialSavingsCents, 0);
});

test('editing weekly inputs recalculates the derived internal goal', () => {
  let state = saveMoneyReducer(initialSaveMoneyDraft, { type: 'COST_SAVED', cents: 2_000 });
  state = saveMoneyReducer(state, { type: 'REPLACEMENT_TARGET_SAVED', target: 2 });
  assert.equal(state.goal?.estimatedWeeklySavingsCents, 2_800);
  assert.equal(state.savingsGoalAmountCents, 145_600);
  state = saveMoneyReducer(state, { type: 'COST_SAVED', cents: 3_000 });
  assert.equal(state.goal?.estimatedWeeklySavingsCents, 4_800);
  assert.equal(state.savingsGoalAmountCents, 249_600);
});

test('all supported barriers persist and cravings migrates to Something else', () => {
  const barriers: FrictionId[] = ['time', 'energy', 'ideas', 'ingredients', 'cleanup', 'other'];
  for (const friction of barriers) assert.equal(saveMoneyReducer(initialSaveMoneyDraft, { type: 'FRICTION_SELECTED', friction }).orderingFriction, friction);
  assert.equal(normalizeSaveMoneyDraft({ version: 1, currentStep: 'friction', orderingFriction: 'cravings' }).orderingFriction, 'other');
});

test('every meal combination is supported and It varies stays exclusive', () => {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  for (let mask = 0; mask < 2 ** mealTypes.length; mask += 1) {
    let state = initialSaveMoneyDraft;
    const expected: string[] = [];
    mealTypes.forEach((mealType, index) => {
      if ((mask & (1 << index)) === 0) return;
      state = saveMoneyReducer(state, { type: 'MEAL_TYPE_TOGGLED', mealType });
      expected.push(mealType);
    });
    assert.deepEqual(state.mealTypesToReplace, expected);
    state = saveMoneyReducer(state, { type: 'MEAL_TYPE_TOGGLED', mealType: 'varies' });
    assert.deepEqual(state.mealTypesToReplace, ['varies']);
    state = saveMoneyReducer(state, { type: 'MEAL_TYPE_TOGGLED', mealType: 'lunch' });
    assert.deepEqual(state.mealTypesToReplace, ['lunch']);
  }
});

test('priorities toggle up to two and household choices all persist', () => {
  let state = saveMoneyReducer(initialSaveMoneyDraft, { type: 'PRIORITY_TOGGLED', priority: 'lower_cost' });
  state = saveMoneyReducer(state, { type: 'PRIORITY_TOGGLED', priority: 'quick_easy' });
  state = saveMoneyReducer(state, { type: 'PRIORITY_TOGGLED', priority: 'leftovers' });
  assert.deepEqual(state.recipePriorities, ['lower_cost', 'quick_easy']);
  state = saveMoneyReducer(state, { type: 'PRIORITY_TOGGLED', priority: 'lower_cost' });
  assert.deepEqual(state.recipePriorities, ['quick_easy']);
  for (const size of [1, 2, 3, 4, '5_plus'] as HouseholdSize[]) assert.equal(saveMoneyReducer(state, { type: 'HOUSEHOLD_SIZE_SELECTED', size }).householdSize, size);
});

test('custom barrier and priority text persist while toggling Other', () => {
  let state = saveMoneyReducer(initialSaveMoneyDraft, { type: 'FRICTION_SELECTED', friction: 'other' });
  state = saveMoneyReducer(state, { type: 'FRICTION_OTHER_TEXT_CHANGED', text: 'My kitchen is shared' });
  state = saveMoneyReducer(state, { type: 'PRIORITY_TOGGLED', priority: 'other' });
  state = saveMoneyReducer(state, { type: 'PRIORITY_OTHER_TEXT_CHANGED', text: 'Freezer friendly' });
  assert.equal(state.orderingFrictionOtherText, 'My kitchen is shared');
  assert.equal(state.recipePriorityOtherText, 'Freezer friendly');
  assert.deepEqual(state.recipePriorities, ['other']);
  state = saveMoneyReducer(state, { type: 'PRIORITY_TOGGLED', priority: 'other' });
  assert.deepEqual(state.recipePriorities, []);
  assert.equal(state.recipePriorityOtherText, 'Freezer friendly');
});

test('legacy drafts migrate removed routes, priority ids, custom goals, and keep the storage contract usable', () => {
  const legacy = normalizeSaveMoneyDraft({
    version: 1,
    currentStep: 'goal',
    weeklyEatingOutCount: 3,
    eatingOutCostCents: 2_000,
    orderingFriction: 'time',
    mealTypesToReplace: ['dinner'],
    weeklyReplacementTarget: 2,
    recipePriority: 'fast_easy',
    householdSize: 2,
    savingsGoalAmountCents: 50_000,
    goal: { goalBranch: 'save_money', goalType: 'savings', targetValue: 50_000, targetUnit: 'usd_cents', startDate: '2026-09-01', targetDate: '2026-12-01', displayTitle: 'Save $500' },
  });
  assert.equal(legacy.version, 2);
  assert.equal(legacy.currentStep, 'reveal');
  assert.deepEqual(legacy.recipePriorities, ['quick_easy']);
  assert.equal(legacy.legacySavingsGoalAmountCents, 50_000);
  assert.equal(legacy.legacyGoal?.displayTitle, 'Save $500');
  assert.equal(legacy.savingsGoalAmountCents, 145_600);
});

test('resume and back preserve answers and custom text across surviving screens', () => {
  const saved = normalizeSaveMoneyDraft({ version: 2, currentStep: 'planSetup', orderingFriction: 'other', orderingFrictionOtherText: 'No counter space', mealTypesToReplace: ['lunch'], recipePriorities: ['quick_easy', 'other'], recipePriorityOtherText: 'One pot', householdSize: 2 });
  assert.equal(routeForSaveMoneyDraft(saved), 'planSetup');
  const backed = saveMoneyReducer(saved, { type: 'BACK_PRESSED' });
  assert.equal(backed.currentStep, 'projection');
  assert.equal(backed.orderingFriction, 'other');
  assert.equal(backed.orderingFrictionOtherText, 'No counter space');
  assert.equal(backed.recipePriorityOtherText, 'One pot');
  assert.deepEqual(backed.recipePriorities, ['quick_easy', 'other']);
});

test('Skip advances only the optional savings projection and persists the skipped screen', () => {
  const projection = normalizeSaveMoneyDraft({
    version: 2,
    currentStep: 'projection',
    orderingFriction: 'time',
    weeklyEatingOutCount: 12,
    eatingOutCostCents: 2_000,
    weeklyReplacementTarget: 6,
  });
  const skipped = saveMoneyReducer(projection, { type: 'OPTIONAL_STEP_SKIPPED' });
  assert.equal(skipped.currentStep, 'planSetup');
  assert.deepEqual(skipped.skippedOptionalSteps, ['projection']);
  assert.equal(skipped.weeklyEatingOutCount, 12);
  assert.equal(skipped.eatingOutCostCents, 2_000);
});

test('completion is terminal and backing from it safely returns to the final reveal', () => {
  const completed = saveMoneyReducer({ ...initialSaveMoneyDraft, currentStep: 'reveal' }, { type: 'BRANCH_COMPLETED' });
  assert.equal(completed.currentStep, 'complete');
  assert.equal(completed.branchCompleted, true);
  const backed = saveMoneyReducer(completed, { type: 'BACK_PRESSED' });
  assert.equal(backed.currentStep, 'reveal');
  assert.equal(backed.branchCompleted, false);
});
