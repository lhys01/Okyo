import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('signature copy and CTA remain scrollable and wrap at accessibility text sizes', () => {
  const signature = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/screens/BranchSignatureCommitmentScreen.tsx'), 'utf8');
  const cta = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/components/OnboardingCTA.tsx'), 'utf8');

  assert.match(signature, /<ScrollView contentContainerStyle=\{styles\.scrollContent\}[^>]*><View style=\{\[styles\.page/);
  assert.match(signature, /scrollContent: \{ flexGrow: 1 \}/);
  assert.match(signature, /title: \{[^}]*alignSelf: 'stretch'/);
  assert.match(signature, /body: \{[^}]*alignSelf: 'stretch'/);
  assert.match(cta, /label: \{[^}]*flexShrink: 1[^}]*maxWidth: '100%'/);
  assert.match(signature, /onPanResponderTerminationRequest: \(\) => false/);
  assert.match(signature, /pointerEvents=\{ready \? 'auto' : 'none'\}/);
  assert.doesNotMatch(signature, /<Rect fill=\{colors\.surface\}/);
  assert.match(signature, /<Path d=\{path\}[\s\S]*Draw your signature here/);
});
