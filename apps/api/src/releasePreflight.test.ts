import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { resolve } from 'node:path';

const script = resolve(process.cwd(), 'scripts', 'validate-release-configuration.mjs');

function runPreflight(overrides: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      AI_ENABLED: 'true',
      PRODUCTION_AI_ENABLED: 'true',
      DATABASE_URL: 'postgresql://runtime:password@database.example.test:5432/okyo',
      QUOTA_SCOPE_HMAC_KEY: 'test-only-scope-key-with-at-least-32-characters',
      OPENROUTER_API_KEY: 'sk-or-v1-not-a-real-test-key',
      CLERK_SECRET_KEY: 'sk_live_not_a_real_test_key',
      CLERK_AUTHORIZED_PARTIES: 'https://okyo.example.test',
      ...overrides,
    },
  });
}

test('API release preflight validates local prerequisites without contacting providers', () => {
  const result = runPreflight();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /without contacting any provider/);
});

test('API release preflight rejects accidental production AI activation without a quota secret', () => {
  const result = runPreflight({ QUOTA_SCOPE_HMAC_KEY: 'too-short' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /QUOTA_SCOPE_HMAC_KEY/);
  assert.doesNotMatch(result.stderr, /too-short/);
});
