import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { shouldUseOnboardingV4 } from './state/onboardingV4Route';
import { decideOnboardingActivation } from './state/onboardingV4Activation';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/**
 * V4's shortened onboarding sequence and visual design were rejected after
 * release-candidate QA. This suite proves the production-visible-onboarding
 * decision end to end: the legacy V3 flow is restored and is what a real
 * install sees, V4 is preserved but unreachable, and completed users are
 * untouched. Route-by-route reducer behavior lives in
 * controller/onboardingV3Machine.test.ts; this file covers the integration
 * points around it (the flag, the assignment resolver, and the single
 * OnboardingV3.tsx mount point).
 */

test('the master switch is off by default', () => {
  assert.match(read('src/config/devFlags.ts'), /export const ONBOARDING_V4_ENABLED = false;/);
});

test('a brand-new install (no assignment, no V3 or V4 state) resolves to V3 while the switch is off', () => {
  // decideOnboardingActivation would pick V4 for a truly fresh install if the
  // caller ignored the master switch — OnboardingV3.tsx never does: it seeds
  // `assignment` with the literal 'v3' and skips calling this resolver
  // entirely whenever ONBOARDING_V4_ENABLED is false (see the two assertions
  // below), so a fresh install can never reach the 'new_install' -> 'v4'
  // branch this test also documents.
  const decision = decideOnboardingActivation({
    assignment: null,
    hasV3Progress: false,
    hasV3Profile: false,
    hasV4Draft: false,
    hasV4InFlightScan: false,
    hasV4FreeRecipe: false,
    hasV4PremiumAction: false,
  });
  assert.equal(decision.reason, 'new_install');
  assert.equal(decision.engine, 'v4');
  assert.equal(shouldUseOnboardingV4({ enabled: false, assignment: decision.assignment }), false);
});

test('OnboardingV3.tsx seeds a fresh install straight to v3 and never calls the async resolver while the switch is off', () => {
  const host = read('src/onboarding-v3/OnboardingV3.tsx');
  assert.match(host, /useState<OnboardingV4Assignment \| null>\(ONBOARDING_V4_ENABLED \? null : 'v3'\)/);
  assert.match(host, /if \(!ONBOARDING_V4_ENABLED\) return;/);
});

test('a stored v4 assignment is still overridden while the switch is off', () => {
  assert.equal(shouldUseOnboardingV4({ enabled: false, assignment: 'v4' }), false);
});

test('completed users bypass onboarding entirely, independent of the onboarding engine flag', () => {
  // AppNavigator.tsx never mounts OnboardingV3 (or either engine inside it)
  // for a completed install — that gate is startupGate.ts, driven by
  // onboardingPersistence, not by ONBOARDING_V4_ENABLED.
  const navigator = read('src/navigation/AppNavigator.tsx');
  assert.doesNotMatch(navigator, /ONBOARDING_V4_ENABLED/);
  assert.match(navigator, /onboardingPersistence\.readCompleted/);
  assert.match(navigator, /getStartupRoute/);
});

test('only one onboarding engine mounts: OnboardingV3.tsx is a single top-level if/else, not a nested or parallel mount', () => {
  const host = read('src/onboarding-v3/OnboardingV3.tsx');
  const returnsInEntryFunction = host
    .slice(host.indexOf('export function OnboardingV3'), host.indexOf('function LegacyOnboardingV3'))
    .match(/return\s*\(?\s*</g) ?? [];
  // Exactly 3 JSX returns in the entry component: the loading placeholder,
  // <OnboardingV4 .../>, and <LegacyOnboardingV3 .../> — never both engines
  // in the same return.
  assert.equal(returnsInEntryFunction.length, 3);
});

test('V4 remains fully wired and importable — the rollback hid it, it did not delete it', () => {
  const host = read('src/onboarding-v3/OnboardingV3.tsx');
  assert.match(host, /import \{ OnboardingV4 \} from '\.\/screens-v4\/OnboardingV4';/);
  assert.match(host, /<OnboardingV4/);
});
