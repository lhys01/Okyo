import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOnboardingV4ActivationPhase,
  ONBOARDING_V4_STEPS,
  shouldUseOnboardingV4,
  type OnboardingV4Step,
} from './onboardingV4Route';

test('every OnboardingV4Step maps to exactly one activation phase', () => {
  const validPhases = new Set(['questions', 'first_scan', 'recipe_revealed', 'paywall', 'entitled', 'complete']);
  for (const step of ONBOARDING_V4_STEPS) {
    const phase = getOnboardingV4ActivationPhase(step);
    assert.ok(validPhases.has(phase), `${step} produced an unrecognized phase: ${phase}`);
  }
});

test('the canonical flow contains exactly the 16 steps from the plan, in order, including personalInsight', () => {
  const expected: OnboardingV4Step[] = [
    'splash', 'promise', 'primaryGoal', 'branchQ1', 'branchQ2', 'macroDetails',
    'personalInsight', 'dietarySafety', 'plan', 'scanEntry', 'photoConfirm', 'analyzing',
    'recipe', 'paywall', 'postPurchase', 'complete',
  ];
  assert.deepEqual([...ONBOARDING_V4_STEPS], expected);
});

test('the recipe reveal precedes the paywall (decisions #2/#4/#5: recipe is the activation moment, paywall opens only after a user-initiated premium action)', () => {
  const recipeIndex = ONBOARDING_V4_STEPS.indexOf('recipe');
  const paywallIndex = ONBOARDING_V4_STEPS.indexOf('paywall');
  assert.ok(recipeIndex >= 0 && paywallIndex >= 0, 'both recipe and paywall must be present in the canonical flow');
  assert.ok(recipeIndex < paywallIndex, 'recipe must be reached before paywall');
});

test('pre-scan questions steps map to the questions phase', () => {
  for (const step of ['splash', 'promise', 'primaryGoal', 'branchQ1', 'branchQ2', 'macroDetails', 'personalInsight', 'dietarySafety', 'plan'] as OnboardingV4Step[]) {
    assert.equal(getOnboardingV4ActivationPhase(step), 'questions');
  }
});

test('the free-scan steps map to first_scan, not entitled (decision #1: scan happens before paywall)', () => {
  for (const step of ['scanEntry', 'photoConfirm', 'analyzing'] as OnboardingV4Step[]) {
    assert.equal(getOnboardingV4ActivationPhase(step), 'first_scan');
  }
});

test('recipe maps to recipe_revealed, paywall maps to paywall, postPurchase maps to entitled, complete maps to complete', () => {
  assert.equal(getOnboardingV4ActivationPhase('recipe'), 'recipe_revealed');
  assert.equal(getOnboardingV4ActivationPhase('paywall'), 'paywall');
  assert.equal(getOnboardingV4ActivationPhase('postPurchase'), 'entitled');
  assert.equal(getOnboardingV4ActivationPhase('complete'), 'complete');
});

// Step 03: shouldUseOnboardingV4 is the Step 03 gate. Deterministic V4
// activation in tests means passing assignment: 'v4' directly here — no
// global flag flip, no AsyncStorage involved.
test('V3 is the default: the flag off always resolves to V3 regardless of assignment', () => {
  assert.equal(shouldUseOnboardingV4({ enabled: false, assignment: 'v4' }), false);
  assert.equal(shouldUseOnboardingV4({ enabled: false, assignment: 'v3' }), false);
  assert.equal(shouldUseOnboardingV4({ enabled: false, assignment: null }), false);
});

test('V4 activates deterministically only when the flag is on AND assignment is v4', () => {
  assert.equal(shouldUseOnboardingV4({ enabled: true, assignment: 'v4' }), true);
  assert.equal(shouldUseOnboardingV4({ enabled: true, assignment: 'v3' }), false);
  assert.equal(shouldUseOnboardingV4({ enabled: true, assignment: null }), false, 'assignment still loading must default to V3, not V4');
});
