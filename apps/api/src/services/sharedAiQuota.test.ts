import assert from 'node:assert/strict';
import test from 'node:test';

import { reserveGlobalAiProviderCall, resetCostControlsForTests } from '../middleware/costControls.js';
import {
  configureSharedAiQuotaStore,
  isSharedAiQuotaStoreConfigured,
  resetSharedAiQuotaStoreForTests,
  reserveSharedGlobalAiQuota,
  SharedAiQuotaUnavailableError,
  type SharedAiQuotaStore,
} from './sharedAiQuota.js';

function fakeAtomicStore(limit: number): SharedAiQuotaStore {
  let count = 0;
  return {
    async reserveGlobalDaily() {
      // Increment synchronously before yielding to emulate a backend atomic op.
      if (count >= limit) return null;
      count += 1;
      return { reservationId: `test-reservation-${count}` };
    },
  };
}

test('simultaneous reservations respect an atomic shared store limit', async () => {
  configureSharedAiQuotaStore(fakeAtomicStore(3));
  try {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserveSharedGlobalAiQuota({
      key: 'test:global:daily', limit: 3,
    })));
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 3);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 17);
  } finally {
    resetSharedAiQuotaStoreForTests();
  }
});

test('missing or unavailable shared quota storage fails closed', async () => {
  resetSharedAiQuotaStoreForTests();
  assert.equal(isSharedAiQuotaStoreConfigured(), false);
  await assert.rejects(reserveSharedGlobalAiQuota({ key: 'test:daily', limit: 1 }), SharedAiQuotaUnavailableError);

  configureSharedAiQuotaStore({ reserveGlobalDaily: async () => { throw new Error('storage down'); } });
  await assert.rejects(reserveSharedGlobalAiQuota({ key: 'test:daily', limit: 1 }), SharedAiQuotaUnavailableError);
  resetSharedAiQuotaStoreForTests();
});

test('production provider reservations use shared storage and fail closed without it', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldCap = process.env.AI_DAILY_REQUEST_CAP;
  process.env.NODE_ENV = 'production';
  process.env.AI_DAILY_REQUEST_CAP = '2';
  resetSharedAiQuotaStoreForTests();
  resetCostControlsForTests();
  try {
    await assert.rejects(reserveGlobalAiProviderCall(), SharedAiQuotaUnavailableError);
    const calls: Array<{ key: string; limit: number }> = [];
    configureSharedAiQuotaStore({
      reserveGlobalDaily: async ({ key, limit }) => {
        calls.push({ key, limit });
        return { reservationId: `id-${calls.length}` };
      },
    });
    await Promise.all([reserveGlobalAiProviderCall(), reserveGlobalAiProviderCall()]);
    assert.deepEqual(calls, [
      { key: 'okyo:ai-provider-calls:global:daily', limit: 2 },
      { key: 'okyo:ai-provider-calls:global:daily', limit: 2 },
    ]);
  } finally {
    resetSharedAiQuotaStoreForTests();
    resetCostControlsForTests();
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
    if (oldCap === undefined) delete process.env.AI_DAILY_REQUEST_CAP;
    else process.env.AI_DAILY_REQUEST_CAP = oldCap;
  }
});
