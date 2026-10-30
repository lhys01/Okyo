import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthBranchPersistence, HEALTH_BRANCH_STORAGE_KEY } from './healthBranchPersistence';
import { createOnboardingPersistence, ONBOARDING_COMPLETED_STORAGE_KEY } from '../../state/onboardingPersistence';
import { getOnboardingStartupStatus, getStartupRoute } from '../../navigation/startupGate';

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
    healthProblem: 'too_much_takeout',
    cookingFrequency: 'one_to_two_week',
    mealPriority: 'tastes_good',
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
    healthGoal: null,
    goal: null,
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
  assert.deepEqual({ ...restored, currentStep: undefined }, {
    ...answers,
    healthProblem: null,
    cookingFrequency: null,
    mealPriority: null,
    healthGoalType: null,
    goalTargetCount: null,
    goalDurationWeeks: null,
    customHealthGoal: '',
    currentStep: undefined,
  });
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

const oldDraft = {
  version: 1, currentStep: 'reassurance', healthDefinition: 'less_takeout', healthBarrier: 'not_enough_time',
  mealToImprove: 'dinner', foodStyles: ['comfort_food'], flexibleCommitment: 'not_sure',
};
test('old in-progress drafts hydrate at Q1 while retaining compatible answers', async () => {
  for (const currentStep of ['meaning', 'meaningInsight', 'barrierResponse', 'mealInsight', 'reassurance', 'approach', 'whatOkyoDoes', 'reveal']) {
    const storage = memoryStorage();
    storage.values.set(HEALTH_BRANCH_STORAGE_KEY, JSON.stringify({ ...oldDraft, currentStep }));
    const draft = await createHealthBranchPersistence(storage).read();
    assert.equal(draft.currentStep, 'problem');
    assert.deepEqual([draft.healthProblem, draft.cookingFrequency, draft.mealPriority, draft.flexibleCommitment], [null, null, null, null]);
    assert.deepEqual([draft.healthDefinition, draft.healthBarrier, draft.mealToImprove, draft.foodStyles], ['less_takeout', 'not_enough_time', 'dinner', ['comfort_food']]);
  }
});
test('old completed drafts never reopen Q1 even with missing V3 fields and removed answers', async () => {
  for (const currentStep of ['complete', 'reassurance', 'reveal']) {
    const storage = memoryStorage();
    storage.values.set(HEALTH_BRANCH_STORAGE_KEY, JSON.stringify({ ...oldDraft, currentStep, branchCompleted: true }));
    const draft = await createHealthBranchPersistence(storage).read();
    assert.equal(draft.branchCompleted, true);
    assert.equal(draft.currentStep, currentStep === 'reveal' ? 'reveal' : 'complete');
    assert.equal(draft.healthProblem, null);
  }
});
test('equivalent legacy commitments map without a version bump', async () => {
  for (const [before, after] of [['small_changes_daily', 'small_changes_days'], ['improve_gradually', 'one_change_at_a_time'], ['few_meals_weekly', 'few_meals_weekly']]) {
    const storage = memoryStorage();
    storage.values.set(HEALTH_BRANCH_STORAGE_KEY, JSON.stringify({ ...oldDraft, flexibleCommitment: before }));
    const draft = await createHealthBranchPersistence(storage).read();
    assert.equal(draft.version, 1);
    assert.equal(draft.flexibleCommitment, after);
  }
});

test('canonical completion stays authoritative over an old Health draft during app hydration', async () => {
  const storage = memoryStorage();
  storage.values.set(HEALTH_BRANCH_STORAGE_KEY, JSON.stringify({ ...oldDraft, branchCompleted: true, currentStep: 'complete' }));
  storage.values.set(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
  const [completed, health] = await Promise.all([
    createOnboardingPersistence(storage).readCompleted(),
    createHealthBranchPersistence(storage).read(),
  ]);
  assert.equal(getStartupRoute(getOnboardingStartupStatus(completed)), 'MainTabs');
  assert.equal(health.branchCompleted, true);
  assert.equal(health.currentStep, 'complete');
  assert.equal(health.healthProblem, null);
  assert.equal(health.cookingFrequency, null);
  assert.equal(health.mealPriority, null);
  assert.equal(await storage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY), 'true');
});
