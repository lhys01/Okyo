import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRevenueCatTestStoreKey,
  resolveRevenueCatConfiguration,
} from './revenueCatConfig';

test('development uses the explicitly configured RevenueCat Test Store key', () => {
  const configuration = resolveRevenueCatConfiguration({
    isDevelopment: true,
    platform: 'ios',
    testStoreKey: 'test_public_sdk_key',
  });

  assert.equal(configuration.apiKey, 'test_public_sdk_key');
  assert.equal(configuration.keySource, 'test-store');
  assert.equal(configuration.reason, null);
});

test('development never falls back to a production platform key', () => {
  const configuration = resolveRevenueCatConfiguration({
    iosKey: 'appl_public_sdk_key',
    isDevelopment: true,
    platform: 'ios',
  });

  assert.equal(configuration.apiKey, null);
  assert.match(configuration.reason ?? '', /TEST_KEY/);
});

test('production rejects a Test Store key even when placed in the platform variable', () => {
  const configuration = resolveRevenueCatConfiguration({
    iosKey: 'test_public_sdk_key',
    isDevelopment: false,
    platform: 'ios',
    testStoreKey: 'test_different_sdk_key',
  });

  assert.equal(configuration.apiKey, null);
  assert.equal(configuration.keySource, null);
  assert.match(configuration.reason ?? '', /cannot be used in a release build/);
});

test('production selects only its matching platform public SDK key', () => {
  const ios = resolveRevenueCatConfiguration({
    androidKey: 'goog_android_public_key',
    iosKey: 'appl_ios_public_key',
    isDevelopment: false,
    platform: 'ios',
    testStoreKey: 'test_public_sdk_key',
  });
  const android = resolveRevenueCatConfiguration({
    androidKey: 'goog_android_public_key',
    iosKey: 'appl_ios_public_key',
    isDevelopment: false,
    platform: 'android',
    testStoreKey: 'test_public_sdk_key',
  });

  assert.equal(ios.apiKey, 'appl_ios_public_key');
  assert.equal(ios.keySource, 'ios-production');
  assert.equal(android.apiKey, 'goog_android_public_key');
  assert.equal(android.keySource, 'android-production');
});

test('missing production platform configuration fails closed', () => {
  const configuration = resolveRevenueCatConfiguration({
    isDevelopment: false,
    platform: 'android',
    testStoreKey: 'test_public_sdk_key',
  });

  assert.equal(configuration.apiKey, null);
  assert.equal(configuration.keySource, null);
  assert.match(configuration.reason ?? '', /ANDROID_KEY/);
});

test('entitlement identifier is explicit and never guessed by configuration', () => {
  const missing = resolveRevenueCatConfiguration({
    isDevelopment: true,
    platform: 'ios',
    testStoreKey: 'test_public_sdk_key',
  });
  const configured = resolveRevenueCatConfiguration({
    entitlementId: 'dashboard_identifier',
    isDevelopment: true,
    platform: 'ios',
    testStoreKey: 'test_public_sdk_key',
  });

  assert.equal(missing.entitlementId, null);
  assert.equal(configured.entitlementId, 'dashboard_identifier');
  assert.equal(isRevenueCatTestStoreKey(configured.apiKey), true);
});

