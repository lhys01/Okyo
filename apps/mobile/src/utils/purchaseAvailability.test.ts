import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getConfiguredFreeTrialDays,
  getSubscriptionPricing,
  isPurchaseProviderAvailable,
} from './purchaseAvailability';

test('no purchase provider is connected in this build', () => {
  assert.equal(isPurchaseProviderAvailable(), false);
});

test('no free trial is claimed because none is configured with a provider', () => {
  assert.equal(getConfiguredFreeTrialDays(), null);
});

test('annual pricing shows the per-week price as primary and the yearly bill as secondary', () => {
  const pricing = getSubscriptionPricing('annual');
  assert.equal(pricing.primary, '$0.96 / week');
  assert.equal(pricing.secondary, 'Billed as $49.99/year');
});

test('weekly pricing shows the per-week price as primary and "Billed weekly" as secondary', () => {
  const pricing = getSubscriptionPricing('weekly');
  assert.equal(pricing.primary, '$4.99 / week');
  assert.equal(pricing.secondary, 'Billed weekly');
});

test('annual pricing never surfaces a per-month comparison figure', () => {
  const pricing = getSubscriptionPricing('annual');
  assert.equal(pricing.primary.includes('/mo'), false);
  assert.equal(pricing.primary.includes('$4.17'), false);
  assert.equal(pricing.secondary.includes('$4.17'), false);
});
