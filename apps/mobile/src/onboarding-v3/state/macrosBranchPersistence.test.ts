import assert from 'node:assert/strict';
import test from 'node:test';
import { createMacrosBranchPersistence, MACROS_BRANCH_STORAGE_KEY } from './macrosBranchPersistence';

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, storage: { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } } };
}

test('v1 macros drafts migrate safely to the v2 route model', async () => {
  const { storage, values } = memoryStorage();
  const persistence = createMacrosBranchPersistence(storage);
  await persistence.write({ version: 1, currentStep: 'acknowledgment', macroFocus: 'more_protein' });
  assert.equal(JSON.parse(values.get(MACROS_BRANCH_STORAGE_KEY) ?? '{}').version, 2);
  assert.equal((await persistence.read()).currentStep, 'proteinWeight');
});

test('legacy v2 step ids migrate to the redesigned route model', async () => {
  const { storage } = memoryStorage();
  const persistence = createMacrosBranchPersistence(storage);
  await persistence.write({ version: 2, currentStep: 'calorieTracking', macroFocus: 'more_protein', proteinTargetStatus: 'not_sure' });
  assert.equal((await createMacrosBranchPersistence(storage).read()).currentStep, 'calorieCheck');
});

test('v2 persistence restores body weight, unit, multiplier, and route', async () => {
  const { storage } = memoryStorage();
  const persistence = createMacrosBranchPersistence(storage);
  await persistence.write({ version: 2, currentStep: 'proteinPreference', macroFocus: 'more_protein', bodyWeight: 70, bodyWeightUnit: 'kg', proteinMultiplier: 1.3, proteinTargetStatus: 'yes_know_it', proteinTargetGrams: 201 });
  const restored = await createMacrosBranchPersistence(storage).read();
  assert.equal(restored.currentStep, 'proteinPreference');
  assert.equal(restored.bodyWeight, 70);
  assert.equal(restored.bodyWeightUnit, 'kg');
  assert.equal(restored.proteinMultiplier, 1.3);
});

test('restart at completion stays complete and explicit Back reveal is retained', async () => {
  const { storage } = memoryStorage();
  const persistence = createMacrosBranchPersistence(storage);
  const answers = {
    version: 2, macroFocus: 'more_protein', proteinTargetStatus: 'not_sure', calorieTrackingStatus: 'no',
    macroBarrier: 'estimating_portions', mealToImprove: 'dinner', trackingStyle: 'exact_numbers',
    flexibleCommitment: 'few_aligned_meals', branchCompleted: true,
  } as const;
  await persistence.write({ ...answers, currentStep: 'complete' });
  assert.equal((await createMacrosBranchPersistence(storage).read()).currentStep, 'complete');
  await persistence.write({ ...answers, currentStep: 'reveal' });
  assert.equal((await createMacrosBranchPersistence(storage).read()).currentStep, 'reveal');
});

test('malformed storage remains recoverable to the initial draft', async () => {
  const { storage, values } = memoryStorage();
  values.set(MACROS_BRANCH_STORAGE_KEY, '{broken');
  assert.equal((await createMacrosBranchPersistence(storage).read()).currentStep, 'intro');
  await createMacrosBranchPersistence(storage).reset();
  assert.equal((await createMacrosBranchPersistence(storage).read()).currentStep, 'intro');
});
