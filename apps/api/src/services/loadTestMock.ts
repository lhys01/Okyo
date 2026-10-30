import { createHash } from 'node:crypto';

import { mockRecipes, mockScanResults } from '../mockData.js';
import { getRequestAbortSignal } from '../observability/requestContext.js';
import { runWithAiExecutionGuard } from './aiExecutionGuard.js';
import type { AiScanSuccessResult } from './aiService.js';

type Environment = Record<string, string | undefined>;

/** A load-test process must be unmistakably local and unable to reach vendors. */
export function isSafeLocalLoadTestEnvironment(env: Environment): boolean {
  return env.NODE_ENV === 'development' &&
    env.OKYO_LOAD_TEST_MODE === 'true' &&
    env.OKYO_LOAD_TEST_TARGET === 'local' &&
    env.AI_ENABLED === 'false' &&
    env.FABLE_ENABLED === 'false' &&
    env.EPICURE_ENABLED === 'false' &&
    env.ANALYTICS_ENABLED === 'off' &&
    [
      'DATABASE_URL', 'OPENROUTER_API_KEY', 'CLERK_SECRET_KEY',
      'POSTHOG_API_KEY', 'POSTHOG_PROJECT_API_KEY',
      'SENTRY_DSN', 'APPLE_SIGN_IN_PRIVATE_KEY',
      'RAILWAY_ENVIRONMENT', 'RAILWAY_PROJECT_ID', 'RAILWAY_SERVICE_ID',
    ].every((name) => !env[name]?.trim());
}

export class MockLoadTestError extends Error {
  readonly failure: { reason: string; httpStatus: number };
  constructor(readonly status: number, readonly code: string, reason = code) {
    super(code);
    this.name = 'MockLoadTestError';
    this.failure = { reason, httpStatus: status };
  }
}

export const mockLoadTestScenarios = [
  'immediate', '5s', '15s', '30s', 'near-timeout', 'timeout',
  '429', '500', 'malformed', 'missing-nutrition', 'retryable-failure',
] as const;
export type MockLoadTestScenario = typeof mockLoadTestScenarios[number];

export function parseMockLoadTestScenario(value: string | undefined): MockLoadTestScenario {
  if (!value || value === 'immediate') return 'immediate';
  if (mockLoadTestScenarios.includes(value as MockLoadTestScenario)) return value as MockLoadTestScenario;
  throw new MockLoadTestError(400, 'invalid_load_test_scenario');
}

export async function createMockLoadTestScan(input: {
  scenario: MockLoadTestScenario;
  delayMs?: number;
  idempotencyKey: string;
}): Promise<AiScanSuccessResult> {
  const delays: Record<MockLoadTestScenario, number> = {
    immediate: 0, '5s': 5_000, '15s': 15_000, '30s': 30_000,
    'near-timeout': 52_000, timeout: 55_000,
    '429': 0, '500': 0, malformed: 0, 'missing-nutrition': 0,
    'retryable-failure': 0,
  };
  const delayMs = input.delayMs === undefined ? delays[input.scenario] : input.delayMs;
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
    throw new MockLoadTestError(400, 'invalid_load_test_delay');
  }
  return runWithAiExecutionGuard({ stage: 'load_test_mock', operation: async () => {
    await waitForMockProvider(delayMs, getRequestAbortSignal());
    if (input.scenario === 'timeout') throw new MockLoadTestError(504, 'request_timeout', 'openrouter_timeout');
    if (input.scenario === '429') throw new MockLoadTestError(503, 'ai_temporarily_unavailable', 'openrouter_http_error');
    if (input.scenario === '500') throw new MockLoadTestError(502, 'ai_temporarily_unavailable', 'openrouter_http_error');
    if (input.scenario === 'retryable-failure') throw new MockLoadTestError(503, 'ai_temporarily_unavailable', 'openrouter_network_error');
    if (input.scenario === 'malformed') throw new MockLoadTestError(502, 'recipe_validation_failed', 'invalid_json');

    const id = `load_${createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 24)}`;
    const scan = { ...mockScanResults[0]!, id, recipeId: `recipe_${id}`, groceryListId: `grocery_${id}`, shareCardId: `share_${id}` };
    const recipe = { ...mockRecipes[0]!, id: scan.recipeId, scanResultId: id };
    if (input.scenario === 'missing-nutrition') delete recipe.nutritionEstimate;
    return {
      status: 'success', scan, recipe,
      note: 'Local synthetic result. Costs and nutrition are estimates.',
      aiSource: 'openrouter_ai', aiProvider: 'openrouter',
      visionModel: 'local-mock', recipeModel: 'local-mock',
      confidence: scan.confidence, scanState: scan.scanState ?? 'clear_food',
      uploadedImage: true,
    };
  } });
}

function waitForMockProvider(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (delayMs === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, delayMs);
    signal?.addEventListener('abort', abort, { once: true });
    function done() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(signal?.reason ?? new MockLoadTestError(504, 'request_timeout'));
    }
  });
}
