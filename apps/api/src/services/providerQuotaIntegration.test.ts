import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiConfig } from '../config/aiConfig.js';
import { QuotaDeniedError, type ProviderQuota } from '../quota/providerQuota.js';
import type { RecipeStep } from '../types.js';
import { repairStepCoachingWithAI } from './openRouterProvider.js';

const config: AiConfig = {
  enabled: true,
  provider: 'openrouter',
  openRouterApiKey: 'server-only-test-key',
  openRouterVisionModel: 'vision-model',
  openRouterTextModel: 'primary-model',
  timeoutMs: 1000,
  maxOutputTokens: 1024,
  fableEnabled: false,
  fableModel: 'fable-model',
  isFableActive: false,
};

const steps: RecipeStep[] = [{
  title: 'Brown chicken',
  text: 'Brown the chicken in the skillet.',
  ingredientsUsed: ['chicken'],
  toolsUsed: ['skillet'],
}];

test('reservation happens before fetch and denial prevents provider invocation', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run');
  };
  const quota: ProviderQuota = {
    reserveAttempt: async () => { throw new QuotaDeniedError(); },
    completeAttempt: async () => undefined,
  };
  try {
    await assert.rejects(
      repairStepCoachingWithAI({
        steps,
        weaknesses: [{ stepIndex: 0, weakFields: ['why'] }],
        dishName: 'Chicken',
        config,
        quota,
      }),
      QuotaDeniedError,
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('each billable fallback model attempt is separately reserved and finalized', async () => {
  const originalFetch = globalThis.fetch;
  const events: string[] = [];
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    events.push(`fetch:${fetchCalls}`);
    if (fetchCalls === 1) {
      return new Response(JSON.stringify({ error: { message: 'provider rejected request' } }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"steps":[{"index":0,"why":"Browning builds flavor."}]}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 80, completion_tokens: 12, total_tokens: 92, cost: 0.0004 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  let reservationNumber = 0;
  const completions: Array<{ operation: string; outcome: string; inputTokens?: number }> = [];
  const quota: ProviderQuota = {
    reserveAttempt: async ({ model, operation }) => {
      reservationNumber += 1;
      events.push(`reserve:${model}`);
      return { spendEventId: `event-${reservationNumber}`, operation };
    },
    completeAttempt: async (reservation, completion) => {
      events.push(`complete:${completion.outcome}`);
      completions.push({
        operation: reservation.operation,
        outcome: completion.outcome,
        inputTokens: completion.inputTokens,
      });
    },
  };

  try {
    const result = await repairStepCoachingWithAI({
      steps,
      weaknesses: [{ stepIndex: 0, weakFields: ['why'] }],
      dishName: 'Chicken',
      config,
      quota,
    });
    assert.equal(result[0].why, 'Browning builds flavor.');
    assert.deepEqual(events.slice(0, 6), [
      'reserve:primary-model',
      'fetch:1',
      'complete:failure',
      'reserve:google/gemini-3.1-flash-lite',
      'fetch:2',
      'complete:success',
    ]);
    assert.deepEqual(completions, [
      { operation: 'coaching_repair', outcome: 'failure', inputTokens: undefined },
      { operation: 'coaching_repair', outcome: 'success', inputTokens: 80 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
