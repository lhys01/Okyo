import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose';

import type { SupabaseAuthConfig } from './config.js';
import { AccessTokenVerificationError, createSupabaseJwtVerifier } from './verifier.js';

const issuer = 'https://project-ref.supabase.co/auth/v1';
const userId = '162b7af3-e489-4cc9-8f11-09913a4b142a';
const config: SupabaseAuthConfig = {
  issuer,
  jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
};
let privateKey: CryptoKey;
let verifier: ReturnType<typeof createSupabaseJwtVerifier>;

before(async () => {
  const keys = await generateKeyPair('ES256');
  privateKey = keys.privateKey;
  const publicJwk: JWK = await exportJWK(keys.publicKey);
  publicJwk.kid = 'okyo-test-key';
  verifier = createSupabaseJwtVerifier(config, {
    keySet: createLocalJWKSet({ keys: [publicJwk] }),
  });
});

test('cryptographically verifies a valid Supabase access token', async () => {
  const token = await signToken({ subject: userId });
  assert.deepEqual(await verifier.verify(token), { userId });
});

test('rejects a malformed or invalid JWT', async () => {
  await assert.rejects(
    verifier.verify('not-a-jwt'),
    isInvalidTokenError,
  );
});

test('rejects an expired JWT', async () => {
  const token = await signToken({ subject: userId, expiration: '1 second ago' });
  await assert.rejects(verifier.verify(token), isInvalidTokenError);
});

test('rejects a verified token without a usable subject', async () => {
  const token = await signToken({});
  await assert.rejects(verifier.verify(token), isInvalidTokenError);
});

async function signToken(options: { subject?: string; expiration?: string } = {}) {
  let token = new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'okyo-test-key' })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(options.expiration ?? '5 minutes');
  if (options.subject) {
    token = token.setSubject(options.subject);
  }
  return token.sign(privateKey);
}

function isInvalidTokenError(error: unknown) {
  return error instanceof AccessTokenVerificationError && error.category === 'invalid_token';
}
