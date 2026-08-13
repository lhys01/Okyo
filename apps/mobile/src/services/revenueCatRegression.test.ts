import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string) {
  return readFileSync(path.join(srcDir, relativePath), 'utf8');
}

function sliceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('RevenueCat entitlement state covers loading, unavailable, error, and ready', () => {
  const source = read('services/revenueCat.ts');
  assert.match(source, /status: 'loading'/);
  assert.match(source, /status: 'unavailable'; reason: string/);
  assert.match(source, /status: 'error'; error: string/);
  assert.match(source, /status: 'ready'/);
});

test('missing SDK configuration fails closed without embedding a secret', () => {
  const source = read('services/revenueCat.ts');
  assert.match(source, /configuration\.apiKey[\s\S]*status: 'loading'/);
  assert.match(source, /status: 'unavailable'/);
  assert.doesNotMatch(source, /apiKey:\s*['"]sk_/);
});

test('RevenueCat initializes once near app startup', () => {
  const app = read('../App.tsx');
  const source = read('services/revenueCat.ts');
  assert.match(app, /useEffect\(\(\) => \{[\s\S]*void initializeRevenueCat\(\);[\s\S]*\}, \[\]\);/);
  assert.match(source, /if \(!initializationPromise\) \{/);
  assert.equal((source.match(/Purchases\.configure\(/g) ?? []).length, 1);
});

test('initialization fetches the current offering and logs localized package prices', () => {
  const source = read('services/revenueCat.ts');
  assert.match(source, /Purchases\.getOfferings\(\)/);
  assert.match(source, /offerings\.current \?\? null/);
  assert.match(source, /currentOfferingIdentifier: offering\?\.identifier/);
  assert.match(source, /localizedPrice: pkg\.product\.priceString/);
  assert.doesNotMatch(source, /console\.log\([^\n]*apiKey/);
});

test('purchase uses the exact selected package and requires the configured entitlement', () => {
  const source = read('services/revenueCat.ts');
  const purchase = sliceBetween(source, 'export async function purchasePackage', 'export async function restorePurchases');
  assert.match(purchase, /Purchases\.purchasePackage\(packageToPurchase\)/);
  assert.match(purchase, /const nextState = toReadyState\(result\.customerInfo/);
  assert.match(purchase, /if \(!nextState\.isEntitled\)/);
  assert.match(purchase, /status: 'not_entitled'/);
  assert.match(purchase, /status: 'purchased'/);
  assert.ok(purchase.indexOf('if (!nextState.isEntitled)') < purchase.indexOf("status: 'purchased'"));
});

test('purchase cancellation is distinct from failure and never grants access', () => {
  const source = read('services/revenueCat.ts');
  const purchase = sliceBetween(source, 'export async function purchasePackage', 'export async function restorePurchases');
  assert.match(purchase, /isUserCancelledError/);
  assert.match(purchase, /status: 'cancelled'/);
  assert.match(purchase, /status: 'error'/);
  assert.equal((purchase.match(/status: 'purchased'/g) ?? []).length, 1);
});

test('restore returns entitlement truth from CustomerInfo', () => {
  const source = read('services/revenueCat.ts');
  const restore = sliceBetween(source, 'export async function restorePurchases', 'function isUserCancelledError');
  assert.match(restore, /Purchases\.restorePurchases\(\)/);
  assert.match(restore, /const nextState = toReadyState\(customerInfo/);
  assert.match(restore, /isEntitled: nextState\.isEntitled/);
});

test('the service never writes a local premium flag as entitlement truth', () => {
  const source = read('services/revenueCat.ts');
  assert.doesNotMatch(source, /useOkyoStore/);
  assert.doesNotMatch(source, /setPremium/);
});

test('the paywall mapper uses only returned packages and localized product prices', () => {
  const source = read('utils/revenueCatPaywall.ts');
  assert.match(source, /offering\.availablePackages/);
  assert.match(source, /pkg\.product\.priceString/);
  assert.match(source, /pkg\.product\.pricePerWeekString/);
  assert.match(source, /pkg\.packageType === 'ANNUAL' \|\| pkg\.packageType === 'WEEKLY'/);
  assert.doesNotMatch(source, /\$0\.96|\$4\.99|\$49\.99/);
});

test('missing entitlement ID is diagnosed but never guessed or treated as access', () => {
  const source = read('services/revenueCat.ts');
  assert.match(source, /EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID/);
  assert.match(source, /entitlementIdConfigured: Boolean\(configuration\.entitlementId\)/);
  assert.match(source, /configuration\.entitlementId &&[\s\S]*customerInfo\.entitlements\.active\[configuration\.entitlementId\]/);
  assert.doesNotMatch(source, /['"](?:premium|pro|Okyo Pro)['"]/);
});

