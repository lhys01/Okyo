import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSupabaseDatabaseConfig,
  SupabaseDatabaseConfigurationError,
} from './config.js';

test('database configuration accepts a server-only service credential without logging it', () => {
  const logged: unknown[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...values) => { logged.push(...values); };
  console.warn = (...values) => { logged.push(...values); };
  try {
    const config = getSupabaseDatabaseConfig({
      SUPABASE_URL: 'https://project-ref.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-secret-key-value',
    });
    assert.equal(config.url, 'https://project-ref.supabase.co');
    assert.equal(logged.length, 0);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
});

test('database configuration rejects missing and publishable credentials', () => {
  assert.throws(() => getSupabaseDatabaseConfig({}), SupabaseDatabaseConfigurationError);
  assert.throws(
    () => getSupabaseDatabaseConfig({ SUPABASE_URL: 'https://project-ref.supabase.co' }),
    SupabaseDatabaseConfigurationError,
  );
  assert.throws(
    () => getSupabaseDatabaseConfig({
      SUPABASE_URL: 'https://project-ref.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_not-a-server-secret',
    }),
    SupabaseDatabaseConfigurationError,
  );
});
