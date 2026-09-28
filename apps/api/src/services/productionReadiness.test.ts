import assert from 'node:assert/strict';
import test from 'node:test';
import { useDatabaseForTests } from '../persistence/database.js';
import { productionReadiness, resetProductionReadinessProbesForTests } from './productionReadiness.js';

function restoreEnvironment(saved: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}

test('production readiness fails closed without durable persistence and never probes providers', async () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    process.env.NODE_ENV = 'production';
    process.env.AI_ENABLED = 'true';
    process.env.PRODUCTION_AI_ENABLED = 'true';
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-not-a-real-test-key';
    process.env.CLERK_SECRET_KEY = 'sk_live_not_a_real_test_key';
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://okyo.example.test';
    process.env.QUOTA_SCOPE_HMAC_KEY = 'test-only-scope-key-with-at-least-32-characters';
    delete process.env.DATABASE_URL;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error('readiness must not make network requests');
    };

    resetProductionReadinessProbesForTests();
    const readiness = await productionReadiness();

    assert.equal(readiness.persistentStateConfigured, false);
    assert.equal(readiness.persistentStateHealthy, false);
    assert.equal(readiness.databaseConnectivity, 'unavailable');
    assert.equal(readiness.productionAiEnabled, false);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    resetProductionReadinessProbesForTests();
    useDatabaseForTests();
    restoreEnvironment(savedEnv);
  }
});

test('production readiness accepts only healthy durable persistence and local prerequisites', async () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    process.env.NODE_ENV = 'production';
    process.env.AI_ENABLED = 'true';
    process.env.PRODUCTION_AI_ENABLED = 'true';
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-not-a-real-test-key';
    process.env.CLERK_SECRET_KEY = 'sk_live_not_a_real_test_key';
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://okyo.example.test';
    process.env.QUOTA_SCOPE_HMAC_KEY = 'test-only-scope-key-with-at-least-32-characters';
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error('readiness must not make network requests');
    };
    useDatabaseForTests({
      query: async (statement) => statement.includes('WITH probe')
        ? { rows: [{ id: 'probe' }] }
        : { rows: [{ quota: true, cleanup: true, schema_usage: true, runtime_dml: true, quota_dml: true }] },
    });

    const readiness = await productionReadiness();

    assert.equal(readiness.persistentStateConfigured, true);
    assert.equal(readiness.persistentStateHealthy, true);
    assert.equal(readiness.databaseConnectivity, 'available');
    assert.equal(readiness.productionAiEnabled, true);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    resetProductionReadinessProbesForTests();
    useDatabaseForTests();
    restoreEnvironment(savedEnv);
  }
});
