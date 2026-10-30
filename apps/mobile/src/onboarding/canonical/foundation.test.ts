import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('the navigator has one canonical onboarding entry that delegates to restored V3', () => {
  const navigator = read('src/navigation/AppNavigator.tsx');
  const entry = read('src/onboarding/index.tsx');
  assert.match(navigator, /import \{ CanonicalOnboarding \} from '\.\.\/onboarding';/);
  assert.match(navigator, /<CanonicalOnboarding appStartedAt=\{appStartedAt\} fontsLoaded=\{fontsLoaded\} \/>/);
  assert.match(entry, /return <OnboardingV3 \{\.\.\.props\} \/>/);
});

test('canonical runtime keeps V4 and previews behind the existing compatibility gates', () => {
  const host = read('src/onboarding-v3/OnboardingV3.tsx');
  const registry = read('src/onboarding/canonical/branchRegistry.ts');
  assert.match(host, /resolveActiveOnboardingBranch/);
  assert.match(host, /canonicalOnboardingConfig\.v4Enabled/);
  assert.match(registry, /Macros preview condition intentionally remains broader/);
});
