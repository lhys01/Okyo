import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEatingOutSpend, initialSaveMoneyDraft, normalizeSaveMoneyDraft, routeForSaveMoneyDraft, saveMoneyReducer } from './saveMoneyBranch';

test('save money route resolves the thirteen ordered steps and completed handoff', () => {
  assert.equal(routeForSaveMoneyDraft(initialSaveMoneyDraft), 'intro');
  let state = initialSaveMoneyDraft;
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 3 });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'cost');
  state = saveMoneyReducer(state, { type: 'COST_SAVED', cents: 2000 });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  assert.equal(state.currentStep, 'spendingGraph');
});

test('draft normalization rejects unknown versions, clamps dependent target, and keeps stable ids', () => {
  assert.equal(normalizeSaveMoneyDraft({ version: 9 }).currentStep, 'intro');
  const draft = normalizeSaveMoneyDraft({ version: 1, weeklyEatingOutCount: 2, eatingOutCostCents: 1500, orderingFriction: 'time', mealTypesToReplace: ['dinner', 'dinner', 'varies'], weeklyReplacementTarget: 9, recipePriority: 'leftovers', householdSize: 2 });
  assert.deepEqual(draft.mealTypesToReplace, ['varies']);
  assert.equal(draft.weeklyReplacementTarget, null);
});

test('eating-out calculations use integer cents and exact annual/monthly policy', () => {
  assert.deepEqual(calculateEatingOutSpend(3, 2000), { weeklySpendCents: 6000, annualSpendCents: 312000, monthlySpendCents: 26000 });
});

test('all thirteen routes are ordered and transient routes resume', () => {
  assert.deepEqual(['intro', 'frequency', 'cost', 'spendingGraph', 'friction', 'encouragement', 'mealType', 'replacementTarget', 'recipePriority', 'reassurance', 'householdSize', 'reveal', 'complete'], ['intro', ...['frequency', 'cost', 'spendingGraph', 'friction', 'encouragement', 'mealType', 'replacementTarget', 'recipePriority', 'reassurance', 'householdSize', 'reveal', 'complete']]);
  const base = { ...initialSaveMoneyDraft, currentStep: 'spendingGraph' as const, weeklyEatingOutCount: 3, eatingOutCostCents: 2000 };
  assert.equal(routeForSaveMoneyDraft(base), 'spendingGraph');
  assert.equal(routeForSaveMoneyDraft({ ...base, orderingFriction: 'time', mealTypesToReplace: ['dinner'], weeklyReplacementTarget: 2, recipePriority: 'fast_easy', currentStep: 'reassurance' }), 'reassurance');
});

test('every reducer answer is immediately represented in the draft', () => {
  let state = saveMoneyReducer(initialSaveMoneyDraft, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 3 });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'COST_SAVED', cents: 2000 });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'FRICTION_SELECTED', friction: 'time' });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'MEAL_TYPE_TOGGLED', mealType: 'dinner' });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'REPLACEMENT_TARGET_SAVED', target: 2 });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'PRIORITY_SELECTED', priority: 'fast_easy' });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'NEXT_PRESSED' });
  state = saveMoneyReducer(state, { type: 'HOUSEHOLD_SIZE_SELECTED', size: 2 });
  assert.deepEqual([state.weeklyEatingOutCount, state.eatingOutCostCents, state.orderingFriction, state.mealTypesToReplace, state.weeklyReplacementTarget, state.recipePriority, state.householdSize], [3, 2000, 'time', ['dinner'], 2, 'fast_easy', 2]);
});

test('completion restores to the completion handoff', () => {
  const completed = normalizeSaveMoneyDraft({ version: 1, branchCompleted: true });
  assert.equal(completed.currentStep, 'complete');
  assert.equal(completed.branchCompleted, true);
});

test('completed save money can go back to reveal without losing answers, then complete again', () => {
  const answers = {
    weeklyEatingOutCount: 3,
    eatingOutCostCents: 2000,
    orderingFriction: 'time' as const,
    mealTypesToReplace: ['dinner' as const],
    weeklyReplacementTarget: 2,
    recipePriority: 'fast_easy' as const,
    householdSize: 2 as const,
  };
  const completed = normalizeSaveMoneyDraft({ version: 1, currentStep: 'complete', branchCompleted: true, ...answers });
  const backed = saveMoneyReducer(completed, { type: 'BACK_PRESSED' });
  assert.equal(backed.currentStep, 'reveal');
  assert.equal(backed.branchCompleted, true);
  assert.deepEqual({ ...backed, currentStep: undefined, branchCompleted: undefined }, { ...completed, currentStep: undefined, branchCompleted: undefined });
  const completedAgain = saveMoneyReducer(backed, { type: 'BRANCH_COMPLETED' });
  assert.equal(completedAgain.currentStep, 'complete');
  assert.equal(completedAgain.branchCompleted, true);
  assert.deepEqual({ ...completedAgain, currentStep: undefined, branchCompleted: undefined }, { ...completed, currentStep: undefined, branchCompleted: undefined });
});

test('completed snapshots route to complete, while an explicit backed reveal snapshot routes to reveal', () => {
  const complete = normalizeSaveMoneyDraft({ version: 1, currentStep: 'complete', branchCompleted: true });
  const reveal = normalizeSaveMoneyDraft({ version: 1, currentStep: 'reveal', branchCompleted: true });
  assert.equal(routeForSaveMoneyDraft(complete), 'complete');
  assert.equal(routeForSaveMoneyDraft(reveal), 'reveal');
});

test('invalid counts and costs are rejected at both boundaries', () => {
  const state = saveMoneyReducer(initialSaveMoneyDraft, { type: 'FREQUENCY_SAVED', count: 0 });
  assert.equal(state.weeklyEatingOutCount, 0);
  assert.equal(saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: -1 }).weeklyEatingOutCount, 0);
  assert.equal(saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 22 }).weeklyEatingOutCount, 0);
  assert.equal(saveMoneyReducer(state, { type: 'COST_SAVED', cents: 99 }).eatingOutCostCents, null);
  assert.equal(saveMoneyReducer(state, { type: 'COST_SAVED', cents: 50001 }).eatingOutCostCents, null);
});

test('replacement target is bounded and lowering frequency clears an invalid target', () => {
  let state = normalizeSaveMoneyDraft({ version: 1, weeklyEatingOutCount: 3, weeklyReplacementTarget: 3 });
  assert.equal(saveMoneyReducer(state, { type: 'REPLACEMENT_TARGET_SAVED', target: 4 }).weeklyReplacementTarget, 3);
  state = saveMoneyReducer(state, { type: 'FREQUENCY_SAVED', count: 2 });
  assert.equal(state.weeklyReplacementTarget, null);
});

test('back navigation preserves valid answers', () => {
  const state = saveMoneyReducer({ ...initialSaveMoneyDraft, currentStep: 'cost', weeklyEatingOutCount: 3, eatingOutCostCents: 2000 }, { type: 'BACK_PRESSED' });
  assert.equal(state.currentStep, 'frequency');
  assert.equal(state.weeklyEatingOutCount, 3);
  assert.equal(state.eatingOutCostCents, 2000);
});

test('zero frequency remains honest and produces zero estimates', () => {
  assert.deepEqual(calculateEatingOutSpend(0, 2000), { weeklySpendCents: 0, annualSpendCents: 0, monthlySpendCents: 0 });
  assert.equal(routeForSaveMoneyDraft(normalizeSaveMoneyDraft({ version: 1, weeklyEatingOutCount: 0, eatingOutCostCents: 2000 })), 'friction');
});

test('monthly rounding is deterministic for a non-divisible annual total', () => {
  assert.equal(calculateEatingOutSpend(1, 100).monthlySpendCents, Math.round(5200 / 12));
});
