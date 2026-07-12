import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';

import type { SupabaseAuthConfig } from './config.js';

export type VerifiedAuthIdentity = {
  userId: string;
};

export type AccessTokenVerifier = {
  verify(token: string): Promise<VerifiedAuthIdentity>;
};

export class AccessTokenVerificationError extends Error {
  readonly category: 'invalid_token' | 'verifier_unavailable';

  constructor(category: AccessTokenVerificationError['category']) {
    super(category === 'invalid_token' ? 'Access token is invalid.' : 'Token verifier is unavailable.');
    this.name = 'AccessTokenVerificationError';
    this.category = category;
  }
}

export function createSupabaseJwtVerifier(
  config: SupabaseAuthConfig,
  options: { keySet?: JWTVerifyGetKey } = {},
): AccessTokenVerifier {
  const keySet = options.keySet ?? createRemoteJWKSet(config.jwksUrl);

  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, keySet, {
          algorithms: ['ES256', 'RS256'],
          audience: 'authenticated',
          issuer: config.issuer,
        });

        if (
          typeof payload.exp !== 'number' ||
          payload.role !== 'authenticated' ||
          typeof payload.sub !== 'string' ||
          !isUuid(payload.sub)
        ) {
          throw new AccessTokenVerificationError('invalid_token');
        }

        return { userId: payload.sub };
      } catch (error) {
        if (error instanceof AccessTokenVerificationError) {
          throw error;
        }
        if (isVerifierInfrastructureError(error)) {
          throw new AccessTokenVerificationError('verifier_unavailable');
        }
        throw new AccessTokenVerificationError('invalid_token');
      }
    },
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isVerifierInfrastructureError(error: unknown) {
  if (error instanceof TypeError) {
    return false;
  }
  if (!(error instanceof errors.JOSEError)) {
    return true;
  }

  return !new Set([
    'ERR_JWT_EXPIRED',
    'ERR_JWT_CLAIM_VALIDATION_FAILED',
    'ERR_JWS_INVALID',
    'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
    'ERR_JWKS_NO_MATCHING_KEY',
    'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  ]).has(error.code);
}
