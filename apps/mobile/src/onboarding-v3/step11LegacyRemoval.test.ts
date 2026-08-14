import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * V4's onboarding rebuild (Step 11) briefly deleted these legacy V3 screens
 * and routes. V4's shortened sequence and visual design were rejected after
 * release-candidate QA, so the pre-V4 V3 onboarding was restored byte-for-byte
 * from git history (see devFlags.ts's ONBOARDING_V4_ENABLED) and is
 * production-visible again. This file used to prove the removal; it now
 * proves the restoration, and that V4's own code was left fully intact.
 */
test('restored Step 11 screens and routes are present and reachable in the legacy V3 path', () => {
  assert.equal(existsSync(join(root, 'screens/NameFoxScreen.tsx')), true);
  assert.equal(existsSync(join(root, 'showcase/ShowcasePager.tsx')), true);
  const host = readFileSync(join(root, 'OnboardingV3.tsx'), 'utf8');
  const machine = readFileSync(join(root, 'controller/onboardingV3Machine.ts'), 'utf8');
  const screen = readFileSync(join(root, 'screens/PersonalizedOnboardingScreen.tsx'), 'utf8');
  assert.match(host, /NameFoxScreen/);
  assert.match(host, /ShowcasePager/);
  assert.match(host, /case 'showcase':/);
  assert.match(host, /case 'nameFox':/);
  assert.match(machine, /case 'showcase':/);
  assert.match(machine, /case 'nameFox':/);
  assert.match(machine, /case 'branchIntro':/);
  assert.match(machine, /case 'secondaryGoals':/);
  assert.match(machine, /case 'personalizedFuture':/);
  assert.match(screen, /SecondaryGoalsStep/);
  assert.match(screen, /personalizedFuture/);
  assert.match(screen, /BranchIntro/);
});

test('V4 is rejected: master switch is off and legacy V3 renders unconditionally at that gate', () => {
  const flags = readFileSync(join(root, '../config/devFlags.ts'), 'utf8');
  const host = readFileSync(join(root, 'OnboardingV3.tsx'), 'utf8');
  assert.match(flags, /ONBOARDING_V4_ENABLED = false/);
  assert.match(host, /if \(!ONBOARDING_V4_ENABLED\) return;/);
  assert.match(host, /<LegacyOnboardingV3/);
});

test('V4 code is fully preserved for a future redesign, not deleted alongside the rollback', () => {
  assert.equal(existsSync(join(root, 'screens-v4/OnboardingV4.tsx')), true);
  assert.equal(existsSync(join(root, 'state/onboardingV4Reducer.ts')), true);
  assert.equal(existsSync(join(root, 'state/onboardingV4Route.ts')), true);
  const host = readFileSync(join(root, 'OnboardingV3.tsx'), 'utf8');
  assert.match(host, /<OnboardingV4/);
  assert.match(host, /import \{ OnboardingV4 \} from '\.\/screens-v4\/OnboardingV4'/);
});
