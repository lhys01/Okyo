import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { useEffect } from 'react';

import { uiLog } from '../utils/uiDebug';
import { clerkTokenCache } from './clerkTokenCache';
import {
  CLERK_PUBLISHABLE_KEY,
  completePendingAuthSession,
  isClerkAvailable,
  isClerkConfigured,
  loadClerk,
} from './clerkRuntime';

export { CLERK_PUBLISHABLE_KEY, isClerkAvailable, isClerkConfigured } from './clerkRuntime';

// Run once, at module load, before any sign-in can start: closes the OAuth
// browser tab and resolves the redirect when the app comes back from Apple or
// Google. No-op unless Clerk is configured.
completePendingAuthSession();

/**
 * Wraps the app in Clerk when — and only when — it is both configured and
 * loadable. Otherwise the app renders exactly as it did before auth existed.
 *
 * The publishable key is safe to ship in the bundle (that is what
 * "publishable" means). The SECRET key must never appear in this app; if one
 * ever lands under apps/mobile, treat it as leaked and rotate it.
 */
export function OkyoAuthProvider({ children }: { children: ReactNode }) {
  const clerk = loadClerk();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') completePendingAuthSession();
    });
    return () => subscription.remove();
  }, []);

  if (!clerk) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      uiLog('OkyoAuthProvider', isClerkConfigured() ? 'clerk_native_modules_missing' : 'clerk_not_configured', {
        hint: isClerkConfigured()
          ? 'Clerk is configured but its native modules are not in this build — rebuild the dev client (npx expo run:ios).'
          : 'Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/mobile/.env.local — sign-in stays disabled until then.',
      });
    }
    return <>{children}</>;
  }

  const { ClerkLoaded, ClerkProvider } = clerk;

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={clerkTokenCache}>
      {/* ClerkLoaded holds render until the keychain session is restored, so
          the sign-in screen never flashes at an already-signed-in user. */}
      <ClerkLoaded>{children}</ClerkLoaded>
    </ClerkProvider>
  );
}
