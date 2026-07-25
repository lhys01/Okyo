import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

// Source-inspection guard (same pattern as onboardingScanGuards.test.ts and
// scanScreenNavigationGuard.test.ts) proving OnboardingScanLoadingScreen —
// the onboarding-flow scan loading screen rendered from WelcomeScreen — uses
// the same monotonic, session-scoped progress system as
// AnalysisLoadingScreen (via nextScanProgress/scanProgress.ts) instead of the
// old standalone one-shot 12000ms Animated.timing that ran independently of
// real scan status, and that it freezes the scan image URI per session the
// same way AnalysisLoadingScreen does. These screens pull in React Native
// modules that can't execute under the plain Node test runtime used here, so
// this is a text-level proof rather than a render test.

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readOnboardingUiSource() {
  return readFileSync(path.join(srcDir, 'components', 'onboarding', 'OnboardingUI.tsx'), 'utf8');
}

function readWelcomeScreenSource() {
  return readFileSync(path.join(srcDir, 'screens', 'WelcomeScreen.tsx'), 'utf8');
}

test('OnboardingUI imports the shared monotonic scan-progress helpers', () => {
  const source = readOnboardingUiSource();
  assert.match(source, /import\s*\{[^}]*nextScanProgress[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/scanProgress['"]/);
  assert.match(source, /INITIAL_SCAN_PROGRESS_STATE/);
});

test('OnboardingScanLoadingScreen calls nextScanProgress with a session-scoped ref, not a standalone one-shot timing', () => {
  const source = readOnboardingUiSource();
  const componentStart = source.indexOf('function OnboardingScanLoadingScreen');
  assert.ok(componentStart >= 0, 'OnboardingScanLoadingScreen not found');
  const componentSource = source.slice(componentStart, componentStart + 7000);

  assert.match(componentSource, /scanProgressStateRef/);
  assert.match(componentSource, /nextScanProgress\(/);
  // The old implementation animated straight to a hardcoded 0.9 target over a
  // fixed 12000ms duration on every mount, decoupled from scan status. That
  // literal call shape must be gone.
  assert.equal(/toValue:\s*0\.9/.test(componentSource), false);
});

test('OnboardingScanLoadingScreen freezes the scan image URI per session, mirroring AnalysisLoadingScreen', () => {
  const source = readOnboardingUiSource();
  const componentStart = source.indexOf('function OnboardingScanLoadingScreen');
  const componentSource = source.slice(componentStart, componentStart + 7000);

  assert.match(componentSource, /frozenScanImageRef/);
  assert.match(componentSource, /stableUserImageUri/);
  // The rendered <Image> must read the frozen value, not the raw prop.
  assert.match(componentSource, /source=\{\{\s*uri:\s*stableUserImageUri\s*\}\}/);
});

test('OnboardingScanLoadingScreen keeps the scan-line Animated.Value fully separate from the progress Animated.Value', () => {
  const source = readOnboardingUiSource();
  const componentStart = source.indexOf('function OnboardingScanLoadingScreen');
  const componentSource = source.slice(componentStart, componentStart + 7000);

  assert.match(componentSource, /const scanLine = useRef\(new Animated\.Value\(0\)\)\.current;/);
  assert.match(componentSource, /const progressAnim = useRef\(new Animated\.Value\(0\)\)\.current;/);
});

test('OnboardingScanLoadingScreen supports Reduce Motion for the progress animation', () => {
  const source = readOnboardingUiSource();
  const componentStart = source.indexOf('function OnboardingScanLoadingScreen');
  const componentSource = source.slice(componentStart, componentStart + 7000);

  assert.match(componentSource, /reduceMotion/);
  assert.match(componentSource, /progressAnim\.setValue\(nextState\.value\)/);
});

test('the rotating LOADING_STEPS headline renders inside a fixed-height wrapper so text changes cannot reflow the image', () => {
  const source = readOnboardingUiSource();
  assert.match(source, /loadingHeadlineWrap/);
  assert.match(source, /loadingHeadlineWrap:\s*\{[^}]*height:\s*68/s);
});

test('WelcomeScreen threads real scan-session state into OnboardingLoadingScreen instead of only the step-position progress prop', () => {
  const source = readWelcomeScreenSource();
  const callStart = source.indexOf('<OnboardingLoadingScreen');
  assert.ok(callStart >= 0, 'OnboardingLoadingScreen usage not found in WelcomeScreen');
  const callSource = source.slice(callStart, callStart + 400);

  assert.match(callSource, /scanSessionId=\{activeScanSessionId\}/);
  assert.match(callSource, /scanStatus=\{activeScanStatus\}/);
  assert.match(callSource, /hasValidatedRecipe=/);
});
