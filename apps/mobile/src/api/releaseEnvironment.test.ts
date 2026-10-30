import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';
import { validateReleaseEnvironment } from './releaseEnvironment';
import { isReleaseSafeApiUrl } from './config';

const valid = {
  EXPO_PUBLIC_OKYO_API_URL: 'https://api.okyo.example',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_fixture',
  EXPO_PUBLIC_OKYO_SUBSCRIPTIONS_ENABLED: 'true',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_fixture',
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: 'pro',
};

test('Release API URL uses the direct property access Expo substitutes into the bundle', () => {
  const source = readFileSync(new URL('./config.ts', import.meta.url), 'utf8');
  assert.match(source, /configuredUrl: process\.env\.EXPO_PUBLIC_OKYO_API_URL/);
  assert.doesNotMatch(source, /configuredUrl: readConfiguredApiUrl\(process\.env\)/);
});

test('Release refuses preview, local IPv6, internal, credential and query-bearing endpoints', () => {
  for (const url of ['https://api-staging.up.railway.app', 'https://[fd00::1]', 'https://[fe80::1]', 'https://api.local', 'https://api.internal', 'https://user:pass@api.example', 'https://api.example?token=private']) {
    assert.equal(isReleaseSafeApiUrl(url), false, url);
  }
});

test('Release requires the actual iOS RevenueCat configuration and never substitutes a Test Store', () => {
  assert.deepEqual(validateReleaseEnvironment(valid), []);
  for (const key of ['', 'test_private_fixture', 'goog_wrong_platform']) {
    assert.ok(validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_REVENUECAT_IOS_KEY: key }).some((message) => message.includes('RevenueCat')));
  }
  assert.ok(validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: '' }).some((message) => message.includes('entitlement')));
});

test('Release does not require RevenueCat when subscriptions are disabled for launch', () => {
  const failures = validateReleaseEnvironment({
    EXPO_PUBLIC_OKYO_API_URL: valid.EXPO_PUBLIC_OKYO_API_URL,
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: valid.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    EXPO_PUBLIC_OKYO_SUBSCRIPTIONS_ENABLED: 'false',
  });
  assert.deepEqual(failures, []);
});

test('Release refuses Development analytics and QA switches without exposing credentials', () => {
  const failures = validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_ANALYTICS_ENABLED: 'production', EXPO_PUBLIC_POSTHOG_PROJECT_ID: '584818', EXPO_PUBLIC_POSTHOG_KEY: 'private_fixture', EXPO_PUBLIC_OKYO_SAVE_MONEY_STAGE2_PREVIEW: 'true', EXPO_PUBLIC_SENTRY_INTERNAL_PROBE: 'true' });
  assert.ok(failures.some((message) => message.includes('PostHog')));
  assert.ok(failures.some((message) => message.includes('PREVIEW')));
  assert.ok(failures.some((message) => message.includes('PROBE')));
  assert.ok(failures.every((message) => !message.includes('private_fixture')));
});

test('disabled integrations cannot carry Development credentials into the Release environment', () => {
  const failures = validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_REVENUECAT_TEST_KEY: 'test_private_fixture', EXPO_PUBLIC_ANALYTICS_ENABLED: 'false', EXPO_PUBLIC_POSTHOG_PROJECT_ID: '584818' });
  assert.ok(failures.some((message) => message.includes('REVENUECAT_TEST_KEY')));
  assert.ok(failures.some((message) => message.includes('PostHog')));
  assert.ok(failures.every((message) => !message.includes('private_fixture')));
});

test('release rejects secret-like public names and credentials under otherwise allowed names without echoing them', () => {
  for (const name of ['EXPO_PUBLIC_OPENROUTER_API_KEY', 'EXPO_PUBLIC_CLERK_SECRET_KEY', 'EXPO_PUBLIC_DATABASE_URL', 'EXPO_PUBLIC_UNKNOWN_KEY', 'EXPO_PUBLIC_OKYO_ADMIN_EMAILS']) {
    const failures = validateReleaseEnvironment({ ...valid, [name]: 'sensitive-value-must-never-be-echoed' });
    assert.ok(failures.some(message => message.includes(name)));
    assert.ok(failures.every(message => !message.includes('sensitive-value-must-never-be-echoed')));
  }
  const credential = ['sk', 'or', 'v1', 'deliberately-fake'].join('-');
  const failures = validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_POSTHOG_KEY: credential });
  assert.ok(failures.some(message => message.includes('server credential')));
  assert.ok(failures.every(message => !message.includes(credential)));
});
