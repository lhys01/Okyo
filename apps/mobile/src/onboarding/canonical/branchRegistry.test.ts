import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveActiveOnboardingBranch, resolveCanonicalPreviewBranch } from './branchRegistry';

test('a branch preview only mounts at branchIntro', () => {
  for (const goal of ['save_money', 'eat_healthier', 'hit_macros'] as const) {
    assert.equal(resolveCanonicalPreviewBranch('nameFox', goal), null);
    assert.equal(resolveCanonicalPreviewBranch('personalizationChoice', goal), null);
  }
});

test('every active goal uses the same branch entry in development and release', () => {
  for (const goal of ['save_money', 'eat_healthier', 'hit_macros'] as const) {
    assert.equal(resolveActiveOnboardingBranch('branchIntro', goal), goal);
    assert.equal(resolveActiveOnboardingBranch('branchPlan', goal), null);
    assert.equal(resolveActiveOnboardingBranch('branchSignature', goal), null);
  }
  assert.equal(resolveActiveOnboardingBranch('branchIntro', null), null);
});
