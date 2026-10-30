import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYTICS_ID_STORAGE_KEY, getAnalyticsDistinctId, getAnalyticsIdentityRevision,
  resetAnalyticsDistinctId, resetAnalyticsIdentityForTests,
} from './analyticsIdentity';

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: async () => value,
    setItem: async (_key: string, next: string) => { value = next; },
    value: () => value,
  };
}

test('analytics identity is a local random ID and is reused without auth or session identifiers', async () => {
  resetAnalyticsIdentityForTests();
  const storage = memoryStorage();
  const first = await getAnalyticsDistinctId(storage);
  const again = await getAnalyticsDistinctId(storage);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.equal(again, first);
  assert.equal(storage.value(), first);
  assert.equal(ANALYTICS_ID_STORAGE_KEY, 'okyo:analytics-id:v1');
});

test('confirmed account deletion rotates and persists the anonymous analytics identity', async () => {
  resetAnalyticsIdentityForTests();
  const storage = memoryStorage();
  const before = await getAnalyticsDistinctId(storage);
  const revision = getAnalyticsIdentityRevision();
  await resetAnalyticsDistinctId(storage);
  const after = await getAnalyticsDistinctId(storage);
  assert.notEqual(after, before);
  assert.equal(storage.value(), after);
  assert.equal(getAnalyticsIdentityRevision(), revision + 1);
});

