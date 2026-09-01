import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveMoneyBranchPersistence, SAVE_MONEY_BRANCH_STORAGE_KEY } from './saveMoneyBranchPersistence';
test('save money draft persistence is versioned and recoverable', async () => {
  const values = new Map<string, string>();
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
  const persistence = createSaveMoneyBranchPersistence(storage);
  await persistence.write({ version: 1, weeklyEatingOutCount: 2, eatingOutCostCents: 2000 });
  assert.equal(JSON.parse(values.get(SAVE_MONEY_BRANCH_STORAGE_KEY) ?? '{}').version, 1);
  assert.equal((await persistence.read()).weeklyEatingOutCount, 2);
  values.set(SAVE_MONEY_BRANCH_STORAGE_KEY, '{broken');
  assert.equal((await persistence.read()).currentStep, 'intro');
});

test('a fresh persistence instance restores every persisted route and missing storage is empty', async () => {
  const values = new Map<string, string>();
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
  const first = createSaveMoneyBranchPersistence(storage);
  await first.write({ version: 1, currentStep: 'mealType', weeklyEatingOutCount: 3, eatingOutCostCents: 2000, orderingFriction: 'time' });
  const second = createSaveMoneyBranchPersistence(storage);
  assert.equal((await second.read()).currentStep, 'mealType');
  await second.reset();
  assert.equal((await createSaveMoneyBranchPersistence(storage).read()).currentStep, 'intro');
});

test('read and write failures are recoverable and failed writes do not claim storage success', async () => {
  let writes = 0;
  const failing = { async getItem() { throw new Error('read failed'); }, async setItem() { writes += 1; throw new Error('write failed'); }, async removeItem() { throw new Error('remove failed'); } };
  const persistence = createSaveMoneyBranchPersistence(failing);
  assert.equal((await persistence.read()).currentStep, 'intro');
  const returned = await persistence.write({ version: 1, currentStep: 'frequency' });
  assert.equal(returned, null);
  assert.equal(writes, 1);
  await assert.doesNotReject(() => persistence.reset());
});

test('restart at completion stays complete, while restart after backing resumes reveal', async () => {
  const values = new Map<string, string>();
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
  const persistence = createSaveMoneyBranchPersistence(storage);
  const answers = { version: 1, weeklyEatingOutCount: 3, eatingOutCostCents: 2000, orderingFriction: 'time', mealTypesToReplace: ['dinner'], weeklyReplacementTarget: 2, recipePriority: 'fast_easy', householdSize: 2, branchCompleted: true };
  await persistence.write({ ...answers, currentStep: 'complete' });
  assert.equal((await createSaveMoneyBranchPersistence(storage).read()).currentStep, 'complete');
  await persistence.write({ ...answers, currentStep: 'reveal' });
  const restored = await createSaveMoneyBranchPersistence(storage).read();
  assert.equal(restored.currentStep, 'reveal');
  assert.equal(restored.branchCompleted, true);
  assert.deepEqual({ ...restored, currentStep: undefined, branchCompleted: undefined }, { ...answers, currentStep: undefined, branchCompleted: undefined });
});
