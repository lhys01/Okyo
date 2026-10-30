/**
 * Every entry point into `@clerk/expo` goes through here.
 *
 * Clerk's Expo SDK pulls in NATIVE modules (expo-web-browser,
 * expo-auth-session, expo-secure-store) at import time. A static import would
 * therefore crash the entire app on any dev-client binary built before those
 * modules were added — including for developers who have never configured
 * Clerk and never see a sign-in screen.
 *
 * So the module is required lazily and defensively: if it can't load, auth
 * simply doesn't exist and Okyo runs exactly as it did before.
 */
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const isDevelopmentBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export function isClerkConfigured(
  key: string = CLERK_PUBLISHABLE_KEY,
  developmentBuild: boolean = isDevelopmentBuild,
): boolean {
  // A test-instance key must never enable account UI in a release binary. If
  // release configuration is missing or points to test Clerk, auth stays off;
  // protected server routes independently fail closed.
  return key.startsWith('pk_live_') || (developmentBuild && key.startsWith('pk_test_'));
}

type ClerkModule = typeof import('@clerk/expo');

let cached: ClerkModule | null | undefined;

/** Returns the Clerk SDK, or null when it isn't configured or can't load. */
export function loadClerk(): ClerkModule | null {
  if (cached !== undefined) return cached;

  if (!isClerkConfigured()) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@clerk/expo') as ClerkModule;
  } catch {
    // Native modules missing (dev client not rebuilt) — degrade to no auth
    // rather than taking the whole app down.
    cached = null;
  }

  return cached;
}

/** True only when Clerk is configured AND its native dependencies loaded. */
export function isClerkAvailable(): boolean {
  return loadClerk() !== null;
}

/**
 * Finalises any pending OAuth redirect so the in-app browser dismisses itself
 * and the `startSSOFlow` promise resolves. Expo's AuthSession requires this to
 * run once, early, at JS startup (Clerk's Expo quickstart calls it at module
 * scope). Guarded and lazily required for the same reason as everything else
 * here: `expo-web-browser` is a native module and must not be touched in a
 * build that never configured Clerk.
 */
export function completePendingAuthSession(): void {
  if (!isClerkConfigured()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webBrowser = require('expo-web-browser') as { maybeCompleteAuthSession?: () => void };
    webBrowser.maybeCompleteAuthSession?.();
  } catch {
    // No web browser module in this binary — sign-in is unavailable anyway.
  }
}
