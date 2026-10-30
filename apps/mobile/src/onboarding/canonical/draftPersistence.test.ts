import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalVersionedDraftPersistence } from './draftPersistence';

function memoryStorage(values = new Map<string, string>()) {
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('versioned draft persistence preserves each caller’s normalizer and key', async () => {
  const storage = memoryStorage();
  const persistence = createCanonicalVersionedDraftPersistence({
    storage,
    storageKey: 'branch-key',
    normalize: (value) => ({ version: 7, answer: typeof (value as { answer?: unknown } | null)?.answer === 'string' ? (value as { answer: string }).answer : null }),
  });

  assert.deepEqual(await persistence.read(), { version: 7, answer: null });
  assert.deepEqual(await persistence.write({ answer: 'kept' }), { version: 7, answer: 'kept' });
  assert.equal(storage.values.get('branch-key'), JSON.stringify({ version: 7, answer: 'kept' }));
  assert.deepEqual(await persistence.read(), { version: 7, answer: 'kept' });
});

test('malformed storage uses the caller’s normalized fallback and reset removes only its key', async () => {
  const storage = memoryStorage(new Map([['branch-key', '{not json']]));
  const persistence = createCanonicalVersionedDraftPersistence({
    storage,
    storageKey: 'branch-key',
    normalize: (value) => ({ fallback: value === null }),
  });

  assert.deepEqual(await persistence.read(), { fallback: true });
  await persistence.reset();
  assert.equal(storage.values.has('branch-key'), false);
});
