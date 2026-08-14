import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(path.join(here, name), 'utf8');

const settings = read('SettingsScreen.tsx');
const privacy = read('PrivacyDataScreen.tsx');
const dietary = read('DietaryPreferencesScreen.tsx');
const mainTabs = readFileSync(path.join(here, '..', 'navigation', 'MainTabs.tsx'), 'utf8');

test('Settings has no placeholder rows', () => {
  // Every row previously called showUnavailable(), which popped "this setting
  // is not enabled in this preview build".
  assert.doesNotMatch(settings, /showUnavailable/);
  assert.doesNotMatch(settings, /not enabled in this preview build/);
});

test('removed settings that were never backed by real state', () => {
  for (const dead of ['Appearance', 'Privacy & safety', 'Dietary interests']) {
    assert.doesNotMatch(
      settings,
      new RegExp(`label="${dead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      `"${dead}" has no backing state and should not be a row`,
    );
  }
});

test('every row navigates somewhere real or performs a real action', () => {
  const destinations = [...settings.matchAll(/go\('(\w+)'\)/g)].map((m) => m[1]);
  assert.ok(destinations.length > 0, 'expected navigable rows');
  for (const destination of destinations) {
    assert.match(
      mainTabs,
      new RegExp(`name="${destination}"`),
      `${destination} is not registered in the navigator`,
    );
  }
});

test('destructive data control is not on the main Settings page', () => {
  // "Delete Liked Data" used to sit at the bottom of Settings.
  assert.doesNotMatch(settings, /clearSavedData/);
  assert.match(privacy, /clearSavedData/);
});

test('reset onboarding is development only', () => {
  const devBlock = settings.slice(settings.indexOf('__DEV__'));
  assert.match(settings, /__DEV__/, 'dev tools must be gated');
  assert.match(devBlock, /Reset onboarding/, 'reset must live inside the __DEV__ block');
  // ...and must not also appear outside the gate.
  const beforeGate = settings.slice(0, settings.indexOf('__DEV__'));
  assert.doesNotMatch(beforeGate, /label="Reset onboarding"/);
});

test('dietary editor reads the mirror for display and writes through the authoritative store (Step 06 repair)', () => {
  assert.match(dietary, /foodPreferencesPersistence\.read\(\)/);
  // Writes now go through saveAuthoritativeDietaryPreferences, which syncs
  // both the canonical profile and the mirror in one place — see
  // state/dietaryPreferencesAuthority.ts. Settings no longer writes the
  // mirror directly, avoiding the two-store silent-disagreement bug this
  // repair fixes.
  assert.match(dietary, /saveAuthoritativeDietaryPreferences\(/);
  assert.doesNotMatch(dietary, /foodPreferencesPersistence\.write\(/);
  assert.match(dietary, /ALLERGIES/);
  assert.match(dietary, /THINGS I AVOID/);
});

test('content clears the floating bottom nav', () => {
  const clearance = Number(/NAV_CLEARANCE = (\d+)/.exec(settings)?.[1]);
  assert.ok(clearance >= 120, `bottom clearance ${clearance} is too small for the floating nav`);
});

test('settings sub-screens are not added to the bottom tab bar', () => {
  const order = /const visibleTabOrder: MainTabRouteName\[\] = \[([\s\S]*?)\]/.exec(mainTabs)?.[1] ?? '';
  for (const sub of ['DietaryPreferencesScreen', 'PrivacyDataScreen', 'HelpSupportScreen', 'LegalScreen']) {
    assert.doesNotMatch(order, new RegExp(sub), `${sub} must not appear as a tab`);
  }
});

test('rows expose accessibility labels and use haptics', () => {
  assert.match(settings, /accessibilityRole="button"/);
  assert.match(settings, /accessibilityLabel=\{?label\}?|accessibilityLabel=/);
  assert.match(settings, /Haptics\.selectionAsync/);
});
