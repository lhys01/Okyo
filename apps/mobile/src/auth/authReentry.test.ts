import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), 'utf8');

const settings = read('../screens/SettingsScreen.tsx');
const signIn = read('./SignInScreen.tsx');
const ssoCompletion = read('./clerkSsoCompletion.ts');
const ssoCompletionTests = read('./clerkSsoCompletion.test.ts');
const googleFlight = read('./googleSsoFlight.ts');
const appleFlight = read('./appleSignInFlight.ts');
const appConfig = read('../../app.json');
const iosInfoPlist = read('../../ios/Okyo/Info.plist');
const authProvider = read('./OkyoAuthProvider.tsx');
const appleEntitlements = read('../../ios/Okyo/Okyo.entitlements');

test('a signed-out user can re-open sign-in from Settings', () => {
  // The end-of-onboarding AuthGate shows once and never again. Without this
  // row, anyone who tapped "Maybe later" (or whose session expired) could
  // never sign in again without reinstalling.
  assert.match(settings, /label="Sign in"/);
  assert.match(
    settings,
    /auth\.isAvailable && !auth\.isSignedIn/,
    'the Sign in row must be gated on Clerk being available and the user signed out',
  );
});

test('Settings mounts SignInScreen lazily, never as a static import', () => {
  // SignInScreen pulls in Clerk native modules at import time; a build with
  // no Clerk key must never evaluate it.
  assert.match(settings, /await import\('\.\.\/auth\/SignInScreen'\)\)\.SignInScreen/);
  assert.doesNotMatch(settings, /import \{ SignInScreen \} from '\.\.\/auth\/SignInScreen'/);
});

test('sign-in sheet closes on both success and cancel', () => {
  assert.match(settings, /<LazySignInScreen onDone=\{closeSignIn\} onSkip=\{closeSignIn\} \/>/);
});

test('sign-out failures do not send raw Clerk errors to logs', () => {
  assert.match(settings, /uiLog\('SettingsScreen', 'sign_out_failed'\)/);
  assert.doesNotMatch(settings, /sign_out_failed[^\n]*(?:error|token|message)/i);
});

test('SignInScreen copy does not promise cross-device sync it cannot deliver', () => {
  // There is no backend user store yet — data is local-only. The copy must
  // not claim recipes sync or "follow you to any device".
  assert.doesNotMatch(signIn, /follow you to any device/i);
  assert.doesNotMatch(signIn, /any device/i);
  assert.match(signIn, /stay on this device/i);
});

test('SignInScreen distinguishes an offline failure from a generic one', () => {
  assert.match(googleFlight, /offline\. Reconnect and try again/i);
  assert.match(googleFlight, /didn.t go through\. Give it another try/i);
});

test('SignInScreen treats a dismissed OAuth sheet as a cancel, not an error', () => {
  // Google hosted OAuth resolves with no created session when dismissed.
  assert.match(signIn, /sign_in_cancelled/);
  assert.match(googleFlight, /completion\.kind === 'cancelled'/);
});

test('Google uses the native Expo callback and waits for Clerk session state before leaving account', () => {
  assert.match(signIn, /startSSOFlow\(\{\s*strategy,\s*redirectUrl:/);
  assert.match(signIn, /googleSsoFlight\.start\(/);
  assert.match(googleFlight, /await activateClerkSsoSession\(result\)/);
  assert.match(signIn, /isClerkSessionReady\(\{ isLoaded, isSignedIn: isSignedIn === true \}\)/);
  assert.match(ssoCompletion, /return isLoaded && isSignedIn/);
  assert.match(googleFlight, /result\.authSessionResult !== null/);
  assert.match(signIn, /onDoneRef\.current\(\)/);
  assert.match(googleFlight, /Google sign-in did not finish/);
  assert.match(googleFlight, /Google sign-in was cancelled/);
  assert.doesNotMatch(signIn, /uiLog\([^\n]*error: String\(caught\)/);
});

test('OAuth completion is finalized on startup and app resume with the okyo native scheme', () => {
  assert.match(authProvider, /completePendingAuthSession\(\)/);
  assert.match(authProvider, /AppState\.addEventListener\('change'/);
  assert.match(authProvider, /if \(state === 'active'\) completePendingAuthSession\(\)/);
  assert.match(appConfig, /"scheme": "okyo"/);
  assert.match(iosInfoPlist, /<string>okyo<\/string>/);
});

test('Apple uses Clerk native iOS authentication and activates the returned secure cached session', () => {
  assert.match(signIn, /from '@clerk\/expo\/apple'/);
  assert.match(signIn, /startAppleAuthenticationFlow,/);
  assert.match(ssoCompletion, /activateClerkAppleSession/);
  assert.match(appleFlight, /await activateClerkAppleSession\(\{/);
  assert.match(signIn, /appleState\.phase !== 'awaiting_session'/);
  assert.match(signIn, /isClerkSessionReady\(\{ isLoaded, isSignedIn: isSignedIn === true \}\)/);
  assert.match(signIn, /strategy === 'oauth_apple'[\s\S]*?signInWithApple\(\)/);
  assert.match(appleFlight, /getCreatedSessionId\(result\)[\s\S]*?kind: 'cancelled'/);
  assert.match(appleFlight, /code === 'ERR_REQUEST_CANCELED'[\s\S]*?kind: 'cancelled'/);
  assert.match(appleFlight, /Apple sign-in couldn’t be completed\. Please try again\./);
  assert.match(signIn, /strategy: 'oauth_apple'[\s\S]*?sign_in_cancelled/);
  assert.doesNotMatch(signIn, /startSSOFlow\(\{\s*strategy:\s*'oauth_apple'/);
});

test('Apple authentication covers existing users, new users, and never activates an absent session', () => {
  assert.match(ssoCompletionTests, /native Apple sign-in activates an existing-user session/);
  assert.match(ssoCompletionTests, /native Apple sign-up activates its returned session/);
  assert.match(ssoCompletionTests, /never activates an absent or unverified session/);
  assert.match(appleFlight, /getSafeClerkErrorDiagnostics\(caught\)/);
  assert.match(appleFlight, /strategy_not_enabled/);
  assert.match(signIn, /event: outcome\.kind === 'failed' \? 'apple_flow_failed'/);
  assert.match(signIn, /createdSessionIdReturned/);
  assert.match(signIn, /setActiveRan/);
});

test('Apple native module, capability, and non-floating development-menu configuration are present', () => {
  assert.match(appConfig, /"expo-apple-authentication"/);
  assert.match(appConfig, /"usesAppleSignIn": true/);
  assert.match(appConfig, /"EXDevMenuShowFloatingActionButton": false/);
  assert.match(appleEntitlements, /com\.apple\.developer\.applesignin/);
});

test('Apple is the primary (filled) button and carries the Apple mark', () => {
  assert.match(signIn, /variant === 'primary'/);
  assert.match(signIn, /<AppleMark/);
  // Primary fill uses the Okyo ink token, matching PrimaryButton.
  assert.match(signIn, /providerPrimary: \{ backgroundColor: colors\.ink \}/);
});
