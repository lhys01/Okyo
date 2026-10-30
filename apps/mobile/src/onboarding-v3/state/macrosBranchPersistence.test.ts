import assert from 'node:assert/strict';
import test from 'node:test';
import { createMacrosBranchPersistence, MACROS_BRANCH_STORAGE_KEY } from './macrosBranchPersistence';

function memoryStorage() { const values = new Map<string, string>(); return { values, storage: { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } } }; }
test('v2 drafts migrate safely into the compact version 4 model', async () => {
  const { storage, values } = memoryStorage(); const persistence = createMacrosBranchPersistence(storage);
  await persistence.write({ version: 2, currentStep: 'proteinWeight', macroFocus: 'more_protein', macroBarrier: 'meal_prep_time', mealToImprove: 'lunch', weeklyCookingCount: 2, proteinTargetGrams: 140 });
  const stored = JSON.parse(values.get(MACROS_BRANCH_STORAGE_KEY) ?? '{}'); assert.equal(stored.version, 4);
  const restored = await persistence.read(); assert.equal(restored.macroFocus, 'low_protein'); assert.equal(restored.proteinTargetGrams, 140);
});
test('known partial targets and the compact target-entry screen persist across relaunch', async () => {
  const { storage } = memoryStorage(); const persistence = createMacrosBranchPersistence(storage);
  await persistence.write({ version: 4, currentStep: 'knownTargets', macroFocus: 'low_protein', macroBarrier: 'time', macroOutcome: 'more_protein', recipePriorities: ['quick_to_make'], targetMode: 'known_targets', proteinTargetGrams: 145, calorieTarget: 2350, carbTargetGrams: null, fatTargetGrams: null, goalDurationWeeks: 6 });
  const restored = await createMacrosBranchPersistence(storage).read();
  assert.equal(restored.currentStep, 'knownTargets'); assert.equal(restored.proteinTargetGrams, 145); assert.equal(restored.calorieTarget, 2350); assert.equal(restored.carbTargetGrams, null); assert.equal(restored.goalDurationWeeks, 6);
});
test('malformed storage recovers to the initial draft', async () => {
  const { storage, values } = memoryStorage(); values.set(MACROS_BRANCH_STORAGE_KEY, '{broken');
  assert.equal((await createMacrosBranchPersistence(storage).read()).currentStep, 'intro');
});
