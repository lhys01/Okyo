import assert from 'node:assert/strict';
import test from 'node:test';

import { decideOnboardingActivation, createOnboardingActivationResolver, type OnboardingActivationEvidence } from './onboardingV4Activation';
import { mapLegacyResumeStep, onboardingV3Reducer, initialOnboardingV3State } from '../controller/onboardingV3Machine';

const none: OnboardingActivationEvidence = {
  assignment: null,
  hasV3Progress: false,
  hasV3Profile: false,
  hasV4Draft: false,
  hasV4InFlightScan: false,
  hasV4FreeRecipe: false,
  hasV4PremiumAction: false,
};

test('Step 11 migration matrix deterministically selects exactly one engine', () => {
  const rows: Array<[string, OnboardingActivationEvidence, 'v3' | 'v4']> = [
    ['new install', none, 'v4'],
    ['assigned v3', { ...none, assignment: 'v3' }, 'v3'],
    ['assigned v4', { ...none, assignment: 'v4' }, 'v4'],
    ['V3 before goal', { ...none, hasV3Progress: true }, 'v3'],
    ['V3 goal branch', { ...none, hasV3Progress: true, hasV3Profile: true }, 'v3'],
    ['V3 dietary', { ...none, hasV3Progress: true, hasV3Profile: true }, 'v3'],
    ['V3 plan/paywall', { ...none, hasV3Progress: true, hasV3Profile: true }, 'v3'],
    ['V3 purchased', { ...none, assignment: 'v3', hasV3Profile: true }, 'v3'],
    ['V3 scan/recipe', { ...none, assignment: 'v3', hasV3Progress: true }, 'v3'],
    ['completed user selection is bypassed by AppNavigator', none, 'v4'],
    ['V4 before plan', { ...none, hasV4Draft: true }, 'v4'],
    ['V4 analysis recovery', { ...none, hasV4InFlightScan: true }, 'v4'],
    ['V4 free recipe', { ...none, hasV4FreeRecipe: true }, 'v4'],
    ['V4 paywall', { ...none, hasV4Draft: true, hasV4FreeRecipe: true }, 'v4'],
    ['V4 premium action', { ...none, hasV4PremiumAction: true }, 'v4'],
    ['malformed assignment with no evidence', none, 'v4'],
    ['valid legacy profile without route', { ...none, hasV3Profile: true }, 'v3'],
    ['subscriber with entitlement temporarily unavailable', { ...none, assignment: 'v4', hasV4FreeRecipe: true }, 'v4'],
  ];
  for (const [name, evidence, engine] of rows) assert.equal(decideOnboardingActivation(evidence).engine, engine, name);
});

test('sticky assignments win over mixed evidence and preserve rollback state', () => {
  assert.equal(decideOnboardingActivation({ ...none, assignment: 'v3', hasV4Draft: true }).engine, 'v3');
  assert.equal(decideOnboardingActivation({ ...none, assignment: 'v4', hasV3Profile: true }).engine, 'v4');
});

test('resolver persists a new V4 assignment once and reuses it after restart', async () => {
  const values = new Map<string, string>();
  const storage = { async getItem(key: string) { return values.get(key) ?? null; } };
  let assignment: 'v3' | 'v4' | null = null;
  let writes = 0;
  const assignments = {
    async readAssignment() { return assignment; },
    async writeAssignment(value: 'v3' | 'v4') { assignment = value; writes += 1; },
    async getAssignment() { return assignment ?? 'v3'; },
  };
  const resolve = createOnboardingActivationResolver(storage, assignments);
  assert.equal((await resolve()).engine, 'v4');
  assert.equal((await resolve()).engine, 'v4');
  assert.equal(writes, 1);
});

test('temporary assignment or evidence read failure fails closed to one V3 engine', async () => {
  const resolve = createOnboardingActivationResolver(
    { async getItem() { throw new Error('temporarily unavailable'); } },
    { async readAssignment() { return null; }, async writeAssignment() {}, async getAssignment() { return 'v3' as const; } },
  );
  assert.equal((await resolve()).engine, 'v3');
});

test('live hydration resumes every restored route directly; only the always-dead personalizedFuture still redirects', () => {
  // V4 (Step 11) briefly removed nameFox/branchIntro/secondaryGoals and this
  // test proved hydration redirected persisted routes for them. V4 was
  // rejected and V3 was restored byte-for-byte, so those three are live
  // steps again and resume directly. personalizedFuture is the one
  // exception: it has no reachable forward transition even in the restored
  // reducer (see its HYDRATE-branch ternary), so it always redirected to
  // planReady — in the original pre-V4 source, not only during Step 11.
  const profile = { ...initialOnboardingV3State.profile, primaryGoal: 'save_money' as const, secondaryGoals: ['save_money' as const] };
  const mapLegacyResumeStepExpected: Record<string, string> = { nameFox: 'nameFox', branchIntro: 'branchIntro', secondaryGoals: 'secondaryGoals', personalizedFuture: 'personalizedFuture' };
  const hydratedStepExpected: Record<string, string> = { nameFox: 'nameFox', branchIntro: 'branchIntro', secondaryGoals: 'secondaryGoals', personalizedFuture: 'planReady' };
  for (const route of Object.keys(hydratedStepExpected)) {
    assert.equal(mapLegacyResumeStep(route), mapLegacyResumeStepExpected[route]);
    const hydrated = onboardingV3Reducer(initialOnboardingV3State, { type: 'HYDRATE', profile, resumeStep: route, mascotName: 'Kiko', attribution: null });
    assert.equal(onboardingV3Reducer(hydrated, { type: 'SPLASH_FINISHED', elapsedMs: 700, fontsLoaded: true }).step, hydratedStepExpected[route]);
  }
});
