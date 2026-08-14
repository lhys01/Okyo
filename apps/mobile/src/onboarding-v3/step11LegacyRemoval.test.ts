import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

test('removed Step 11 screens and routes have no production importer', () => {
  assert.equal(existsSync(join(root, 'screens/NameFoxScreen.tsx')), false);
  assert.equal(existsSync(join(root, 'showcase/ShowcasePager.tsx')), false);
  const host = readFileSync(join(root, 'OnboardingV3.tsx'), 'utf8');
  const machine = readFileSync(join(root, 'controller/onboardingV3Machine.ts'), 'utf8');
  const screen = readFileSync(join(root, 'screens/PersonalizedOnboardingScreen.tsx'), 'utf8');
  assert.doesNotMatch(host, /NameFoxScreen|ShowcasePager|case 'showcase'|case 'nameFox'/);
  assert.doesNotMatch(machine, /case 'showcase'|case 'nameFox'|case 'branchIntro'|case 'secondaryGoals'|case 'personalizedFuture'/);
  assert.doesNotMatch(screen, /SecondaryGoalsStep|personalizedFuture|BranchIntro/);
});

test('Step 11 activates V4 while retaining the reversible master switch', () => {
  const flags = readFileSync(join(root, '../config/devFlags.ts'), 'utf8');
  const host = readFileSync(join(root, 'OnboardingV3.tsx'), 'utf8');
  assert.match(flags, /ONBOARDING_V4_ENABLED = true/);
  assert.match(host, /if \(!ONBOARDING_V4_ENABLED\)/);
  assert.match(host, /<LegacyOnboardingV3/);
  assert.match(host, /<OnboardingV4/);
});
