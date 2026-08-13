import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRevenueCatPaywallPlans,
  hasUsableRevenueCatOffering,
  type RevenueCatPackageLike,
} from './revenueCatPaywall';

function packageFixture(input: {
  identifier: string;
  packageType: string;
  period: string | null;
  price: string;
  pricePerWeek?: string | null;
  productIdentifier: string;
  title: string;
}): RevenueCatPackageLike {
  return {
    identifier: input.identifier,
    packageType: input.packageType,
    product: {
      identifier: input.productIdentifier,
      pricePerWeekString: input.pricePerWeek ?? null,
      priceString: input.price,
      subscriptionPeriod: input.period,
      title: input.title,
    },
  };
}

test('current RevenueCat packages drive the custom paywall without fabricating weekly', () => {
  const monthly = packageFixture({
    identifier: '$rc_monthly',
    packageType: 'MONTHLY',
    period: 'P1M',
    price: '$9.99',
    productIdentifier: 'monthly',
    title: 'Monthly',
  });
  const annual = packageFixture({
    identifier: '$rc_annual',
    packageType: 'ANNUAL',
    period: 'P1Y',
    price: '$79.99',
    pricePerWeek: '$1.54',
    productIdentifier: 'yearly',
    title: 'Yearly',
  });

  const plans = getRevenueCatPaywallPlans({ availablePackages: [monthly, annual] });

  assert.deepEqual(plans.map((plan) => plan.package.identifier), ['$rc_annual']);
  assert.deepEqual(plans.map((plan) => plan.title), ['Annual']);
  assert.equal(plans.some((plan) => plan.title === 'Weekly'), false);
});

test('display pricing is derived entirely from RevenueCat product values', () => {
  const annual = packageFixture({
    identifier: '$rc_annual',
    packageType: 'ANNUAL',
    period: 'P1Y',
    price: '€81.49',
    pricePerWeek: '€1.57',
    productIdentifier: 'yearly',
    title: 'Yearly',
  });
  const [plan] = getRevenueCatPaywallPlans({ availablePackages: [annual] });

  assert.equal(plan.pricing.primary, '€1.57 / week');
  assert.equal(plan.pricing.secondary, 'Billed €81.49 yearly');
});

test('selection retains the exact RevenueCat weekly package object', () => {
  const weekly = packageFixture({
    identifier: '$rc_weekly',
    packageType: 'WEEKLY',
    period: 'P1W',
    price: '£4.99',
    productIdentifier: 'weekly',
    title: 'Weekly',
  });
  const [plan] = getRevenueCatPaywallPlans({ availablePackages: [weekly] });

  assert.equal(plan.package, weekly);
});

test('missing or non-subscription packages do not create fake paywall plans', () => {
  const lifetime = packageFixture({
    identifier: '$rc_lifetime',
    packageType: 'LIFETIME',
    period: null,
    price: '$99.99',
    productIdentifier: 'lifetime',
    title: 'Lifetime',
  });

  assert.deepEqual(getRevenueCatPaywallPlans(null), []);
  assert.deepEqual(getRevenueCatPaywallPlans({ availablePackages: [lifetime] }), []);
  assert.equal(hasUsableRevenueCatOffering({ availablePackages: [lifetime] }), false);
});

test('a real returned weekly package makes an offering usable', () => {
  const weekly = packageFixture({
    identifier: '$rc_weekly',
    packageType: 'WEEKLY',
    period: 'P1W',
    price: '$4.99',
    productIdentifier: 'weekly',
    title: 'Weekly',
  });

  assert.equal(hasUsableRevenueCatOffering({ availablePackages: [weekly] }), true);
});

