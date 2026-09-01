import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthBranchPersistence, HEALTH_BRANCH_STORAGE_KEY } from './healthBranchPersistence';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('health draft persistence is versioned and recoverable', async () => {
  const storage = memoryStorage();
  const persistence = createHealthBranchPersistence(storage);
  await persistence.write({ version: 1, healthDefinition: 'more_vegetables_fruit', healthBarrier: 'too_expensive' });
  assert.equal(JSON.parse(storage.values.get(HEALTH_BRANCH_STORAGE_KEY) ?? '{}').version, 1);
  assert.equal((await persistence.read()).healthDefinition, 'more_vegetables_fruit');
  storage.values.set(HEALTH_BRANCH_STORAGE_KEY, '{broken');
  assert.equal((await persistence.read()).currentStep, 'intro');
});

test('a fresh persistence instance restores every persisted route and missing storage is empty', async () => {
  const storage = memoryStorage();
  await createHealthBranchPersistence(storage).write({
    version: 1,
    currentStep: 'foodStyle',
    healthDefinition: 'more_vegetables_fruit',
    healthBarrier: 'too_expensive',
    mealToImprove: 'dinner',
  });
  const second = createHealthBranchPersistence(storage);
  assert.equal((await second.read()).currentStep, 'foodStyle');
  await second.reset();
  assert.equal((await createHealthBranchPersistence(storage).read()).currentStep, 'intro');
});

test('completed branch resumes at its completion handoff', async () => {
  const storage = memoryStorage();
  const persistence = createHealthBranchPersistence(storage);
  await persistence.write({ version: 1, branchCompleted: true });
  assert.equal((await createHealthBranchPersistence(storage).read()).currentStep, 'complete');
});

test('restart at completion stays complete, while restart after backing resumes reveal', async () => {
  const storage = memoryStorage();
  const persistence = createHealthBranchPersistence(storage);
  const answers = {
    version: 1 as const,
    healthDefinition: 'more_balanced_meals' as const,
    healthBarrier: 'struggle_consistency' as const,
    mealToImprove: 'dinner' as const,
    foodStyles: ['comfort_food' as const],
    flexibleCommitment: 'few_meals_weekly' as const,
    favoriteFoodTradeoff: null,
    recipeDealbreaker: null,
    weeklyCookingCount: null,
    branchCompleted: true,
  };
  await persistence.write({ ...answers, currentStep: 'complete' });
  assert.equal((await createHealthBranchPersistence(storage).read()).currentStep, 'complete');
  await persistence.write({ ...answers, currentStep: 'reveal' });
  const restored = await createHealthBranchPersistence(storage).read();
  assert.equal(restored.currentStep, 'reveal');
  assert.equal(restored.branchCompleted, true);
  assert.deepEqual({ ...restored, currentStep: undefined }, { ...answers, currentStep: undefined });
});

test('read and write failures are recoverable and failed writes do not claim storage success', async () => {
  let writes = 0;
  const failing = { async getItem() { throw new Error('read failed'); }, async setItem() { writes += 1; throw new Error('write failed'); }, async removeItem() { throw new Error('remove failed'); } };
  const persistence = createHealthBranchPersistence(failing);
  assert.equal((await persistence.read()).currentStep, 'intro');
  const returned = await persistence.write({ version: 1, currentStep: 'barrier' });
  assert.equal(returned, null);
  assert.equal(writes, 1);
  await assert.doesNotReject(() => persistence.reset());
});
