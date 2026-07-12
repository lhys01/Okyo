import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';

import { getSupabaseAuthConfig } from '../auth/config.js';
import {
  AccessTokenVerificationError,
  createSupabaseJwtVerifier,
  type AccessTokenVerifier,
} from '../auth/verifier.js';
import type { ApiFailure } from '../types.js';

type AuthLogger = {
  warn(event: string, context: { category: string; route: string; status: number }): void;
};

let defaultVerifier: AccessTokenVerifier | null = null;

export function createSupabaseAuthMiddleware(options: {
  verifier: AccessTokenVerifier;
  logger?: AuthLogger;
}): RequestHandler {
  const logger = options.logger ?? console;

  return async function supabaseAuthMiddleware(request, response, next) {
    const tokenResult = extractBearerToken(request);
    if (!tokenResult.ok) {
      reject(response, logger, request, 401, tokenResult.category, 'authentication_required');
      return;
    }

    try {
      const identity = await options.verifier.verify(tokenResult.token);
      request.auth = Object.freeze({ userId: identity.userId });
      next();
    } catch (error) {
      const infrastructureFailure = error instanceof AccessTokenVerificationError &&
        error.category === 'verifier_unavailable';
      if (infrastructureFailure) {
        reject(response, logger, request, 503, 'verifier_unavailable', 'auth_verifier_unavailable');
        return;
      }
      reject(response, logger, request, 401, 'invalid_token', 'invalid_auth_token');
    }
  };
}

export function mountV1Authentication(
  app: Pick<Express, 'use'>,
  verifier?: AccessTokenVerifier,
  logger: AuthLogger = console,
) {
  if (verifier) {
    app.use('/v1', createSupabaseAuthMiddleware({ verifier, logger }));
    return;
  }

  app.use('/v1', (request: Request, response: Response, next: NextFunction) => {
    try {
      const middleware = createSupabaseAuthMiddleware({ verifier: getDefaultVerifier(), logger });
      void middleware(request, response, next);
    } catch {
      reject(response, logger, request, 503, 'verifier_configuration', 'auth_verifier_unavailable');
    }
  });
}

function getDefaultVerifier() {
  defaultVerifier ??= createSupabaseJwtVerifier(getSupabaseAuthConfig());
  return defaultVerifier;
}

function extractBearerToken(request: Request):
  | { ok: true; token: string }
  | { ok: false; category: 'missing_authorization' | 'malformed_authorization' } {
  const authorization = request.get('authorization');
  if (!authorization) {
    return { ok: false, category: 'missing_authorization' };
  }

  const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
  if (!match) {
    return { ok: false, category: 'malformed_authorization' };
  }
  return { ok: true, token: match[1] };
}

function reject(
  response: Response,
  logger: AuthLogger,
  request: Request,
  status: 401 | 503,
  category: string,
  code: string,
) {
  logger.warn('auth_request_rejected', {
    category,
    route: request.path,
    status,
  });

  const payload: ApiFailure = {
    ok: false,
    error: {
      code,
      message: status === 401
        ? 'A valid authenticated session is required.'
        : 'Authentication is temporarily unavailable.',
    },
  };
  response.status(status).json(payload);
}
