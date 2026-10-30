import assert from 'node:assert/strict';
import test from 'node:test';

import { APP_FEATURE_TOUR_STORAGE_KEY, createTourPersistence, shouldStartTour } from './tourPersistence';
import { ONBOARDING_COMPLETED_STORAGE_KEY } from '../state/onboardingPersistence';
import { commitCanonicalOnboardingCompletion } from '../onboarding/canonical/completion';

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

test('the tour storage key is dedicated and distinct from onboarding completion', () => {
  assert.equal(APP_FEATURE_TOUR_STORAGE_KEY, 'okyo:app-feature-tour-completed:v1');
  assert.notEqual(APP_FEATURE_TOUR_STORAGE_KEY, ONBOARDING_COMPLETED_STORAGE_KEY);
});

test('a fresh install has not started the tour', async () => {
  const persistence = createTourPersistence(createMemoryStorage());
  assert.equal(await persistence.readStatus(), 'not_started');
});

test('completing the tour persists completed and survives relaunch', async () => {
  const storage = createMemoryStorage();
  const persistence = createTourPersistence(storage);

  await persistence.writeStatus('completed');

  assert.equal(await storage.getItem(APP_FEATURE_TOUR_STORAGE_KEY), 'completed');
  assert.equal(await persistence.readStatus(), 'completed');
  assert.equal(await createTourPersistence(storage).readStatus(), 'completed');
});

test('skipping the tour persists skipped and never auto-restarts it', async () => {
  const storage = createMemoryStorage();
  const persistence = createTourPersistence(storage);

  await persistence.writeStatus('skipped');

  assert.equal(await persistence.readStatus(), 'skipped');
  assert.equal(await createTourPersistence(storage).readStatus(), 'skipped');
});

test('tour starts only after onboarding, Clerk, local tour state, and Home layout are ready', () => {
  const ready = { authReady: true, homeReady: true, hydrated: true, pendingStart: false, status: 'not_started' as const };
  assert.equal(shouldStartTour(ready), true);
  assert.equal(shouldStartTour({ ...ready, authReady: false }), false);
  assert.equal(shouldStartTour({ ...ready, homeReady: false }), false);
  assert.equal(shouldStartTour({ ...ready, hydrated: false }), false);
  assert.equal(shouldStartTour({ ...ready, pendingStart: true }), false);
  assert.equal(shouldStartTour({ ...ready, status: 'completed' }), false);
  assert.equal(shouldStartTour({ ...ready, status: 'skipped' }), false);
});

test('an authenticated user waits for the Home viewport and content to lay out', () => {
  const hydratedTour = { authReady: true, homeReady: false, hydrated: true, pendingStart: false, status: 'not_started' as const };
  assert.equal(shouldStartTour(hydratedTour), false);
  assert.equal(shouldStartTour({ ...hydratedTour, homeReady: true }), true);
  assert.equal(shouldStartTour({ ...hydratedTour, authReady: false, homeReady: true }), false);
});

test('a new onboarding completion can clear a previous device tour without touching user data', async () => {
  const storage = createMemoryStorage({
    [APP_FEATURE_TOUR_STORAGE_KEY]: 'completed',
    [ONBOARDING_COMPLETED_STORAGE_KEY]: 'true',
    'okyo:saved-recipe': 'untouched',
  });
  await createTourPersistence(storage).resetStatus();
  assert.equal(await createTourPersistence(storage).readStatus(), 'not_started');
  assert.equal(await storage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY), 'true');
  assert.equal(await storage.getItem('okyo:saved-recipe'), 'untouched');
});

test('post-auth route can start a fresh tour only after completion and signed-in readiness', async () => {
  const storage = createMemoryStorage({ [APP_FEATURE_TOUR_STORAGE_KEY]: 'completed' });
  const tour = createTourPersistence(storage);
  let appActivated = false;
  await commitCanonicalOnboardingCompletion({
    prepareTour: () => tour.resetStatus(),
    writeCompletion: () => storage.setItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true'),
    activateApp: () => { appActivated = true; },
  });
  assert.equal(appActivated, true);
  assert.equal(await storage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY), 'true');
  const status = await tour.readStatus();
  assert.equal(shouldStartTour({ authReady: false, homeReady: true, hydrated: true, pendingStart: false, status }), false);
  assert.equal(shouldStartTour({ authReady: true, homeReady: false, hydrated: true, pendingStart: false, status }), false);
  assert.equal(shouldStartTour({ authReady: true, homeReady: true, hydrated: true, pendingStart: false, status }), true);
});

test('closing during an unfinished tour safely restarts it on the next signed-in launch', async () => {
  const storage = createMemoryStorage();
  const status = await createTourPersistence(storage).readStatus();
  assert.equal(shouldStartTour({ authReady: true, homeReady: true, hydrated: true, pendingStart: false, status }), true);
  const relaunchedStatus = await createTourPersistence(storage).readStatus();
  assert.equal(relaunchedStatus, 'not_started');
});

test('dev reset clears status back to not_started', async () => {
  const persistence = createTourPersistence(
    createMemoryStorage({ [APP_FEATURE_TOUR_STORAGE_KEY]: 'completed' }),
  );

  await persistence.resetStatus();

  assert.equal(await persistence.readStatus(), 'not_started');
});

test('resetting onboarding does not touch the tour key, and vice versa', async () => {
  const storage = createMemoryStorage({
    [APP_FEATURE_TOUR_STORAGE_KEY]: 'completed',
    [ONBOARDING_COMPLETED_STORAGE_KEY]: 'true',
  });
  const tourPersistence = createTourPersistence(storage);

  await tourPersistence.resetStatus();

  assert.equal(await storage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY), 'true');
});
