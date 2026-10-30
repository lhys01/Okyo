import { isClerkAvailable, loadClerk } from './clerkRuntime';

export interface OkyoAuthSnapshot {
  /** False when Clerk isn't configured/loadable — callers hide auth UI entirely. */
  isAvailable: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  hasActiveSession: boolean;
  /** Clerk user ID only; it is never a credential. */
  userId: string | null;
  /** Display label for the signed-in account. Email only — never a token. */
  accountLabel: string | null;
  /** Short-lived Clerk session token for an authenticated backend action. */
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const SIGNED_OUT: OkyoAuthSnapshot = {
  accountLabel: null,
  isAvailable: false,
  isLoaded: true,
  isSignedIn: false,
  hasActiveSession: false,
  userId: null,
  getToken: async () => null,
  signOut: async () => undefined,
};

/**
 * Single read-only view of auth state for regular screens, so no screen has
 * to know whether Clerk is configured, nor import Clerk directly.
 *
 * Clerk's availability is fixed at build/startup time (env var + one-shot
 * module load), so it cannot change between renders — which is what makes
 * the early return safe with respect to hook ordering.
 */
export function useOkyoAuth(): OkyoAuthSnapshot {
  if (!isClerkAvailable()) {
    return SIGNED_OUT;
  }

  const clerk = loadClerk()!;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { getToken, isLoaded, isSignedIn, sessionId, signOut } = clerk.useAuth();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user } = clerk.useUser();

  return {
    accountLabel: user?.primaryEmailAddress?.emailAddress ?? null,
    isAvailable: true,
    isLoaded,
    isSignedIn: isSignedIn === true,
    hasActiveSession: Boolean(sessionId),
    userId: user?.id ?? null,
    getToken: async () => getToken(),
    signOut: async () => {
      await signOut();
    },
  };
}
