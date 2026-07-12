import assert from 'node:assert/strict';
import test from 'node:test';

import { getSupabaseAuthConfig, SupabaseAuthConfigurationError } from './config.js';

test('derives the trusted issuer and public JWKS URL from SUPABASE_URL', () => {
  const config = getSupabaseAuthConfig({
    SUPABASE_URL: 'https://project-ref.supabase.co',
  });

  assert.equal(config.issuer, 'https://project-ref.supabase.co/auth/v1');
  assert.equal(config.jwksUrl.toString(), 'https://project-ref.supabase.co/auth/v1/.well-known/jwks.json');
});

test('rejects missing or invalid Supabase project URLs without exposing values', () => {
  assert.throws(() => getSupabaseAuthConfig({}), SupabaseAuthConfigurationError);
  assert.throws(
    () => getSupabaseAuthConfig({ SUPABASE_URL: 'http://private.invalid/path' }),
    SupabaseAuthConfigurationError,
  );
});
