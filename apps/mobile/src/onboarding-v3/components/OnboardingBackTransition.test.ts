import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentsDir = resolve(process.cwd(), 'src/onboarding-v3/components');
const transitionSource = readFileSync(resolve(componentsDir, 'OnboardingScreenTransition.tsx'), 'utf8');
const ctaSource = readFileSync(resolve(componentsDir, 'OnboardingCTA.tsx'), 'utf8');
const backButtonSource = readFileSync(resolve(componentsDir, 'OnboardingBackButton.tsx'), 'utf8');
const hostSource = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/OnboardingV3.tsx'), 'utf8');

test('the shared onboarding host uses a rightward exit and leftward back entry', () => {
  assert.match(transitionSource, /SlideInLeft\.duration\(BACK_TRANSITION_MS\)/);
  assert.match(transitionSource, /SlideOutRight\.duration\(BACK_TRANSITION_MS\)/);
  assert.match(transitionSource, /const BACK_TRANSITION_MS = 300/);
  assert.match(transitionSource, /key=\{step\}/);
  assert.match(hostSource, /<OnboardingScreenTransition step=\{state\.step\}>/);
});

test('Reduce Motion switches the shared back transition to a minimal fade', () => {
  assert.match(transitionSource, /entering=\{reduceMotion\s*\n\s*\? FadeIn\.duration\(MINIMAL_FADE_MS\)/);
  assert.match(transitionSource, /exiting=\{reduceMotion\s*\n\s*\? FadeOut\.duration\(MINIMAL_FADE_MS\)/);
  assert.match(transitionSource, /const MINIMAL_FADE_MS = 100/);
});

test('the shared Back control guards rapid repeated taps without changing its hit target or semantics', () => {
  assert.match(backButtonSource, /const BACK_GUARD_MS = 340/);
  assert.match(backButtonSource, /if \(lockedRef\.current\) return/);
  assert.match(backButtonSource, /lockedRef\.current = true/);
  assert.match(backButtonSource, /setTimeout\(/);
  assert.match(backButtonSource, /accessibilityRole="button"/);
  assert.match(backButtonSource, /hitSlop=\{10\}/);
  assert.match(backButtonSource, /height: 48/);
  assert.match(backButtonSource, /width: 48/);
});

test('the shared Back control keeps the screen surface, warm border, and canonical soft elevation', () => {
  assert.match(backButtonSource, /backgroundColor: 'transparent'/);
  assert.match(backButtonSource, /borderColor: colors\.border/);
  assert.match(backButtonSource, /borderWidth: StyleSheet\.hairlineWidth/);
  assert.match(backButtonSource, /\.\.\.homeRecipeCardShadow/);
  assert.match(backButtonSource, /<NavArrowLeft/);
});

test('forward transitions slide left while all V3 branches stay behind the shared host', () => {
  assert.match(transitionSource, /SlideInRight\.duration\(FORWARD_TRANSITION_MS\)/);
  assert.match(transitionSource, /SlideOutLeft\.duration\(FORWARD_TRANSITION_MS\)/);
  assert.match(transitionSource, /const FORWARD_TRANSITION_MS = 300/);
  assert.match(transitionSource, /stepOrder = defaultStepOrder/);
  for (const branch of ['SaveMoneyBranchScreen', 'HealthBranchScreen', 'MacrosBranchScreen']) {
    assert.match(hostSource, new RegExp(branch));
  }
});

test('forward CTA ignores rapid duplicate presses during the transition handoff', () => {
  assert.match(ctaSource, /const FORWARD_GUARD_MS = 320/);
  assert.match(ctaSource, /if \(lockedRef\.current\) return/);
  assert.match(ctaSource, /lockedRef\.current = true/);
  assert.match(ctaSource, /onPress=\{handlePress\}/);
});
