export type ClerkSsoFlow = 'sign_in' | 'sign_up' | 'unknown';

type ClerkSessionResource = { createdSessionId?: string | null; status?: string | null };

export type ClerkSsoResult = {
  createdSessionId?: string | null;
  authSessionResult?: { type?: string } | null;
  setActive?: (params: { session: string }) => Promise<unknown>;
  signIn?: ClerkSessionResource;
  signUp?: ClerkSessionResource;
};

export type ClerkSsoCompletion =
  | { kind: 'activated'; flow: ClerkSsoFlow; sessionId: string }
  | { kind: 'cancelled' }
  | { kind: 'incomplete' };

export type ClerkAppleResult = {
  createdSessionId?: string | null;
  setActive?: (params: { session: string }) => Promise<unknown>;
  signIn?: ClerkSessionResource;
  signUp?: ClerkSessionResource;
};

export function getClerkSsoFlow(result: ClerkSsoResult): ClerkSsoFlow {
  const sessionId = getCreatedSessionId(result);
  if (result.signUp?.createdSessionId === sessionId) return 'sign_up';
  if (result.signIn?.createdSessionId === sessionId) return 'sign_in';
  return 'unknown';
}

/**
 * Clerk's native hook currently returns the session at the top level, but the
 * returned sign-in/sign-up resource is the authoritative fallback when a
 * supported SDK version nests it there. Never activate an arbitrary value:
 * require the same non-empty ID to be present on a Clerk result resource.
 */
export function getCreatedSessionId(result: ClerkSsoResult | ClerkAppleResult): string {
  const topLevel = result.createdSessionId?.trim() ?? '';
  if (topLevel) return topLevel;

  const signIn = result.signIn?.createdSessionId?.trim() ?? '';
  if (signIn) return signIn;

  return result.signUp?.createdSessionId?.trim() ?? '';
}

/**
 * Completes Clerk's native Expo SSO result without exposing the session ID.
 * Clerk returns the same shape for an existing-user sign-in and a new-user
 * sign-up; the originating resource is retained only for safe diagnostics.
 */
export async function activateClerkSsoSession(result: ClerkSsoResult): Promise<ClerkSsoCompletion> {
  const sessionId = getCreatedSessionId(result);
  const callbackType = result.authSessionResult?.type;

  if (!sessionId) {
    return callbackType === 'cancel' || callbackType === 'dismiss'
      ? { kind: 'cancelled' }
      : { kind: 'incomplete' };
  }

  if (!result.setActive) return { kind: 'incomplete' };

  await result.setActive({ session: sessionId });
  return { kind: 'activated', flow: getClerkSsoFlow(result), sessionId };
}

/** Activates only a concrete session returned by Clerk's native Apple flow. */
export async function activateClerkAppleSession(result: ClerkAppleResult): Promise<ClerkSsoFlow | null> {
  const sessionId = getCreatedSessionId(result);
  if (!sessionId || !result.setActive) return null;

  await result.setActive({ session: sessionId });
  return getClerkSsoFlow(result);
}

export function isClerkSessionReady({ isLoaded, isSignedIn }: { isLoaded: boolean; isSignedIn: boolean }): boolean {
  return isLoaded && isSignedIn;
}
