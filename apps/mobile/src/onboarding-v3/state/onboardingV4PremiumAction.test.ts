import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe, ScanResult } from '../../mocks';
import type { CanonicalRecipe } from '../../state/canonicalRecipes';
import {
  createOnboardingV4PremiumActionPersistence,
  decideOnboardingV4PremiumAccess,
  getCompletedCookRecovery,
  isCompletedCustomizationDestinationReady,
  normalizeOnboardingV4PendingPremiumAction,
  resumeOnboardingV4PremiumAction,
  type OnboardingV4CorrectionResult,
  type OnboardingV4PremiumActionDependencies,
} from './onboardingV4PremiumAction';

function memoryStorage(initial: Record<string, string> = {}, beforeSet?: (value: string) => void) {
  const values = new Map(Object.entries(initial));
  return { values, async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { beforeSet?.(value); values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
}

const canonical = { id: 'recipe-1', recipeId: 'recipe-1', sourceRecipeId: 'source-1', title: 'Original bowl', ingredients: [{ name: 'Rice', quantity: '1 cup' }], steps: ['Cook rice'], scanResult: { id: 'scan-1' } } as CanonicalRecipe;
const correctedRecipe = { id: 'revision-action-1', title: 'Brighter bowl', ingredients: [{ name: 'Rice', quantity: '1 cup' }, { name: 'Lime', quantity: '1' }], steps: ['Cook rice', 'Add lime'] } as Recipe;
const correctedScan = { id: 'scan-corrected-1', dishName: 'Brighter bowl' } as ScanResult;
const correctionResult: OnboardingV4CorrectionResult = { recipe: correctedRecipe, scan: correctedScan };

function dependencies(overrides: Partial<OnboardingV4PremiumActionDependencies> = {}) {
  const persistence = createOnboardingV4PremiumActionPersistence(memoryStorage());
  let current = canonical;
  const base: OnboardingV4PremiumActionDependencies = {
    persistence,
    getRecipe: () => current,
    startCook: () => true,
    requestCorrection: async () => correctionResult,
    isCorrectionApplied: (_action, result) => current.sourceRecipeId === result.recipe.id && current.scanResult?.id === result.scan.id,
    applyCorrection: (_recipeId, result) => { current = { ...current, sourceRecipeId: result.recipe.id, scanResult: { ...result.scan, recipeId: current.recipeId } }; return true; },
  };
  return { dependencies: { ...base, ...overrides }, persistence, getCurrent: () => current };
}

test('entitlement decisions wait, fail closed, show paywall, or resume only from verified ready state', () => {
  assert.equal(decideOnboardingV4PremiumAccess({ status: 'loading' }), 'wait');
  assert.equal(decideOnboardingV4PremiumAccess({ status: 'error' }), 'fail_closed');
  assert.equal(decideOnboardingV4PremiumAccess({ status: 'unavailable' }), 'fail_closed');
  assert.equal(decideOnboardingV4PremiumAccess({ status: 'ready', isEntitled: false }), 'paywall');
  assert.equal(decideOnboardingV4PremiumAccess({ status: 'ready', isEntitled: true }), 'resume');
});

test('Cook and customization persist the exact recipe, stable action identity, and trimmed text before entitlement', async () => {
  const { persistence } = dependencies();
  const cook = await persistence.create('cook', 'recipe-1');
  assert.equal((await persistence.read())?.actionId, cook.actionId);
  const customize = await persistence.create('customize', 'recipe-1', '  less spicy, more protein  ');
  assert.equal((await persistence.read())?.customizationText, 'less spicy, more protein');
  await assert.rejects(() => persistence.create('customize', 'recipe-1', '   '), /Invalid premium action/);
});

test('verified entitlement automatically performs the exact submitted correction and completes at the corrected recipe', async () => {
  let receivedText = '';
  let receivedRecipe = '';
  const setup = dependencies({ requestCorrection: async (action, recipe) => { receivedText = action.customizationText ?? ''; receivedRecipe = recipe.recipeId; return correctionResult; } });
  const action = await setup.persistence.create('customize', 'recipe-1', 'add lime');
  const completed = await resumeOnboardingV4PremiumAction(action, setup.dependencies);
  assert.equal(receivedText, 'add lime');
  assert.equal(receivedRecipe, 'recipe-1');
  assert.equal(completed.status, 'completed');
  assert.equal(setup.getCurrent().recipeId, 'recipe-1');
  assert.equal(setup.getCurrent().sourceRecipeId, correctedRecipe.id);
  assert.equal(isCompletedCustomizationDestinationReady(completed, setup.getCurrent()), true);
});

test('correction failure preserves the original recipe and a retryable failed action', async () => {
  const setup = dependencies({ requestCorrection: async () => { throw new Error('Friendly correction failure'); } });
  const action = await setup.persistence.create('customize', 'recipe-1', 'add lime');
  await assert.rejects(() => resumeOnboardingV4PremiumAction(action, setup.dependencies), /Friendly correction failure/);
  assert.equal(setup.getCurrent().sourceRecipeId, 'source-1');
  assert.equal((await setup.persistence.read())?.status, 'failed');
  assert.equal((await setup.persistence.read())?.customizationText, 'add lime');
});

test('unusable correction output is rejected and never completes or applies', async () => {
  let applications = 0;
  const setup = dependencies({ requestCorrection: async () => ({ recipe: { id: 'bad', title: '', ingredients: [], steps: [] } as unknown as Recipe, scan: correctedScan }), applyCorrection: () => { applications += 1; return true; } });
  const action = await setup.persistence.create('customize', 'recipe-1', 'add lime');
  await assert.rejects(() => resumeOnboardingV4PremiumAction(action, setup.dependencies), /incomplete customization/);
  assert.equal(applications, 0);
  assert.equal((await setup.persistence.read())?.status, 'failed');
});

test('canonical update failure retains the validated response and does not mark completion', async () => {
  const setup = dependencies({ applyCorrection: () => false });
  const action = await setup.persistence.create('customize', 'recipe-1', 'add lime');
  await assert.rejects(() => resumeOnboardingV4PremiumAction(action, setup.dependencies), /safely save/);
  const failed = await setup.persistence.read();
  assert.equal(failed?.status, 'failed');
  assert.equal(failed?.correctedRecipe?.id, correctedRecipe.id);
});

test('crash boundary after canonical application reuses the durable result and never applies twice', async () => {
  let failDestinationWrite = true;
  const storage = memoryStorage({}, (value) => {
    const parsed = JSON.parse(value) as { status?: string };
    if (parsed.status === 'destination_ready' && failDestinationWrite) { failDestinationWrite = false; throw new Error('simulated app termination'); }
  });
  const persistence = createOnboardingV4PremiumActionPersistence(storage);
  let current = canonical;
  let requests = 0;
  let applications = 0;
  const deps: OnboardingV4PremiumActionDependencies = {
    persistence,
    getRecipe: () => current,
    startCook: () => true,
    requestCorrection: async () => { requests += 1; return correctionResult; },
    isCorrectionApplied: (_action, result) => current.sourceRecipeId === result.recipe.id && current.scanResult?.id === result.scan.id,
    applyCorrection: (_id, result) => { applications += 1; current = { ...current, sourceRecipeId: result.recipe.id, scanResult: { ...result.scan, recipeId: current.recipeId } }; return true; },
  };
  const action = await persistence.create('customize', 'recipe-1', 'add lime');
  await assert.rejects(() => resumeOnboardingV4PremiumAction(action, deps), /simulated app termination/);
  const recovered = await persistence.read();
  assert.equal(recovered?.status, 'failed');
  const completed = await resumeOnboardingV4PremiumAction(recovered!, deps);
  assert.equal(completed.status, 'completed');
  assert.equal(requests, 1);
  assert.equal(applications, 1);
});

test('concurrent correction resumes coalesce into one request and one canonical application', async () => {
  let requests = 0;
  let applications = 0;
  const setup = dependencies({ requestCorrection: async () => { requests += 1; return correctionResult; }, applyCorrection: () => { applications += 1; return true; }, isCorrectionApplied: () => false });
  const action = await setup.persistence.create('customize', 'recipe-1', 'add lime');
  const [first, second] = await Promise.all([resumeOnboardingV4PremiumAction(action, setup.dependencies), resumeOnboardingV4PremiumAction(action, setup.dependencies)]);
  assert.equal(first.status, 'completed');
  assert.equal(second.status, 'completed');
  assert.equal(requests, 1);
  assert.equal(applications, 1);
});

test('Cook claims, starts the same canonical recipe once, records destination ready, and completes', async () => {
  let starts = 0;
  const setup = dependencies({ startCook: (recipe) => { starts += 1; assert.equal(recipe.recipeId, 'recipe-1'); return true; } });
  const action = await setup.persistence.create('cook', 'recipe-1');
  const [first, second] = await Promise.all([resumeOnboardingV4PremiumAction(action, setup.dependencies), resumeOnboardingV4PremiumAction(action, setup.dependencies)]);
  assert.equal(first.status, 'completed');
  assert.equal(second.status, 'completed');
  assert.equal(starts, 1);
});

test('Cook restart from destination_ready finishes without starting a duplicate session', async () => {
  let starts = 0;
  const setup = dependencies({ startCook: () => { starts += 1; return true; } });
  const pending = await setup.persistence.create('cook', 'recipe-1');
  const ready = await setup.persistence.write({ ...pending, status: 'destination_ready' });
  const completed = await resumeOnboardingV4PremiumAction(ready, setup.dependencies);
  assert.equal(completed.status, 'completed');
  assert.equal(starts, 0);
});

test('completed Cook recovery waits for hydration, reopens matching sessions, and handles missing or mismatched state deterministically', () => {
  assert.equal(getCompletedCookRecovery({ storeHydrated: false, recipeExists: false, recipeCompleted: false, activeRecipeId: null, expectedRecipeId: 'recipe-1' }), 'wait');
  assert.equal(getCompletedCookRecovery({ storeHydrated: true, recipeExists: true, recipeCompleted: false, activeRecipeId: 'recipe-1', expectedRecipeId: 'recipe-1' }), 'ready');
  assert.equal(getCompletedCookRecovery({ storeHydrated: true, recipeExists: true, recipeCompleted: false, activeRecipeId: null, expectedRecipeId: 'recipe-1' }), 'start');
  assert.equal(getCompletedCookRecovery({ storeHydrated: true, recipeExists: true, recipeCompleted: true, activeRecipeId: null, expectedRecipeId: 'recipe-1' }), 'meal_completed');
  assert.equal(getCompletedCookRecovery({ storeHydrated: true, recipeExists: true, recipeCompleted: false, activeRecipeId: 'recipe-2', expectedRecipeId: 'recipe-1' }), 'mismatch');
  assert.equal(getCompletedCookRecovery({ storeHydrated: true, recipeExists: false, recipeCompleted: false, activeRecipeId: null, expectedRecipeId: 'recipe-1' }), 'missing_recipe');
});

test('malformed pending actions and incomplete completed-customization receipts fail safely', () => {
  assert.equal(normalizeOnboardingV4PendingPremiumAction(null), null);
  assert.equal(normalizeOnboardingV4PendingPremiumAction({ type: 'cook' }), null);
  assert.equal(normalizeOnboardingV4PendingPremiumAction({ actionId: 'a', type: 'customize', recipeId: 'r', customizationText: '', status: 'completed', createdAt: new Date().toISOString() }), null);
  assert.equal(normalizeOnboardingV4PendingPremiumAction({ actionId: 'a', type: 'customize', recipeId: 'r', customizationText: 'x', status: 'completed', createdAt: new Date().toISOString() }), null);
});

test('persistence failure prevents entitlement or correction work from starting', async () => {
  let requests = 0;
  const persistence = createOnboardingV4PremiumActionPersistence({ async getItem() { return null; }, async removeItem() {}, async setItem() { throw new Error('disk full'); } });
  await assert.rejects(() => persistence.create('customize', 'recipe-1', 'add lime'), /disk full/);
  assert.equal(requests, 0);
});
