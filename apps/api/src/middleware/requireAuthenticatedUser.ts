import { getRequestContext } from '../observability/requestContext.js';
import { verifyToken } from '@clerk/backend';
import type { NextFunction, Request, Response } from 'express';

import { areAuthorizedPartiesValid, getAccountDeletionConfig, isClerkSecretValid, isProductionDeployment, readBearerToken } from '../services/accountDeletion.js';

type TokenClaims = { sub?: unknown };
type TokenVerifier = (token: string, options: { secretKey: string; authorizedParties?: string[] }) => Promise<TokenClaims>;

export function createRequireAuthenticatedUser(verifySessionToken: TokenVerifier = verifyToken) {
  return async function requireAuthenticatedUser(request: Request, response: Response, next: NextFunction): Promise<void> {
    const token = readBearerToken(request.get('authorization'));
    if (!token) {
      response.status(401).json({ ok: false, error: { code: 'authentication_required', message: 'Please sign in to access this data.' } });
      return;
    }

    const config = getAccountDeletionConfig();
    const clerkSecretKey = config.clerkSecretKey;
    if (!isClerkSecretValid(clerkSecretKey) || (isProductionDeployment() && !areAuthorizedPartiesValid(config.authorizedParties))) {
      response.status(503).json({ ok: false, error: { code: 'authentication_unavailable', message: 'Please try again later.' } });
      return;
    }

    try {
      const claims = await verifySessionToken(token, {
        secretKey: clerkSecretKey!,
        ...(config.authorizedParties.length > 0 ? { authorizedParties: config.authorizedParties } : {}),
      });
      const userId = typeof claims.sub === 'string' ? claims.sub : '';
      if (!/^user_[A-Za-z0-9]+$/.test(userId)) {
        response.status(401).json({ ok: false, error: { code: 'authentication_required', message: 'Please sign in again.' } });
        return;
      }
      response.locals.authenticatedUserId = userId;
      const context = getRequestContext();
      if (context) context.ownerKey = `user:${userId}`;
      next();
    } catch {
      response.status(401).json({ ok: false, error: { code: 'authentication_required', message: 'Please sign in again.' } });
    }
  };
}

/**
 * Optional identity for public AI requests. Guests remain supported; a valid
 * Clerk session improves quota attribution from an IP scope to a user scope.
 * Invalid or unavailable optional credentials stay guests and never select a
 * caller-provided identity.
 */
export function createOptionalAuthenticatedUser(verifySessionToken: TokenVerifier = verifyToken) {
  return async function optionalAuthenticatedUser(request: Request, response: Response, next: NextFunction): Promise<void> {
    const token = readBearerToken(request.get('authorization'));
    if (!token) { next(); return; }

    const config = getAccountDeletionConfig();
    const clerkSecretKey = config.clerkSecretKey;
    if (!isClerkSecretValid(clerkSecretKey) || (isProductionDeployment() && !areAuthorizedPartiesValid(config.authorizedParties))) {
      next();
      return;
    }

    try {
      const claims = await verifySessionToken(token, {
        secretKey: clerkSecretKey!,
        ...(config.authorizedParties.length > 0 ? { authorizedParties: config.authorizedParties } : {}),
      });
      const userId = typeof claims.sub === 'string' ? claims.sub : '';
      if (/^user_[A-Za-z0-9]+$/.test(userId)) {
        response.locals.authenticatedUserId = userId;
        const context = getRequestContext();
        if (context) context.ownerKey = `user:${userId}`;
      }
    } catch {
      // Expired/invalid optional credentials do not block a guest scan.
    }
    next();
  };
}

export const requireAuthenticatedUser = createRequireAuthenticatedUser();
export const optionalAuthenticatedUser = createOptionalAuthenticatedUser();

/** Real production AI spend and private runtime state require a verified user. */
export function requireAiUser(request: Request, response: Response, next: NextFunction): Promise<void> {
  return isProductionDeployment()
    ? requireAuthenticatedUser(request, response, next)
    : optionalAuthenticatedUser(request, response, next);
}
