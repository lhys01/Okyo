import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AiCircuitOpenError,
  AiSaturatedError,
  resetAiExecutionGuardForTests,
  runWithAiExecutionGuard,
} from './aiExecutionGuard.js';

test('AI bulkhead rejects excess concurrent provider calls', async () => {
  const previous = process.env.AI_MAX_CONCURRENCY;
  process.env.AI_MAX_CONCURRENCY = '1';
  resetAiExecutionGuardForTests();
  let release!: () => void;
  const first = runWithAiExecutionGuard({
    stage: 'vision',
    operation: () => new Promise<string>((resolve) => { release = () => resolve('ok'); }),
  });
  try {
    await assert.rejects(
      () => runWithAiExecutionGuard({ stage: 'vision', operation: async () => 'never' }),
      AiSaturatedError,
    );
  } finally {
    release();
    await first;
    if (previous === undefined) delete process.env.AI_MAX_CONCURRENCY;
    else process.env.AI_MAX_CONCURRENCY = previous;
    resetAiExecutionGuardForTests();
  }
});

test('provider availability failures open the circuit and fail fast', async () => {
  const previousThreshold = process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
  process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD = '2';
  resetAiExecutionGuardForTests();
  const failure = Object.assign(new Error('provider unavailable'), {
    name: 'OpenRouterProviderError',
    failure: { reason: 'openrouter_http_error', httpStatus: 503 },
  });
  try {
    await assert.rejects(
      () => runWithAiExecutionGuard({ stage: 'recipe', operation: async () => { throw failure; } }),
    /provider unavailable/,
    );
    await assert.rejects(
      () => runWithAiExecutionGuard({ stage: 'recipe', operation: async () => { throw failure; } }),
      /provider unavailable/,
    );
    await assert.rejects(
      () => runWithAiExecutionGuard({ stage: 'recipe', operation: async () => 'never' }),
      AiCircuitOpenError,
    );
  } finally {
    if (previousThreshold === undefined) delete process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    else process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD = previousThreshold;
    resetAiExecutionGuardForTests();
  }
});
