import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getRevenueCatDevelopmentLogBoxIgnores,
  REVENUECAT_TEST_STORE_SIMULATED_FAILURE_LOG,
} from './revenueCatLogBox';

const mobileDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relativePath: string) => readFileSync(path.join(mobileDir, relativePath), 'utf8');

test('only the expected Test Store failure log is ignored in development', () => {
  assert.deepEqual(getRevenueCatDevelopmentLogBoxIgnores(true), [
    '[RevenueCat] [Test Store] Purchase failure simulated successfully in Test Store.',
  ]);
  assert.equal(getRevenueCatDevelopmentLogBoxIgnores(true)[0], REVENUECAT_TEST_STORE_SIMULATED_FAILURE_LOG);
  assert.deepEqual(getRevenueCatDevelopmentLogBoxIgnores(false), []);
});

test('the purchase service separates cancellation, entitlement failure, and provider failure', () => {
  const source = read('src/services/revenueCat.ts');
  const start = source.indexOf('export async function purchasePackage');
  const end = source.indexOf('export async function restorePurchases');
  const handler = source.slice(start, end);

  assert.match(handler, /status: 'cancelled'/);
  assert.match(handler, /status: 'not_entitled'/);
  assert.match(handler, /status: 'error'/);
  assert.match(handler, /isUserCancelledError/);
  assert.match(handler, /if \(!nextState\.isEntitled\)/);
});

test('application LogBox handling is development-only and keeps unrelated errors enabled', () => {
  const app = read('App.tsx');
  assert.match(app, /getRevenueCatDevelopmentLogBoxIgnores/);
  assert.match(app, /typeof __DEV__ !== 'undefined' && __DEV__/);
  assert.match(app, /LogBox\.ignoreLogs\(expectedDevelopmentLogs\)/);
  assert.doesNotMatch(app, /ignoreAllLogs|console\.error\s*=/);
});

