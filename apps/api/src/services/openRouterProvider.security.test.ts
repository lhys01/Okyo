import assert from 'node:assert/strict';
import test from 'node:test';

import { resetCostControlsForTests, getGlobalAiRequestCount } from '../middleware/costControls.js';
import { callOpenRouterJson, callOpenRouterJsonWithFailover, type CallJsonBase } from './openRouterProvider.js';

const base: CallJsonBase = {
  config: {
    enabled: true,
    provider: 'openrouter',
    openRouterApiKey: 'test-only-placeholder',
    openRouterVisionModel: 'openai/gpt-4o-mini',
    openRouterTextModel: 'openai/gpt-4o-mini',
    timeoutMs: 1000,
    maxOutputTokens: 128,
    fableEnabled: false,
    fableModel: 'anthropic/claude-fable-5',
    isFableActive: false,
  },
  maxTokens: 64,
  messages: [{ role: 'user', content: 'test' }],
  stage: 'recipe_test',
};

test('unapproved provider models are rejected before fetch or quota reservation', async () => {
  const oldEnv = process.env.NODE_ENV;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  process.env.NODE_ENV = 'test';
  resetCostControlsForTests();
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not be called'); };
  try {
    await assert.rejects(
      callOpenRouterJson({ ...base, model: 'attacker/unapproved-model' }),
      (error: unknown) => Boolean(error && typeof error === 'object' && 'failure' in error &&
        (error as { failure: { reason: string } }).failure.reason === 'openrouter_model_not_allowed'),
    );
    assert.equal(fetchCalls, 0);
    assert.equal(getGlobalAiRequestCount(), 0);
  } finally {
    globalThis.fetch = originalFetch;
    resetCostControlsForTests();
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});

test('each actual fallback provider call reserves quota independently', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldCap = process.env.AI_DAILY_REQUEST_CAP;
  const originalFetch = globalThis.fetch;
  process.env.NODE_ENV = 'test';
  process.env.AI_DAILY_REQUEST_CAP = '2';
  resetCostControlsForTests();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response('{}', { status: 503 });
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }), { status: 200 });
  };
  try {
    const result = await callOpenRouterJsonWithFailover(base, [
      'openai/gpt-4o-mini', 'google/gemini-3.1-flash-lite',
    ]);
    assert.deepEqual(result, { ok: true });
    assert.equal(calls, 2);
    assert.equal(getGlobalAiRequestCount(), 2);
  } finally {
    globalThis.fetch = originalFetch;
    resetCostControlsForTests();
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
    if (oldCap === undefined) delete process.env.AI_DAILY_REQUEST_CAP;
    else process.env.AI_DAILY_REQUEST_CAP = oldCap;
  }
});

test('a failed provider attempt is not released and consumes its reservation', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldCap = process.env.AI_DAILY_REQUEST_CAP;
  const originalFetch = globalThis.fetch;
  process.env.NODE_ENV = 'test';
  process.env.AI_DAILY_REQUEST_CAP = '1';
  resetCostControlsForTests();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new TypeError('network unavailable'); };
  try {
    await assert.rejects(callOpenRouterJson({ ...base, model: 'openai/gpt-4o-mini' }));
    assert.equal(getGlobalAiRequestCount(), 1);
    await assert.rejects(callOpenRouterJson({ ...base, model: 'openai/gpt-4o-mini' }));
    assert.equal(calls, 1);
    assert.equal(getGlobalAiRequestCount(), 1);
  } finally {
    globalThis.fetch = originalFetch;
    resetCostControlsForTests();
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
    if (oldCap === undefined) delete process.env.AI_DAILY_REQUEST_CAP;
    else process.env.AI_DAILY_REQUEST_CAP = oldCap;
  }
});
