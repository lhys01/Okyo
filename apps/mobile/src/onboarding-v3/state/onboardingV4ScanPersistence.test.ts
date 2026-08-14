import assert from 'node:assert/strict';
import test from 'node:test';

import { createOnboardingV4ScanPersistence, ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY, ONBOARDING_V4_IN_FLIGHT_SCAN_KEY } from './onboardingV4ScanPersistence';

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('in-flight photo and description scans round-trip and clear durably', async () => {
  const storage = memoryStorage();
  const persistence = createOnboardingV4ScanPersistence(storage);
  const photo = { scanSessionId: 'scan-photo-1', source: 'camera' as const, imageUri: 'file:///photo.jpg', startedAt: '2026-08-13T10:00:00.000Z' };
  assert.deepEqual(await persistence.writeInFlightScan(photo), photo);
  assert.deepEqual(await persistence.readInFlightScan(), photo);
  const description = { scanSessionId: 'scan-description-1', source: 'description' as const, mealDescription: 'Spicy tofu bowl', startedAt: '2026-08-13T10:01:00.000Z' };
  await persistence.writeInFlightScan(description);
  assert.deepEqual(await persistence.readInFlightScan(), description);
  await persistence.clearInFlightScan();
  assert.equal(storage.values.has(ONBOARDING_V4_IN_FLIGHT_SCAN_KEY), false);
  assert.equal(await persistence.readInFlightScan(), null);
});

test('fresh persistence instance recovers an in-flight scan after an app kill', async () => {
  const storage = memoryStorage();
  const beforeKill = createOnboardingV4ScanPersistence(storage);
  await beforeKill.writeInFlightScan({ scanSessionId: 'resume-1', source: 'photos', imageUri: 'file:///cached.jpg', startedAt: '2026-08-13T10:00:00.000Z' });
  const afterRestart = createOnboardingV4ScanPersistence(storage);
  assert.deepEqual(await afterRestart.readInFlightScan(), { scanSessionId: 'resume-1', source: 'photos', imageUri: 'file:///cached.jpg', startedAt: '2026-08-13T10:00:00.000Z' });
});

test('free result defaults false and becomes true only when explicitly committed', async () => {
  const storage = memoryStorage();
  const persistence = createOnboardingV4ScanPersistence(storage);
  assert.equal(await persistence.readFreeRecipeConsumed(), false);
  assert.equal(storage.values.has(ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY), false);
  await persistence.writeFreeRecipeConsumed(true);
  assert.equal(await persistence.readFreeRecipeConsumed(), true);
});

test('malformed in-flight and consumption values default safely', async () => {
  const storage = memoryStorage({ [ONBOARDING_V4_IN_FLIGHT_SCAN_KEY]: '{bad json', [ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY]: 'yes' });
  const persistence = createOnboardingV4ScanPersistence(storage);
  assert.equal(await persistence.readInFlightScan(), null);
  assert.equal(await persistence.readFreeRecipeConsumed(), false);
});
