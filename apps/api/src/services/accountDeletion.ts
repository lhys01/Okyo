import { revokeAppleAuthorization } from './appleRevocation.js';
import { verifyToken } from '@clerk/backend';
import { databaseConfigured } from '../persistence/database.js';

const CLERK_API_URL = 'https://api.clerk.com/v1';
const REVENUECAT_API_URL = 'https://api.revenuecat.com/v2';

type SessionTokenVerifier = typeof verifyToken;

type AccountDeletionConfig = {
  clerkSecretKey: string | null;
  revenueCatProjectId: string | null;
  revenueCatSecretKey: string | null;
  authorizedParties: string[];
};

type FetchLike = typeof fetch;

export class AccountDeletionError extends Error {
  constructor(
    readonly code: 'account_deletion_unavailable' | 'authentication_required' | 'account_deletion_failed',
    readonly status: 401 | 502 | 503,
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getAccountDeletionConfig(): AccountDeletionConfig {
  return {
    clerkSecretKey: readOptionalEnv('CLERK_SECRET_KEY'),
    revenueCatProjectId: readOptionalEnv('REVENUECAT_PROJECT_ID'),
    revenueCatSecretKey: readOptionalEnv('REVENUECAT_V2_SECRET_API_KEY'),
    authorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export function areAuthorizedPartiesValid(values: string[]): boolean {
  return values.length > 0 && values.every((value) => {
    if (!value || value !== value.trim() || value.includes('*') || value === 'null' || value.length > 512) return false;
    if (/^https:\/\//i.test(value)) {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' && Boolean(parsed.hostname) &&
          parsed.username === '' && parsed.password === '' && parsed.pathname === '/' &&
          parsed.search === '' && parsed.hash === '';
      } catch {
        return false;
      }
    }
    if (/^http:\/\//i.test(value)) return false;
    // Native Clerk `azp` values may use an app URL scheme (for example, a
    // registered `okyo://` party) rather than a web origin.
    return /^okyo:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i.test(value);
  });
}

export function getProductionAuthReadiness() {
  const config = getAccountDeletionConfig();
  return {
    clerkSecretConfigured: Boolean(config.clerkSecretKey),
    clerkSecretValid: isClerkSecretValid(config.clerkSecretKey),
    authorizedPartiesConfigured: config.authorizedParties.length > 0,
    authorizedPartiesValid: areAuthorizedPartiesValid(config.authorizedParties),
  };
}

/**
 * Railway runs both Development and Production services with NODE_ENV set to
 * production. NODE_ENV is therefore a runtime-optimization setting, not a
 * reliable indicator of which Clerk instance the service is connected to.
 *
 * Outside Railway, preserve the existing safe fallback: NODE_ENV=production
 * means a live Clerk secret is required.
 */
export function isProductionDeployment(environment: NodeJS.ProcessEnv = process.env): boolean {
  const railwayEnvironment = (environment.RAILWAY_ENVIRONMENT ?? environment.RAILWAY_ENVIRONMENT_NAME ?? '')
    .trim()
    .toLowerCase();
  if (railwayEnvironment) return railwayEnvironment === 'production';
  return environment.NODE_ENV === 'production';
}

export function isClerkSecretValid(secret: string | null): boolean {
  if (!secret) return false;
  const expectedPrefix = isProductionDeployment() ? 'sk_live_' : 'sk_test_';
  return secret.startsWith(expectedPrefix) && secret.length > expectedPrefix.length;
}

/** Extracts only a conventional bearer token; never accepts a raw JWT header. */
export function readBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+([A-Za-z0-9._~-]+)$/i);
  return match?.[1] ?? null;
}

/**
 * Deletes the authenticated Clerk user and the matching RevenueCat customer.
 *
 * The Clerk session is verified on the server before `sub` is used. The mobile
 * app never supplies a user ID, Clerk secret, or RevenueCat secret. RevenueCat
 * deletion is requested first because its v2 API queues deletion; if it cannot
 * accept the request, the Clerk account is retained and the user can retry.
 */
export function createAccountDeletionService(deps: {
  config?: AccountDeletionConfig;
  fetchImpl?: FetchLike;
  verifySessionToken?: SessionTokenVerifier;
  revokeApple?: typeof revokeAppleAuthorization;
  clearServerData?: (userId: string) => Promise<void>;
} = {}) {
  const config = deps.config ?? getAccountDeletionConfig();
  const clerkSecretKey = config.clerkSecretKey;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const verifySessionToken = deps.verifySessionToken ?? verifyToken;

  return async function deleteAuthenticatedAccount(authorization: string | undefined): Promise<{
    revenueCatCustomerDeletionRequested: boolean;
  }> {
    if (!isClerkSecretValid(clerkSecretKey) || (isProductionDeployment() && !areAuthorizedPartiesValid(config.authorizedParties))) {
      throw new AccountDeletionError(
        'account_deletion_unavailable',
        503,
        'Account deletion is not available right now. Please try again later.',
      );
    }
    const hasRevenueCatCustomer = Boolean(config.revenueCatProjectId && config.revenueCatSecretKey);
    if (Boolean(config.revenueCatProjectId) !== Boolean(config.revenueCatSecretKey) ||
      (isProductionDeployment() && !hasRevenueCatCustomer)) {
      throw new AccountDeletionError(
        'account_deletion_unavailable',
        503,
        'Account deletion is not available right now. Please try again later.',
      );
    }

    const token = readBearerToken(authorization);
    if (!token) {
      throw new AccountDeletionError('authentication_required', 401, 'Please sign in again before deleting your account.');
    }

    let userId: string;
    try {
      const claims = await verifySessionToken(token, {
        secretKey: clerkSecretKey!,
        ...(config.authorizedParties.length > 0 ? { authorizedParties: config.authorizedParties } : {}),
      });
      userId = typeof claims.sub === 'string' ? claims.sub : '';
    } catch {
      throw new AccountDeletionError('authentication_required', 401, 'Please sign in again before deleting your account.');
    }

    if (!/^user_[A-Za-z0-9]+$/.test(userId)) {
      throw new AccountDeletionError('authentication_required', 401, 'Please sign in again before deleting your account.');
    }

    const encodedUserId = encodeURIComponent(userId);
    const clerkHeaders = { Authorization: `Bearer ${clerkSecretKey!}` };
    const userResponse = await fetchImpl(`${CLERK_API_URL}/users/${encodedUserId}`, {
      headers: clerkHeaders, signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!userResponse || (!userResponse.ok && userResponse.status !== 404)) {
      throw new AccountDeletionError('account_deletion_failed', 502, 'We couldn’t verify account deletion. Please try again.');
    }
    const user = userResponse.status === 404 ? null : await userResponse.json().catch(() => null);
    if (userResponse.ok && (!user || !Array.isArray(user.external_accounts))) {
      throw new AccountDeletionError('account_deletion_failed', 502, 'We couldn’t verify account deletion. Please try again.');
    }
    const usesApple = user?.external_accounts.some((account: { provider?: string }) => account.provider === 'oauth_apple');
    if (hasRevenueCatCustomer) {
      const revenueCatResponse = await fetchImpl(
        `${REVENUECAT_API_URL}/projects/${encodeURIComponent(config.revenueCatProjectId!)}/customers/${encodedUserId}`,
        {
          headers: { Authorization: `Bearer ${config.revenueCatSecretKey}` },
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
        },
      ).catch(() => null);

      // A 404 means this authenticated user never created a RevenueCat
      // customer. Any other failed request is retriable and must leave the
      // Clerk account intact so the deletion is never falsely confirmed.
      if (!revenueCatResponse || (!revenueCatResponse.ok && revenueCatResponse.status !== 404)) {
        throw new AccountDeletionError(
          'account_deletion_failed',
          502,
          'We couldn’t start deleting your account. Please try again.',
        );
      }
    }

    if (usesApple) {
      try { await (deps.revokeApple ?? revokeAppleAuthorization)(userId, clerkSecretKey!, fetchImpl); }
      catch { throw new AccountDeletionError('account_deletion_failed', 502, 'We couldn’t finish deleting your account. Please try again.'); }
    }
    // Clear server state before deleting the identity needed to authenticate a retry.
    try { await deps.clearServerData?.(userId); }
    catch { throw new AccountDeletionError('account_deletion_failed', 502, 'We couldn’t finish deleting your account. Please try again.'); }

    const clerkResponse = await fetchImpl(`${CLERK_API_URL}/users/${encodedUserId}`, {
      headers: { Authorization: `Bearer ${clerkSecretKey!}` },
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (!clerkResponse || (!clerkResponse.ok && clerkResponse.status !== 404)) {
      throw new AccountDeletionError(
        'account_deletion_failed',
        502,
        'We couldn’t finish deleting your account. Please try again.',
      );
    }

    return { revenueCatCustomerDeletionRequested: hasRevenueCatCustomer };
  };
}

export async function deleteAuthenticatedAccount(authorization: string | undefined) {
  return createAccountDeletionService({ clearServerData: async (userId) => {
    // Existing main-branch in-memory recipe state is not user-owned. It must
    // never be cleared for another account. Durable rows use a verified owner
    // scope and are cleared below when persistence is configured.
    const cleanups: Array<() => void | Promise<void>> = [];
    // Development can use the same durable runtime store as Production.
    // When configured, its user-owned rows must be removed too. Production
    // still fails closed if its required database is unavailable.
    if (process.env.NODE_ENV === 'production' || databaseConfigured()) {
      cleanups.push(async () => {
        const { deleteRuntimeOwner } = await import('../persistence/runtimeStore.js');
        await deleteRuntimeOwner(userId);
      });
    }

    const outcomes = await Promise.all(cleanups.map(async (cleanup) => {
      try { await cleanup(); return true; } catch { return false; }
    }));
    if (outcomes.some((succeeded) => !succeeded)) {
      throw new Error('User data cleanup did not fully complete.');
    }
  } })(authorization);
}
