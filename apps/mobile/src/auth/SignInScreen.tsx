import { useLaunchDestinationReady } from '../startup/LaunchScreen';
import { useAuth, useClerk, useSignIn, useSignUp, useSSO } from '@clerk/expo';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavArrowLeft } from 'iconoir-react-native';
import Svg, { Path } from 'react-native-svg';
import { useSignInWithApple } from '@clerk/expo/apple';
import * as AuthSession from 'expo-auth-session';

import { analyticsEvents, track } from '../analytics/track';
import { onboardingQuestionExperiment } from '../onboarding-v3/state/onboardingQuestionExperiment';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';
import { uiLog } from '../utils/uiDebug';
import { AUTH_PROVIDER_OPTIONS, isAllowedAuthStrategy, type AllowedAuthStrategy } from './authStrategies';
import { classifyClerkPublishableKey } from './clerkDiagnostics';
import { CLERK_PUBLISHABLE_KEY } from './clerkRuntime';
import { isClerkSessionReady } from './clerkSsoCompletion';
import { appleSignInFlight } from './appleSignInFlight';
import { googleSsoFlight } from './googleSsoFlight';
import { LegalDocumentModal } from '../legal/LegalDocumentModal';

const KIKO_ART = require('../../assets/kiko-static/approved/kiko-neutral-transparent-sticker.png');

/**
 * Warms the in-app browser so the OAuth sheet opens instantly instead of
 * flashing a blank view. Recommended by Clerk for Expo.
 *
 * `expo-web-browser` is required lazily, never imported at module scope:
 * it is a NATIVE module, so a static import would make the whole app fail to
 * start on any dev-client binary built before it was added — including for
 * users who never reach this screen.
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    let browser: { warmUpAsync: () => Promise<unknown>; coolDownAsync: () => Promise<unknown> } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      browser = require('expo-web-browser');
      void browser?.warmUpAsync();
    } catch {
      // Warming is a pure optimisation — never let it break sign-in.
    }
    return () => {
      try {
        void browser?.coolDownAsync();
      } catch {
        // ignore
      }
    };
  }, []);
}

/** The Apple logo, drawn so the primary button reads as a real Sign in with Apple control. */
function AppleMark({ color }: { color: string }) {
  return (
    <Svg width={17} height={20} viewBox="0 0 17 20" accessibilityRole="image">
      <Path
        fill={color}
        d="M14.06 10.62c.02 2.55 2.24 3.4 2.27 3.41-.02.06-.36 1.23-1.18 2.44-.71 1.05-1.45 2.09-2.62 2.11-1.15.02-1.52-.68-2.83-.68-1.32 0-1.72.66-2.81.7-1.13.05-1.99-1.13-2.71-2.18-1.47-2.13-2.6-6.02-1.08-8.65.75-1.3 2.1-2.13 3.56-2.15 1.11-.02 2.16.75 2.83.75.68 0 1.95-.93 3.29-.79.56.02 2.13.23 3.14 1.7-.08.05-1.88 1.1-1.86 3.27M11.9 3.5c.6-.72 1-1.73.9-2.73-.86.03-1.9.57-2.52 1.29-.55.63-1.04 1.65-.91 2.63.96.07 1.93-.49 2.53-1.19"
      />
    </Svg>
  );
}

export interface SignInScreenProps {
  /** Called after a session is genuinely created. */
  onDone: () => void;
  /** Skippable by design — scan-first activation matters more than an account. */
  onSkip: () => void;
  onBack?: () => void;
  /** Branch commitments require a real sign-in when Clerk is configured. */
  allowSkip?: boolean;
  buttonAction?: 'continue' | 'sign-in';
  title?: string;
  subtitle?: string;
}

function EmailPasswordPanel({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [stage, setStage] = useState<'credentials' | 'verify-sign-up' | 'verify-device' | 'verify-password-reset' | 'new-password'>('credentials');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishSignIn = useCallback(async () => {
    const result = await signIn.finalize();
    if (result.error) {
      setError('We couldn’t finish signing in. Please try again.');
      return;
    }
    onDone();
  }, [onDone, signIn]);

  const submitCredentials = useCallback(async () => {
    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    if (mode === 'sign-up' && password.length < 15) {
      setError('Choose a password with at least 15 characters.');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      if (mode === 'sign-up') {
        const result = await signUp.password({ emailAddress: normalizedEmail, password });
        if (result.error) {
          setError('We couldn’t create the account. Check your details and try again.');
          return;
        }
        const sent = await signUp.verifications.sendEmailCode();
        if (sent.error) {
          setError('We couldn’t send a verification code. Check your email address and try again.');
          return;
        }
        setStage('verify-sign-up');
        return;
      }

      const result = await signIn.password({ emailAddress: normalizedEmail, password });
      if (result.error) {
        setError('That email and password combination didn’t work. Try again.');
        return;
      }
      if (signIn.status === 'complete') {
        await finishSignIn();
        return;
      }
      if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
        const emailFactor = signIn.supportedSecondFactors.find((factor) => factor.strategy === 'email_code');
        if (emailFactor) {
          const sent = await signIn.mfa.sendEmailCode();
          if (sent.error) {
            setError('We couldn’t send a sign-in code. Please try again.');
            return;
          }
          setStage('verify-device');
          return;
        }
      }
      setError('We couldn’t finish signing in. Please try again.');
    } catch {
      setError(mode === 'sign-up' ? 'We couldn’t create the account. Please try again.' : 'We couldn’t sign you in. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }, [emailAddress, finishSignIn, mode, password, signIn, signUp]);

  const startPasswordReset = useCallback(async () => {
    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email address first so we can send a reset code.');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const started = await signIn.create({ identifier: normalizedEmail });
      if (started.error) {
        setError('We couldn’t start password recovery. Check the email address and try again.');
        return;
      }
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        setError('We couldn’t send a reset code. Check the email address and try again.');
        return;
      }
      setStage('verify-password-reset');
    } catch {
      setError('We couldn’t start password recovery. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }, [emailAddress, signIn]);

  const submitNewPassword = useCallback(async () => {
    if (password.length < 15) {
      setError('Choose a password with at least 15 characters.');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true });
      if (result.error) {
        setError('We couldn’t update your password. Check it and try again.');
        return;
      }
      if (signIn.status === 'complete') {
        await finishSignIn();
        return;
      }
      setError('Your password was updated, but we couldn’t finish signing in. Please sign in again.');
      setStage('credentials');
      setPassword('');
    } catch {
      setError('We couldn’t update your password. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }, [finishSignIn, password, signIn]);

  const verifyCode = useCallback(async () => {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError('Enter the code from your email.');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      if (stage === 'verify-sign-up') {
        const result = await signUp.verifications.verifyEmailCode({ code: normalizedCode });
        if (result.error) {
          setError('That code didn’t work. Check it and try again.');
          return;
        }
        if (signUp.status === 'complete') {
          const finalized = await signUp.finalize();
          if (finalized.error) {
            setError('Your email is verified, but we couldn’t finish creating the account. Please try again.');
            return;
          }
          onDone();
          return;
        }
      } else if (stage === 'verify-device') {
        const result = await signIn.mfa.verifyEmailCode({ code: normalizedCode });
        if (result.error) {
          setError('That code didn’t work. Check it and try again.');
          return;
        }
        if (signIn.status === 'complete') {
          await finishSignIn();
          return;
        }
      } else if (stage === 'verify-password-reset') {
        const result = await signIn.resetPasswordEmailCode.verifyCode({ code: normalizedCode });
        if (result.error) {
          setError('That code didn’t work. Check it and try again.');
          return;
        }
        if (signIn.status === 'needs_new_password') {
          setCode('');
          setPassword('');
          setStage('new-password');
          return;
        }
      }
      setError('We need another step to finish. Please try again.');
    } catch {
      setError('We couldn’t verify that code. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }, [code, finishSignIn, onDone, signIn, signUp, stage]);

  const resendCode = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const result = stage === 'verify-sign-up'
        ? await signUp.verifications.sendEmailCode()
        : stage === 'verify-device'
          ? await signIn.mfa.sendEmailCode()
          : await signIn.resetPasswordEmailCode.sendCode();
      if (result.error) setError('We couldn’t send a new code. Please try again in a moment.');
      else setError('A new code is on its way.');
    } catch {
      setError('We couldn’t send a new code. Please try again in a moment.');
    } finally {
      setIsBusy(false);
    }
  }, [signIn, signUp, stage]);

  const isVerifying = stage !== 'credentials';
  const isSignUp = mode === 'sign-up';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar animated={false} hidden={false} style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityLabel="Back to sign-in options" accessibilityRole="button" onPress={onBack} style={styles.back}>
          <NavArrowLeft color={colors.ink} height={25} strokeWidth={2.35} width={25} />
        </Pressable>
        <View style={styles.hero}>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={KIKO_ART} style={styles.art} />
          <Text accessibilityRole="header" style={styles.title}>
            {stage === 'new-password' ? 'Create a new password' : isVerifying ? 'Check your email' : isSignUp ? 'Create your Okyo account' : 'Sign in with email'}
          </Text>
          <Text style={styles.body}>
            {stage === 'verify-sign-up'
              ? `Enter the verification code we sent to ${emailAddress.trim()}.`
              : stage === 'verify-device'
                ? `Enter the sign-in code we sent to ${emailAddress.trim()}.`
                : stage === 'verify-password-reset'
                  ? `Enter the password reset code we sent to ${emailAddress.trim()}.`
                  : stage === 'new-password'
                    ? 'Choose a new password for your account.'
                : 'Use your email address and password to access your Okyo account.'}
          </Text>
        </View>
        <View style={styles.actions}>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {stage === 'new-password' ? (
            <>
              <TextInput
                accessibilityLabel="New password"
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="New password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.credentialInput}
                textContentType="newPassword"
                value={password}
              />
              <Text style={styles.passwordHint}>Use at least 15 characters.</Text>
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => void submitNewPassword()} style={[styles.providerButton, styles.providerPrimary]}>
                {isBusy ? <ActivityIndicator color={colors.surface} /> : <Text style={[styles.providerLabel, styles.providerLabelPrimary]}>Update password</Text>}
              </Pressable>
            </>
          ) : isVerifying ? (
            <>
              <TextInput
                accessibilityLabel="Email verification code"
                autoComplete="one-time-code"
                autoCorrect={false}
                keyboardType="number-pad"
                maxLength={10}
                onChangeText={setCode}
                placeholder="Verification code"
                placeholderTextColor={colors.muted}
                style={styles.credentialInput}
                value={code}
              />
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => void verifyCode()} style={[styles.providerButton, styles.providerPrimary]}>
                {isBusy ? <ActivityIndicator color={colors.surface} /> : <Text style={[styles.providerLabel, styles.providerLabelPrimary]}>Verify email</Text>}
              </Pressable>
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => void resendCode()} style={styles.textAction}>
                <Text style={styles.textActionLabel}>Send a new code</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmailAddress}
                placeholder="Email address"
                placeholderTextColor={colors.muted}
                style={styles.credentialInput}
                textContentType="emailAddress"
                value={emailAddress}
              />
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                onChangeText={setPassword}
                placeholder={isSignUp ? 'Create a password' : 'Password'}
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.credentialInput}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                value={password}
              />
              {isSignUp ? <Text style={styles.passwordHint}>Use at least 15 characters.</Text> : null}
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => void submitCredentials()} style={[styles.providerButton, styles.providerPrimary]}>
                {isBusy ? <ActivityIndicator color={colors.surface} /> : <Text style={[styles.providerLabel, styles.providerLabelPrimary]}>{isSignUp ? 'Create account' : 'Sign in'}</Text>}
              </Pressable>
              {!isSignUp ? <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => void startPasswordReset()} style={styles.textAction}>
                <Text style={styles.textActionLabel}>Forgot password?</Text>
              </Pressable> : null}
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => {
                setMode(isSignUp ? 'sign-in' : 'sign-up');
                setError(null);
              }} style={styles.textAction}>
                <Text style={styles.textActionLabel}>{isSignUp ? 'Already have an account? Sign in' : 'New to Okyo? Create an account'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SignInScreen({ onDone, onSkip, onBack, allowSkip = true, buttonAction = 'continue', title = 'Sign in to Okyo', subtitle = 'Continue with email and password, Apple, or Google. Most recipes and preferences stay on this device.' }: SignInScreenProps) {
  useLaunchDestinationReady(true, true);
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const googleState = useSyncExternalStore(googleSsoFlight.subscribe, googleSsoFlight.getSnapshot);
  const appleState = useSyncExternalStore(appleSignInFlight.subscribe, appleSignInFlight.getSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<'apple' | 'google' | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const onDoneRef = useRef(onDone);

  const trackNewAccount = useCallback((flow: 'sign_in' | 'sign_up' | 'unknown', provider: 'apple' | 'google') => {
    if (flow !== 'sign_up') return;
    void onboardingQuestionExperiment.getAssignment().then((variant) => {
      track(analyticsEvents.ACCOUNT_CREATED, {
        experiment_name: 'branch_questions_v1',
        experiment_variant: variant,
        provider,
        result: 'success',
      });
    });
  }, []);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (googleState.phase !== 'awaiting_session') return;

    if (isClerkSessionReady({ isLoaded, isSignedIn: isSignedIn === true })) {
      if (googleSsoFlight.confirmSignedIn()) {
        uiLog('SignInScreen', 'sign_in_succeeded', { flow: googleState.flow, strategy: 'oauth_google', isSignedIn: true });
        trackNewAccount(googleState.flow ?? 'unknown', 'google');
        onDoneRef.current();
      }
      return;
    }

    const timeout = setTimeout(() => {
      if (googleSsoFlight.failIfUnconfirmed()) {
        uiLog('SignInScreen', 'sign_in_session_unconfirmed', { strategy: 'oauth_google', isSignedIn: false });
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [isLoaded, isSignedIn, googleState, trackNewAccount]);

  useEffect(() => {
    if (appleState.phase !== 'awaiting_session') return;

    if (isClerkSessionReady({ isLoaded, isSignedIn: isSignedIn === true })) {
      if (appleSignInFlight.confirmSignedIn()) {
        uiLog('SignInScreen', 'sign_in_succeeded', { strategy: 'oauth_apple', isSignedIn: true });
        trackNewAccount(appleState.flow ?? 'unknown', 'apple');
        onDoneRef.current();
      }
      return;
    }

    const timeout = setTimeout(() => {
      if (appleSignInFlight.failIfUnconfirmed()) {
        uiLog('SignInScreen', 'sign_in_session_unconfirmed', { strategy: 'oauth_apple', isSignedIn: false });
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [appleState, isLoaded, isSignedIn, trackNewAccount]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setError('Apple sign-in is available on iPhone and iPad.');
      return;
    }
    setLastProvider('apple');
    setError(null);
    track(analyticsEvents.SIGN_IN_STARTED, { provider: 'apple' });
    let setActiveRan = false;
    const outcome = await appleSignInFlight.start({
      isLoaded,
      isSignedIn: isSignedIn === true,
      isOtherAuthActive: () => googleSsoFlight.getSnapshot().phase !== 'idle',
      startAppleAuthenticationFlow,
      onSetActive: () => { setActiveRan = true; },
    });
    if (outcome.kind === 'cancelled') uiLog('SignInScreen', 'sign_in_cancelled', { strategy: 'oauth_apple' });
    if (outcome.kind === 'incomplete') uiLog('SignInScreen', 'sign_in_incomplete', { strategy: 'oauth_apple' });
    if (outcome.kind === 'awaiting_session') uiLog('SignInScreen', 'sign_in_session_activated', { strategy: 'oauth_apple', flow: outcome.flow });
    if (outcome.kind === 'failed') uiLog('SignInScreen', 'sign_in_failed', { strategy: 'oauth_apple', code: outcome.code, httpStatus: outcome.httpStatus, rejectedParameter: outcome.rejectedParameter, messageCategory: outcome.messageCategory, requestId: outcome.requestId });
    if (outcome.kind === 'failed') track(analyticsEvents.SIGN_IN_FAILED, { provider: 'apple', result: 'failure', reason: 'auth_failed' });
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Only safe flags and sanitized Clerk diagnostics; never log the result.
      // eslint-disable-next-line no-console
      console.info('[Okyo Auth]', {
        event: outcome.kind === 'failed' ? 'apple_flow_failed' : 'apple_flow_result',
        environment: classifyClerkPublishableKey(CLERK_PUBLISHABLE_KEY),
        clerkLoaded: isLoaded,
        clerkSignedIn: isSignedIn === true,
        existingSessionReported: outcome.kind === 'already_signed_in',
        createdSessionIdReturned: outcome.kind === 'awaiting_session' || outcome.kind === 'failed' ? outcome.createdSessionIdReturned : false,
        setActiveRan,
        httpStatus: outcome.kind === 'failed' ? outcome.httpStatus : null,
        code: outcome.kind === 'failed' ? outcome.code : outcome.kind === 'already_signed_in' ? 'session_exists' : null,
        rejectedParameter: outcome.kind === 'failed' ? outcome.rejectedParameter ?? null : null,
        messageCategory: outcome.kind === 'failed' ? outcome.messageCategory : null,
        requestId: outcome.kind === 'failed' ? outcome.requestId ?? null : null,
      });
    }
  }, [isLoaded, isSignedIn, startAppleAuthenticationFlow]);

  const signInWithGoogle = useCallback(async () => {
    const strategy: AllowedAuthStrategy = 'oauth_google';
    // Defence in depth: even if a caller somehow passes another strategy,
    // it never reaches Clerk.
    if (!isAllowedAuthStrategy(strategy)) return;
    const requestAlreadyActive = googleSsoFlight.getSnapshot().phase !== 'idle';
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.info('[Okyo Auth]', { event: 'google_handler_entered', requestAlreadyActive });
    }
    if (appleSignInFlight.getSnapshot().phase !== 'idle' || requestAlreadyActive) return;
    setLastProvider('google');
    setError(null);
    track(analyticsEvents.SIGN_IN_STARTED, { provider: 'google' });
    let setActiveRan = false;

    const outcome = await googleSsoFlight.start({
      isLoaded,
      isSignedIn: isSignedIn === true,
      startSSOFlow: () => startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'okyo', path: 'continue' }),
      }),
      onSsoSetActive: () => { setActiveRan = true; },
    });
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Only flags and sanitized Clerk error fields. Never include resource IDs.
      // eslint-disable-next-line no-console
      console[outcome.kind === 'failed' ? 'warn' : 'info']('[Okyo Auth]', {
        event: 'google_flow_result',
        environment: classifyClerkPublishableKey(CLERK_PUBLISHABLE_KEY),
        clerkLoaded: isLoaded,
        clerkSignedIn: isSignedIn === true,
        existingSessionReported: outcome.kind === 'already_signed_in',
        browserLaunchAttempted: 'browserLaunchAttempted' in outcome ? outcome.browserLaunchAttempted : false,
        createdSessionIdReturned: 'createdSessionIdReturned' in outcome ? outcome.createdSessionIdReturned : null,
        setActiveRan,
        httpStatus: outcome.kind === 'failed' ? outcome.httpStatus : null,
        code: outcome.kind === 'failed' ? outcome.code : null,
        request: 'oauth_google.sign_in.create',
      });
    }
    if (outcome.kind === 'failed') {
      uiLog('SignInScreen', 'sign_in_failed', { code: outcome.code, strategy });
      track(analyticsEvents.SIGN_IN_FAILED, { provider: 'google', result: 'failure', reason: 'auth_failed' });
    }
    if (outcome.kind === 'cancelled') uiLog('SignInScreen', 'sign_in_cancelled', { strategy });
    if (outcome.kind === 'incomplete') uiLog('SignInScreen', 'sign_in_incomplete', { strategy });
  }, [isLoaded, isSignedIn, startSSOFlow]);

  const signInWith = useCallback((strategy: AllowedAuthStrategy) => {
    if (strategy === 'oauth_apple') return signInWithApple();
    return signInWithGoogle();
  }, [signInWithApple, signInWithGoogle]);

  const anyBusy = appleState.phase !== 'idle' || googleState.phase !== 'idle';
  const providerError = lastProvider === 'apple' ? appleState.error : lastProvider === 'google' ? googleState.error : null;

  if (showEmailPassword) {
    return <EmailPasswordPanel onBack={() => setShowEmailPassword(false)} onDone={onDone} />;
  }

  if (isLoaded && isSignedIn === true) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar animated={false} hidden={false} style="dark" />
        <View style={styles.signedInContent}>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={KIKO_ART} style={styles.art} />
          <Text accessibilityRole="header" style={styles.title}>You’re already signed in</Text>
          <Text style={styles.body}>You can continue with this account or choose a different one.</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={onDone} style={[styles.providerButton, styles.providerPrimary, styles.signedInAction]}>
            <Text style={[styles.providerLabel, styles.providerLabelPrimary]}>Continue with this account</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={isSwitchingAccount} onPress={() => {
            setError(null);
            setIsSwitchingAccount(true);
            void clerk.signOut().catch(() => setError('Couldn’t switch accounts. Please try again.')).finally(() => setIsSwitchingAccount(false));
          }} style={[styles.providerButton, styles.providerSecondary, styles.signedInAction]}>
            {isSwitchingAccount ? <ActivityIndicator color={colors.ink} /> : <Text style={[styles.providerLabel, styles.providerLabelSecondary]}>Use another account</Text>}
          </Pressable>
          <Pressable accessibilityLabel="Read Okyo’s Privacy Policy" accessibilityRole="button" onPress={() => setPrivacyOpen(true)} style={styles.privacyLink}>
            <Text style={styles.privacyLinkText}>Privacy Policy</Text>
          </Pressable>
        </View>
        <LegalDocumentModal documentId={privacyOpen ? 'privacy-policy' : null} onClose={() => setPrivacyOpen(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar animated={false} hidden={false} style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {onBack ? <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} strokeWidth={2.35} width={25} /></Pressable> : null}
        <View style={styles.hero}>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={KIKO_ART} style={styles.art} />
          <Text maxFontSizeMultiplier={1.3} style={styles.title}>{title}</Text>
          <Text maxFontSizeMultiplier={1.4} style={styles.body}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.actions}>
          {error || providerError ? <Text accessibilityRole="alert" maxFontSizeMultiplier={1.4} style={styles.error}>{error ?? providerError}</Text> : null}

          {AUTH_PROVIDER_OPTIONS.map((option) => {
            const isBusy = (option.strategy === 'oauth_apple' && appleState.phase !== 'idle') || (option.strategy === 'oauth_google' && googleState.phase !== 'idle');
            const isPrimary = option.variant === 'primary';
            const spinnerColor = isPrimary ? colors.surface : colors.ink;
            return (
              <Pressable
                accessibilityLabel={option.accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{ busy: isBusy, disabled: anyBusy }}
                disabled={anyBusy}
                key={option.strategy}
                onPress={() => void signInWith(option.strategy)}
                style={({ pressed }) => [
                  styles.providerButton,
                  isPrimary ? styles.providerPrimary : styles.providerSecondary,
                  pressed && !anyBusy ? styles.pressed : null,
                  anyBusy && !isBusy ? styles.dimmed : null,
                ]}
              >
                {isBusy ? (
                  <ActivityIndicator color={spinnerColor} />
                ) : (
                  <>
                    {isPrimary ? <AppleMark color={colors.surface} /> : null}
                    <Text
                      maxFontSizeMultiplier={1.3}
                      style={[styles.providerLabel, isPrimary ? styles.providerLabelPrimary : styles.providerLabelSecondary]}
                    >
                      {option.label.replace(/^Continue with/, buttonAction === 'sign-in' ? 'Sign in with' : 'Continue with')}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            disabled={anyBusy}
            onPress={() => setShowEmailPassword(true)}
            style={[styles.providerButton, styles.providerSecondary, styles.emailPasswordButton]}
          >
            <Text maxFontSizeMultiplier={1.3} style={[styles.providerLabel, styles.providerLabelSecondary]}>Use email and password</Text>
          </Pressable>

          {allowSkip ? <Pressable
            accessibilityLabel="Skip signing in for now"
            accessibilityRole="button"
            disabled={anyBusy}
            onPress={onSkip}
            style={({ pressed }) => [styles.skipButton, pressed ? styles.pressed : null]}
          >
            <Text maxFontSizeMultiplier={1.3} style={styles.skipLabel}>Maybe later</Text>
          </Pressable> : null}

          <Text maxFontSizeMultiplier={1.3} style={styles.legal}>
            Okyo uses your sign-in account information to manage your account. Most recipe data stays on this device; scans and AI requests use our service.
          </Text>
          <Pressable accessibilityLabel="Read Okyo’s Privacy Policy" accessibilityRole="button" onPress={() => setPrivacyOpen(true)} style={styles.privacyLink}>
            <Text style={styles.privacyLinkText}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
      <LegalDocumentModal documentId={privacyOpen ? 'privacy-policy' : null} onClose={() => setPrivacyOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  back: { alignItems: 'center', borderColor: colors.border, borderRadius: 24, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  art: { height: 116, width: 116 },
  body: {
    color: colors.body,
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    maxWidth: 300,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.section,
  },
  dimmed: { opacity: 0.4 },
  credentialInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.button,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.medium,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  emailPasswordButton: { marginTop: spacing.xs },
  passwordHint: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 12, marginTop: -spacing.xs },
  error: {
    color: colors.danger,
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  hero: { alignItems: 'center', flexGrow: 1, flexShrink: 0, justifyContent: 'center', paddingVertical: spacing.md },
  legal: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  privacyLink: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  privacyLinkText: { color: colors.ink, fontFamily: fontFamilies.semibold, fontSize: 13, textDecorationLine: 'underline' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  providerButton: {
    alignItems: 'center',
    borderRadius: radius.button,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  providerLabel: { flexShrink: 1, fontFamily: fontFamilies.semibold, fontSize: 16, textAlign: 'center' },
  providerLabelPrimary: { color: colors.surface },
  providerLabelSecondary: { color: colors.ink },
  providerPrimary: { backgroundColor: colors.ink },
  providerSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  signedInAction: { alignSelf: 'stretch' },
  signedInContent: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingHorizontal: spacing.gutter },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    minHeight: 44,
  },
  skipLabel: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 15 },
  textAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  textActionLabel: { color: colors.ink, fontFamily: fontFamilies.semibold, fontSize: 14, textAlign: 'center' },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.bold,
    fontSize: 25,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
