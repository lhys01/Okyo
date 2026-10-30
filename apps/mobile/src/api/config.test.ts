import assert from 'node:assert/strict';
import test from 'node:test';

import { readConfiguredApiUrl, resolveApiBaseUrl } from './config';
import { isClerkConfigured } from '../auth/clerkRuntime';
import { validateReleaseEnvironment } from './releaseEnvironment';

const productionEnvironment = {
  EXPO_PUBLIC_OKYO_API_URL: 'https://api.okyo.example',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_release_fixture',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_release_fixture',
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: 'pro',
};

test('a release build accepts only an HTTPS API endpoint', () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: 'https://api.okyo.example/', isDevelopment: false }), 'https://api.okyo.example');
  assert.equal(resolveApiBaseUrl({ configuredUrl: 'http://192.168.2.42:8081', isDevelopment: false }), '');
  assert.equal(resolveApiBaseUrl({ isDevelopment: false }), '');
});

test('a release build refuses a Railway development service as its API', () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: 'https://sample-service-development.up.railway.app', isDevelopment: false }), '');
});

test('a release build refuses localhost and private-network API endpoints', () => {
  for (const configuredUrl of [
    'https://localhost:8081',
    'https://127.0.0.1:8081',
    'https://10.0.0.4:8081',
    'https://192.168.1.5:8081',
    'https://[::1]:8081',
  ]) {
    assert.equal(resolveApiBaseUrl({ configuredUrl, isDevelopment: false }), '');
  }
});

test('a development build can use its configured LAN endpoint', () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: 'http://192.168.2.42:8081/', isDevelopment: true }), 'http://192.168.2.42:8081');
});

test('API configuration reads exactly EXPO_PUBLIC_OKYO_API_URL', () => {
  assert.equal(readConfiguredApiUrl({ EXPO_PUBLIC_OKYO_API_URL: 'https://api.okyo.example' }), 'https://api.okyo.example');
  assert.equal(readConfiguredApiUrl({ SEXPO_PUBLIC_OKYO_API_URL: 'https://wrong.example' }), undefined);
});

test('release preflight rejects the extra-leading-S API variable with an actionable error', () => {
  const errors = validateReleaseEnvironment({
    SEXPO_PUBLIC_OKYO_API_URL: 'https://development.example',
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: productionEnvironment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
  assert.ok(errors.some((error) => error.includes('rename SEXPO_PUBLIC_OKYO_API_URL')));
});

test('release preflight reports a missing API URL clearly', () => {
  const errors = validateReleaseEnvironment({
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: productionEnvironment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
  assert.ok(errors.some((error) => error.includes('EXPO_PUBLIC_OKYO_API_URL is required')));
});

test('release preflight rejects a Development Clerk key without exposing it', () => {
  const errors = validateReleaseEnvironment({
    EXPO_PUBLIC_OKYO_API_URL: productionEnvironment.EXPO_PUBLIC_OKYO_API_URL,
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_development_fixture',
  });
  assert.ok(errors.some((error) => error.includes('Development key')));
  assert.ok(errors.every((error) => !error.includes('pk_test_development_fixture')));
});

test('release preflight accepts Production API and live Clerk classifications without echoing the key', () => {
  assert.deepEqual(validateReleaseEnvironment(productionEnvironment), []);
  assert.equal(isClerkConfigured(productionEnvironment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, false), true);
});

test('release preflight rejects Development Railway and local API endpoints', () => {
  for (const url of [
    'https://okyo-api-development.up.railway.app',
    'http://192.168.2.42:8081',
  ]) {
    const errors = validateReleaseEnvironment({
      ...productionEnvironment,
      EXPO_PUBLIC_OKYO_API_URL: url,
    });
    assert.ok(errors.some((error) => error.includes('public HTTPS Production endpoint')));
  }
});

test('Development configuration continues to accept Development Clerk and LAN API values', () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: 'http://192.168.2.42:8081', isDevelopment: true }), 'http://192.168.2.42:8081');
  assert.equal(isClerkConfigured('pk_test_development_fixture', true), true);
});
