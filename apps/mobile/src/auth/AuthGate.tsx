import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/okyoTheme';
import { authPromptPersistence } from './authPromptPersistence';
import { decideAuthGate } from './authGateDecision';
import { isClerkAvailable, loadClerk } from './clerkRuntime';
import { analyticsEvents, track } from '../analytics/track';

/**
 * Loaded lazily so a build without Clerk configured never evaluates the
 * sign-in screen's native dependencies at startup.
 */
const SignInScreen = lazy(async () => ({ default: (await import('./SignInScreen')).SignInScreen }));

/**
 * Production requires a verified session before onboarding or AI actions.
 * Development retains the optional prompt after onboarding for local demos.
 * The gate sits outside the onboarding reducer and preserves its draft.
 */
export function AuthGate({ children, onboardingCompleted, requireSession = false, onBack }: { children: ReactNode; onboardingCompleted: boolean; requireSession?: boolean; onBack?: () => void }) {
  // `isClerkAvailable()` is derived from a build-time env var and a one-shot
  // module load, so it never changes across renders — branching on it here
  // keeps hook order stable.
  if (!isClerkAvailable()) {
    if (requireSession) return <View style={styles.loading}><Text>Sign-in is unavailable. Please reopen Okyo and try again.</Text></View>;
    return <>{children}</>;
  }

  return <ConfiguredAuthGate onboardingCompleted={onboardingCompleted} requireSession={requireSession} onBack={onBack}>{children}</ConfiguredAuthGate>;
}

function ConfiguredAuthGate({ children, onboardingCompleted, requireSession, onBack }: { children: ReactNode; onboardingCompleted: boolean; requireSession: boolean; onBack?: () => void }) {
  const useAuth = loadClerk()!.useAuth;
  const { isLoaded, isSignedIn } = useAuth();
  const previousSignedIn = useRef<boolean | null>(null);
  const [promptSeen, setPromptSeen] = useState(false);
  const [promptSeenLoaded, setPromptSeenLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void authPromptPersistence.readSeen().then((seen) => {
      if (isMounted) {
        setPromptSeen(seen);
        setPromptSeenLoaded(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setPromptSeen(true);
    void authPromptPersistence.markSeen();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const signedIn = isSignedIn === true;
    const previous = previousSignedIn.current;
    if (previous === false && signedIn) track(analyticsEvents.SIGN_IN_SUCCEEDED, { result: 'success' });
    if (previous === true && !signedIn) track(analyticsEvents.SIGN_OUT, { result: 'success' });
    previousSignedIn.current = signedIn;
  }, [isLoaded, isSignedIn]);

  const skipSignIn = useCallback(() => {
    track(analyticsEvents.SIGN_IN_SKIPPED, { result: 'skipped' });
    dismiss();
  }, [dismiss]);

  const decision = decideAuthGate({
    requireSession,
    authLoaded: isLoaded,
    isSignedIn: isSignedIn === true,
    onboardingCompleted,
    promptSeen,
    promptSeenLoaded,
  });

  if (decision === 'wait') {
    return <LoadingView />;
  }

  if (decision === 'showSignIn') {
    return (
      <Suspense fallback={<LoadingView />}>
        <SignInScreen onDone={dismiss} onSkip={skipSignIn} onBack={onBack} allowSkip={!requireSession}
          {...(requireSession ? { subtitle: 'Sign in to create your recipe and keep your cooking activity private.' } : {})} />
      </Suspense>
    );
  }

  return <>{children}</>;
}

function LoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.coral} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
});
