import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveMoneyBranchPersistence, SAVE_MONEY_BRANCH_STORAGE_KEY } from './saveMoneyBranchPersistence';

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
}

test('save money draft persistence writes version two under the compatible storage key', async () => {
  const storage = memoryStorage();
  const persistence = createSaveMoneyBranchPersistence(storage);
  await persistence.write({ version: 2, currentStep: 'weeklySnapshot', orderingFriction: 'time', weeklyEatingOutCount: 2, eatingOutCostCents: 2_000, weeklyReplacementTarget: 1 });
  assert.equal(JSON.parse(storage.values.get(SAVE_MONEY_BRANCH_STORAGE_KEY) ?? '{}').version, 2);
  assert.equal((await persistence.read()).currentStep, 'weeklySnapshot');
});

test('persistence migrates a version-one removed screen to the nearest surviving step', async () => {
  const storage = memoryStorage();
  storage.values.set(SAVE_MONEY_BRANCH_STORAGE_KEY, JSON.stringify({ version: 1, currentStep: 'reassurance', orderingFriction: 'time', mealTypesToReplace: ['dinner'], recipePriority: 'lowest_cost', householdSize: 2 }));
  const restored = await createSaveMoneyBranchPersistence(storage).read();
  assert.equal(restored.currentStep, 'planSetup');
  assert.deepEqual(restored.recipePriorities, ['lower_cost']);
});

test('reset and malformed or failing storage remain recoverable', async () => {
  const storage = memoryStorage();
  const persistence = createSaveMoneyBranchPersistence(storage);
  storage.values.set(SAVE_MONEY_BRANCH_STORAGE_KEY, '{broken');
  assert.equal((await persistence.read()).currentStep, 'intro');
  await persistence.reset();
  assert.equal(storage.values.has(SAVE_MONEY_BRANCH_STORAGE_KEY), false);
  const failing = { async getItem() { throw new Error('read'); }, async setItem() { throw new Error('write'); }, async removeItem() { throw new Error('remove'); } };
  const recoverable = createSaveMoneyBranchPersistence(failing);
  assert.equal((await recoverable.read()).currentStep, 'intro');
  assert.equal(await recoverable.write({ version: 2, currentStep: 'intro' }), null);
  await assert.doesNotReject(() => recoverable.reset());
});

test('completion and all personalized answers including custom fields restore without recording actual savings', async () => {
  const storage = memoryStorage();
  const persistence = createSaveMoneyBranchPersistence(storage);
  await persistence.write({ version: 2, currentStep: 'complete', branchCompleted: true, orderingFriction: 'other', orderingFrictionOtherText: 'Shared kitchen', weeklyEatingOutCount: 30, eatingOutCostCents: 50_000, weeklyReplacementTarget: 30, mealTypesToReplace: ['lunch', 'dinner'], recipePriorities: ['lower_cost', 'other'], recipePriorityOtherText: 'Freezer friendly', householdSize: 4 });
  const restored = await persistence.read();
  assert.equal(restored.currentStep, 'complete');
  assert.equal(restored.branchCompleted, true);
  assert.deepEqual(restored.mealTypesToReplace, ['lunch', 'dinner']);
  assert.equal(restored.weeklyEatingOutCount, 30);
  assert.equal(restored.weeklyReplacementTarget, 30);
  assert.equal(restored.orderingFrictionOtherText, 'Shared kitchen');
  assert.deepEqual(restored.recipePriorities, ['lower_cost', 'other']);
  assert.equal(restored.recipePriorityOtherText, 'Freezer friendly');
});

test('detailed plan reads distinguish unreadable storage from a valid but incomplete draft without exposing answers', async () => {
  const storage = memoryStorage();
  const persistence = createSaveMoneyBranchPersistence(storage);
  assert.deepEqual(await persistence.readDetailed(), { status: 'ready', draft: await persistence.read() });

  storage.values.set(SAVE_MONEY_BRANCH_STORAGE_KEY, '{broken');
  assert.deepEqual(await persistence.readDetailed(), { status: 'invalid_json' });

  const unreadable = createSaveMoneyBranchPersistence({
    ...storage,
    async getItem() { throw new Error('storage unavailable'); },
  });
  assert.deepEqual(await unreadable.readDetailed(), { status: 'storage_error' });
});
