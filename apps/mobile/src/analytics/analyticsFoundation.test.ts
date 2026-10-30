import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { acceptAnalyticsEvent, resetEventDedupeForTests } from './dedupe';
import { analyticsScreenForRoute, onboardingAnalyticsStage } from './sanitize';
import { ALLOWED_ANALYTICS_EVENTS, sanitizeAnalyticsEvent, sanitizeProperties } from './sanitize';

const root = (file: string) => resolve(process.cwd(), file);

test('approved lifecycle, navigation, onboarding, authentication, scan, tour and deletion events are allow-listed', () => {
  for (const event of [
    'app_opened', 'app_backgrounded', 'app_foregrounded', 'screen_viewed',
    'onboarding_started', 'onboarding_screen_viewed', 'onboarding_answer_submitted', 'account_created',
    'account_creation_started', 'onboarding_experiment_started', 'onboarding_experiment_branch_completed',
    'sign_in_started', 'sign_in_succeeded', 'sign_in_failed', 'account_created', 'scan_started', 'scan_succeeded', 'scan_failed',
    'guided_tour_started', 'guided_tour_completed', 'guided_tour_skipped',
    'account_deletion_started', 'account_deletion_succeeded', 'account_deletion_failed',
    'client_error', 'performance_timing',
  ]) assert.ok(ALLOWED_ANALYTICS_EVENTS.includes(event as never), `missing ${event}`);
  assert.equal(new Set(ALLOWED_ANALYTICS_EVENTS).size, ALLOWED_ANALYTICS_EVENTS.length);
});

test('only known property keys and controlled values survive sanitization', () => {
  const safe = sanitizeProperties({
    app_version: '1.2.3', platform: 'ios', environment: 'development', screen: 'home',
    provider: 'apple', result: 'success', duration_ms: 123, mode: 'high_protein', count_bucket: '2_3',
  });
  assert.deepEqual(Object.keys(safe).sort(), ['app_version', 'duration_ms', 'environment', 'platform', 'provider', 'result', 'screen'].sort());
  assert.deepEqual(sanitizeProperties({ screen: 'Patient data', provider: 'clerk-user-123', result: 'User wrote a paragraph' }), {});
  assert.deepEqual(sanitizeProperties({ environment: 'test', duration_ms: -1, duration_ms_too_big: 88 }), {});
});

test('onboarding conversion events retain only the experiment variant and safe signup provider', () => {
  assert.deepEqual(sanitizeAnalyticsEvent('account_creation_started', {
    experiment_name: 'branch_questions_v1', experiment_variant: 'C', email: 'private@example.com',
  }), {
    event: 'account_creation_started',
    properties: { experiment_name: 'branch_questions_v1', experiment_variant: 'C' },
  });
  assert.deepEqual(sanitizeAnalyticsEvent('account_created', {
    experiment_name: 'branch_questions_v1', experiment_variant: 'B', provider: 'apple', result: 'success', email: 'private@example.com',
  }), {
    event: 'account_created',
    properties: { experiment_name: 'branch_questions_v1', experiment_variant: 'B', provider: 'apple', result: 'success' },
  });
});

test('email, names, credentials, IDs, photos, food and health text are rejected', () => {
  const secret = {
    email: 'person@example.com', name: 'Alex', password: 'pass', token: 'token',
    clerk_id: 'clerk_123', apple_id: 'apple_123', google_id: 'google_123', session_id: 'session_123',
    photo: 'data:image/png;base64,abc', recipe: 'recipe text', allergies: 'peanuts',
    health_answer: 'health answer', signature: 'signature data', typed_text: 'private prompt',
    ip_address: '198.51.100.2', api_response: { raw: true },
  };
  const event = sanitizeAnalyticsEvent('scan_succeeded', { ...secret, source: 'camera', result: 'success' });
  assert.deepEqual(event, { event: 'scan_succeeded', properties: { source: 'camera', result: 'success' } });
  assert.doesNotMatch(JSON.stringify(event), /person@|Alex|pass|token|clerk_|apple_|google_|session_|base64|recipe text|peanuts|health answer|signature data|private prompt|198\.51|raw/);
  assert.equal(sanitizeAnalyticsEvent('unreviewed_event', {}), null);
});

test('navigation maps only static route names and ignores route parameters', () => {
  assert.equal(analyticsScreenForRoute('HomeScreen'), 'home');
  assert.equal(analyticsScreenForRoute('ResultSummaryScreen'), 'scan_result');
  assert.equal(analyticsScreenForRoute('UnknownScreen'), null);
  assert.equal(onboardingAnalyticsStage('question3'), 'preferences');
  assert.equal(onboardingAnalyticsStage('branchInsight'), 'preferences');
  assert.equal(onboardingAnalyticsStage('paywall'), 'plan');
});

test('duplicate identical events from remounts, Strict Mode, retries and navigation are dropped briefly', () => {
  resetEventDedupeForTests();
  assert.equal(acceptAnalyticsEvent('screen_viewed', { screen: 'home' }, 1_000), true);
  assert.equal(acceptAnalyticsEvent('screen_viewed', { screen: 'home' }, 1_100), false);
  assert.equal(acceptAnalyticsEvent('screen_viewed', { screen: 'home' }, 3_000), true);
  assert.equal(acceptAnalyticsEvent('screen_viewed', { screen: 'settings' }, 3_010), true);
});

test('screen, lifecycle, onboarding, auth, scan, tour and account deletion paths use the safe tracker', () => {
  for (const [file, marker] of [
    ['App.tsx', 'trackScreenViewed'],
    ['src/navigation/AppNavigator.tsx', 'APP_OPEN'],
    ['src/onboarding-v3/controller/useOnboardingV3Controller.ts', 'analyticsEvents'],
    ['src/auth/SignInScreen.tsx', 'SIGN_IN_STARTED'],
    ['src/utils/scanController.ts', 'SCAN_STARTED'],
    ['src/tour/TourContext.tsx', 'GUIDED_TOUR_STARTED'],
    ['src/screens/PrivacyDataScreen.tsx', 'ACCOUNT_DELETION_STARTED'],
  ] as const) assert.match(readFileSync(root(file), 'utf8'), new RegExp(marker));
});
