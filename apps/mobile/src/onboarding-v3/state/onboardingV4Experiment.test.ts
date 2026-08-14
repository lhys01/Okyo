import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOnboardingV4ExperimentAssignment,
  ONBOARDING_V4_EXPERIMENT_STORAGE_KEY,
} from './onboardingV4Experiment';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
  };
}

test('a fresh install defaults safely to v3 and persists that assignment', async () => {
  const storage = createMemoryStorage();
  const assignment = createOnboardingV4ExperimentAssignment(storage);

  assert.equal(await assignment.getAssignment(), 'v3');
  assert.equal(storage.values.get(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY), 'v3');
});

test('the assignment survives a simulated restart (new instance, same underlying storage)', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY, 'v4');

  const firstRun = createOnboardingV4ExperimentAssignment(storage);
  assert.equal(await firstRun.getAssignment(), 'v4');

  const afterRestart = createOnboardingV4ExperimentAssignment(storage);
  assert.equal(await afterRestart.getAssignment(), 'v4');
});

test('an assigned user is never silently switched on repeated reads', async () => {
  const storage = createMemoryStorage();
  const assignment = createOnboardingV4ExperimentAssignment(storage);

  const first = await assignment.getAssignment();
  for (let i = 0; i < 5; i += 1) {
    assert.equal(await assignment.getAssignment(), first);
  }
});

test('a deterministic override always wins, ignoring and never touching storage', async () => {
  const storage = createMemoryStorage();
  const assignment = createOnboardingV4ExperimentAssignment(storage, 'v4');

  assert.equal(await assignment.getAssignment(), 'v4');
  assert.equal(storage.values.has(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY), false);
});

test('a missing stored value falls back to v3 and writes the fallback', async () => {
  const storage = createMemoryStorage();
  const assignment = createOnboardingV4ExperimentAssignment(storage);

  assert.equal(await assignment.getAssignment(), 'v3');
  assert.equal(storage.values.get(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY), 'v3');
});

test('malformed stored values (JSON, empty string, numeric string) fall back to v3', async () => {
  for (const malformed of ['{"assignment":"v4"}', '', '1', 'true', 'null']) {
    const storage = createMemoryStorage();
    storage.values.set(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY, malformed);
    const assignment = createOnboardingV4ExperimentAssignment(storage);

    assert.equal(await assignment.getAssignment(), 'v3');
    assert.equal(storage.values.get(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY), 'v3');
  }
});

test('an unknown but well-formed stored value falls back to v3', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY, 'v5');
  const assignment = createOnboardingV4ExperimentAssignment(storage);

  assert.equal(await assignment.getAssignment(), 'v3');
  assert.equal(storage.values.get(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY), 'v3');
});

test('a legitimate v4 assignment is honored as-is, never overwritten back to v3', async () => {
  const storage = createMemoryStorage();
  storage.values.set(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY, 'v4');
  const assignment = createOnboardingV4ExperimentAssignment(storage);

  assert.equal(await assignment.getAssignment(), 'v4');
  assert.equal(storage.values.get(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY), 'v4');
});
