import assert from 'node:assert/strict';
import test from 'node:test';

import { getOnboardingStartupStatus, getStartupRoute } from './startupGate';
import { createOnboardingPersistence, ONBOARDING_COMPLETED_STORAGE_KEY } from '../state/onboardingPersistence';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem: async (key: string) => values.get(key) ?? null,
    removeItem: async (key: string) => {
      values.delete(key);
    },
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test('unresolved hydration does not render Home', () => {
  const status = getOnboardingStartupStatus(null);

  assert.equal(status, 'loading');
  assert.equal(getStartupRoute(status), null);
});

test('first launch renders onboarding', async () => {
  const persistence = createOnboardingPersistence(createMemoryStorage());
  const completed = await persistence.readCompleted();
  const status = getOnboardingStartupStatus(completed);

  assert.equal(completed, false);
  assert.equal(status, 'onboardingRequired');
  assert.equal(getStartupRoute(status), 'WelcomeScreen');
});

test('completed onboarding renders main tabs', () => {
  const status = getOnboardingStartupStatus(true);

  assert.equal(status, 'onboardingComplete');
  assert.equal(getStartupRoute(status), 'MainTabs');
});

test('completing onboarding persists the flag', async () => {
  const storage = createMemoryStorage();
  const persistence = createOnboardingPersistence(storage);

  await persistence.writeCompleted();

  assert.equal(await storage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY), 'true');
  assert.equal(await persistence.readCompleted(), true);
});

test('relaunch after completion skips onboarding', async () => {
  const persistence = createOnboardingPersistence(
    createMemoryStorage({ [ONBOARDING_COMPLETED_STORAGE_KEY]: 'true' }),
  );
  const status = getOnboardingStartupStatus(await persistence.readCompleted());

  assert.equal(getStartupRoute(status), 'MainTabs');
});

test('reset or absent storage key restores onboarding', async () => {
  const persistence = createOnboardingPersistence(
    createMemoryStorage({ [ONBOARDING_COMPLETED_STORAGE_KEY]: 'true' }),
  );

  await persistence.resetCompleted();
  const status = getOnboardingStartupStatus(await persistence.readCompleted());

  assert.equal(getStartupRoute(status), 'WelcomeScreen');
});

test('no stale legacy key incorrectly skips onboarding', async () => {
  const legacyState = JSON.stringify({
    state: {
      hasCompletedOnboarding: true,
      hasSeenOnboarding: true,
    },
    version: 0,
  });
  const persistence = createOnboardingPersistence(createMemoryStorage({ 'okyo-local-state': legacyState }));
  const status = getOnboardingStartupStatus(await persistence.readCompleted());

  assert.equal(getStartupRoute(status), 'WelcomeScreen');
});
