import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { initialOnboardingV3State, onboardingV3Reducer } from '../onboarding-v3/controller/onboardingV3Machine';

const paywall = { ...initialOnboardingV3State, step: 'paywall' as const };

test('only an active entitlement unlocks the post-purchase real-input screen', () => {
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_SUCCEEDED', entitled: true }).step, 'postPurchase');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_SUCCEEDED', entitled: false }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'PURCHASE_CANCELLED' }).step, 'paywall');
  assert.equal(onboardingV3Reducer(paywall, { type: 'RESTORE_SUCCEEDED', entitled: true }).step, 'postPurchase');
});

test('the V3 controller owns one guarded completion effect', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/controller/useOnboardingV3Controller.ts'), 'utf8');
  assert.equal((source.match(/onboardingPersistence\.writeCompleted\(/g) ?? []).length, 1);
  assert.equal((source.match(/\.completeOnboarding\(\)/g) ?? []).length, 1);
  assert.match(source, /didCompleteRef\.current/);
});

test('purchase failure is retryable or dismissible without leaving the paywall', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/screens/OnboardingPaywallScreen.tsx'), 'utf8');
  assert.match(source, />Try Again</);
  assert.match(source, />Not Now</);
  assert.match(source, /selected\.package as PurchasesPackage/);
  assert.match(source, /onDismissError/);
  assert.doesNotMatch(source, /Continue without subscribing|onDevBypass/);
});
