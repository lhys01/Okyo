import assert from 'node:assert/strict';
import test from 'node:test';

import { runWithRequestContext } from '../observability/requestContext.js';
import { resetAiExecutionGuardForTests } from './aiExecutionGuard.js';
import { createMockLoadTestScan, isSafeLocalLoadTestEnvironment, MockLoadTestError } from './loadTestMock.js';

const isolated = {
  NODE_ENV: 'development', OKYO_LOAD_TEST_MODE: 'true', OKYO_LOAD_TEST_TARGET: 'local',
  AI_ENABLED: 'false', FABLE_ENABLED: 'false', EPICURE_ENABLED: 'false', ANALYTICS_ENABLED: 'off',
};

test('local mock refuses credentials, Railway, analytics, AI, and production', () => {
  assert.equal(isSafeLocalLoadTestEnvironment(isolated), true);
  for (const blocked of [
    { NODE_ENV: 'production' }, { OPENROUTER_API_KEY: 'set' },
    { DATABASE_URL: 'set' }, { CLERK_SECRET_KEY: 'set' },
    { POSTHOG_API_KEY: 'set' }, { RAILWAY_PROJECT_ID: 'set' },
    { SENTRY_DSN: 'set' }, { APPLE_SIGN_IN_PRIVATE_KEY: 'set' },
    { ANALYTICS_ENABLED: 'development' }, { AI_ENABLED: 'true' },
    { EPICURE_ENABLED: 'true' },
  ]) assert.equal(isSafeLocalLoadTestEnvironment({ ...isolated, ...blocked }), false);
});

test('mock scan is deterministic and optional nutrition can be absent', async () => {
  resetAiExecutionGuardForTests();
  const first = await createMockLoadTestScan({ scenario: 'immediate', idempotencyKey: 'load_user_a:action_a' });
  const repeat = await createMockLoadTestScan({ scenario: 'immediate', idempotencyKey: 'load_user_a:action_a' });
  const other = await createMockLoadTestScan({ scenario: 'immediate', idempotencyKey: 'load_user_b:action_a' });
  const noNutrition = await createMockLoadTestScan({ scenario: 'missing-nutrition', idempotencyKey: 'load_user_a:action_b' });
  assert.equal(first.scan.id, repeat.scan.id);
  assert.notEqual(first.scan.id, other.scan.id);
  assert.equal(first.recipe?.scanResultId, first.scan.id);
  assert.equal(noNutrition.recipe?.nutritionEstimate, undefined);
});

test('mock provider errors and timeout are terminal, typed responses', async () => {
  resetAiExecutionGuardForTests();
  for (const [scenario, status] of [['429', 503], ['500', 502], ['malformed', 502], ['retryable-failure', 503], ['timeout', 504]] as const) {
    resetAiExecutionGuardForTests();
    await assert.rejects(
      () => createMockLoadTestScan({ scenario, delayMs: 0, idempotencyKey: `load_${scenario}` }),
      (error: unknown) => error instanceof MockLoadTestError && error.status === status,
    );
  }
});

test('mock delay is cancelled by the request deadline', async () => {
  resetAiExecutionGuardForTests();
  const controller = new AbortController();
  const work = runWithRequestContext({ requestId: 'load_request', anonId: null, abortSignal: controller.signal },
    () => createMockLoadTestScan({ scenario: '5s', delayMs: 1_000, idempotencyKey: 'load_abort' }));
  controller.abort(new Error('deadline'));
  await assert.rejects(work, /deadline/);
});
