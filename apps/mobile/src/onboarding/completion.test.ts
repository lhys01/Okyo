import assert from 'node:assert/strict';
import test from 'node:test';

import { isPaywallEligible, shouldCompleteOnboarding } from './completion';

test('starting a scan does not complete onboarding', () => {
  assert.equal(
    shouldCompleteOnboarding({ paywallEligible: false, paywallResolved: false, resultSeen: false }),
    false,
  );
});

test('a cancelled, failed or interrupted scan leaves onboarding incomplete', () => {
  // No result was ever seen, regardless of paywall state.
  for (const paywallEligible of [true, false]) {
    for (const paywallResolved of [true, false]) {
      assert.equal(
        shouldCompleteOnboarding({ paywallEligible, paywallResolved, resultSeen: false }),
        false,
      );
    }
  }
});

test('result seen with no eligible paywall completes onboarding', () => {
  assert.equal(
    shouldCompleteOnboarding({ paywallEligible: false, paywallResolved: false, resultSeen: true }),
    true,
  );
});

test('result seen with an eligible paywall waits for the paywall', () => {
  assert.equal(
    shouldCompleteOnboarding({ paywallEligible: true, paywallResolved: false, resultSeen: true }),
    false,
  );
});

test('dismissing or purchasing the eligible paywall completes onboarding', () => {
  assert.equal(
    shouldCompleteOnboarding({ paywallEligible: true, paywallResolved: true, resultSeen: true }),
    true,
  );
});

test('paywall is not eligible before a real result', () => {
  assert.equal(
    isPaywallEligible({ paywallAlreadyShown: false, purchasesAvailable: true, resultSeen: false }),
    false,
    'post-value placement: never before the user got something',
  );
});

test('paywall is not eligible twice', () => {
  assert.equal(
    isPaywallEligible({ paywallAlreadyShown: true, purchasesAvailable: true, resultSeen: true }),
    false,
  );
});

test('paywall is not eligible without a purchase provider', () => {
  assert.equal(
    isPaywallEligible({ paywallAlreadyShown: false, purchasesAvailable: false, resultSeen: true }),
    false,
    'a dead paywall must not gate completion',
  );
});

test('paywall is eligible after a real result, once, with a provider', () => {
  assert.equal(
    isPaywallEligible({ paywallAlreadyShown: false, purchasesAvailable: true, resultSeen: true }),
    true,
  );
});

test('no-provider case still completes onboarding after the result', () => {
  const paywallEligible = isPaywallEligible({
    paywallAlreadyShown: false, purchasesAvailable: false, resultSeen: true,
  });
  assert.equal(
    shouldCompleteOnboarding({ paywallEligible, paywallResolved: false, resultSeen: true }),
    true,
    'onboarding must not dead-end when no paywall can be shown',
  );
});
