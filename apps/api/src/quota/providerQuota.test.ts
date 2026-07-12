import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProviderQuota,
  getQuotaApiError,
  QuotaDeniedError,
  QuotaUnavailableError,
} from './providerQuota.js';
import type { QuotaRepository } from './quotaRepository.js';

const trustedUserId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';

test('reservation uses trusted identity, server caps, and no caller-controlled UTC window', async () => {
  await withCaps('7', '81', async () => {
    let received: Parameters<QuotaRepository['reserve']>[0] | undefined;
    const quota = createProviderQuota({
      userId: trustedUserId,
      requestId,
      repository: makeRepository({
        reserve: async (input) => {
          received = input;
          return { allowed: true, reason: null, spendEventId: 'event-1' };
        },
      }),
    });

    await quota.reserveAttempt({ provider: 'openrouter', model: 'server/model', operation: 'vision' });

    assert.equal(received?.userId, trustedUserId);
    assert.equal(received?.userDailyCap, 7);
    assert.equal(received?.globalDailyCap, 81);
    assert.equal(received?.provider, 'openrouter');
    assert.equal(received?.model, 'server/model');
    assert.equal('windowDate' in (received ?? {}), false);
    assert.equal('p_window_date' in (received ?? {}), false);
  });
});

test('denied and failed persistent reservations fail closed', async () => {
  const denied = createProviderQuota({
    userId: trustedUserId,
    requestId,
    repository: makeRepository({
      reserve: async () => ({ allowed: false, reason: 'user_daily_cap', spendEventId: null }),
    }),
  });
  await assert.rejects(
    denied.reserveAttempt({ provider: 'openrouter', model: 'model', operation: 'vision' }),
    QuotaDeniedError,
  );

  const unavailable = createProviderQuota({
    userId: trustedUserId,
    requestId,
    repository: makeRepository({ reserve: async () => { throw new Error('private database detail'); } }),
  });
  await assert.rejects(
    unavailable.reserveAttempt({ provider: 'openrouter', model: 'model', operation: 'vision' }),
    QuotaUnavailableError,
  );
});

test('explicitly invalid caps prevent the RPC and provider permission', async () => {
  await withCaps('invalid', '200', async () => {
    let called = false;
    const quota = createProviderQuota({
      userId: trustedUserId,
      requestId,
      repository: makeRepository({ reserve: async () => {
        called = true;
        return { allowed: true, reason: null, spendEventId: 'event-1' };
      } }),
    });
    await assert.rejects(
      quota.reserveAttempt({ provider: 'openrouter', model: 'model', operation: 'vision' }),
      QuotaUnavailableError,
    );
    assert.equal(called, false);
  });
});

test('concurrent attempts each use the persistent reservation boundary', async () => {
  let calls = 0;
  const quota = createProviderQuota({
    userId: trustedUserId,
    requestId,
    repository: makeRepository({ reserve: async () => {
      calls += 1;
      return { allowed: true, reason: null, spendEventId: `event-${calls}` };
    } }),
  });
  await Promise.all([
    quota.reserveAttempt({ provider: 'openrouter', model: 'model-a', operation: 'vision' }),
    quota.reserveAttempt({ provider: 'openrouter', model: 'model-b', operation: 'recipe' }),
  ]);
  assert.equal(calls, 2);
});

test('completion finalizes the RPC-created spend event with sanitized reliable usage', async () => {
  const completions: Parameters<QuotaRepository['complete']>[0][] = [];
  const quota = createProviderQuota({
    userId: trustedUserId,
    requestId,
    repository: makeRepository({ complete: async (input) => { completions.push(input); } }),
  });
  const reservation = await quota.reserveAttempt({
    provider: 'openrouter',
    model: 'model',
    operation: 'recipe_retry',
  });
  await quota.completeAttempt(reservation, {
    outcome: 'success',
    inputTokens: 123,
    outputTokens: 45,
    actualCostUsd: 0.0012,
  });

  assert.equal(completions.length, 1);
  assert.equal(completions[0].userId, trustedUserId);
  assert.equal(completions[0].spendEventId, 'event-1');
  assert.deepEqual(completions[0].spend, {
    requestCategory: `${requestId}:recipe_retry:success`,
    inputTokens: 123,
    outputTokens: 45,
    estimatedCostUsd: 0.0012,
  });
  const serialized = JSON.stringify(completions[0]);
  for (const forbidden of ['prompt', 'image', 'authorization', 'jwt', 'completion']) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
});

test('spend finalization failure is telemetry-only and cannot request a duplicate attempt', async () => {
  let reservations = 0;
  const quota = createProviderQuota({
    userId: trustedUserId,
    requestId,
    repository: makeRepository({
      reserve: async () => {
        reservations += 1;
        return { allowed: true, reason: null, spendEventId: 'event-1' };
      },
      complete: async () => { throw new Error('write failed'); },
    }),
  });
  const reservation = await quota.reserveAttempt({ provider: 'openrouter', model: 'model', operation: 'vision' });
  await quota.completeAttempt(reservation, { outcome: 'failure', failureCategory: 'openrouter_timeout' });
  assert.equal(reservations, 1);
});

test('quota errors map to stable sanitized API responses', () => {
  assert.deepEqual(getQuotaApiError(new QuotaDeniedError()), {
    status: 429,
    code: 'scan_limit_reached',
    message: 'Your daily scan capacity has been reached. Please try again tomorrow.',
  });
  assert.deepEqual(getQuotaApiError(new QuotaUnavailableError()), {
    status: 503,
    code: 'capacity_unavailable',
    message: 'Scan capacity is temporarily unavailable. Please try again.',
  });
  assert.equal(getQuotaApiError(new Error('SQL secret')), null);
});

function makeRepository(overrides: Partial<QuotaRepository> = {}): QuotaRepository {
  return {
    reserve: async () => ({ allowed: true, reason: null, spendEventId: 'event-1' }),
    complete: async () => undefined,
    ...overrides,
  };
}

async function withCaps(userCap: string, globalCap: string, run: () => Promise<void>) {
  const previousUser = process.env.AI_USER_DAILY_REQUEST_CAP;
  const previousGlobal = process.env.AI_DAILY_REQUEST_CAP;
  process.env.AI_USER_DAILY_REQUEST_CAP = userCap;
  process.env.AI_DAILY_REQUEST_CAP = globalCap;
  try {
    await run();
  } finally {
    restoreEnv('AI_USER_DAILY_REQUEST_CAP', previousUser);
    restoreEnv('AI_DAILY_REQUEST_CAP', previousGlobal);
  }
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
