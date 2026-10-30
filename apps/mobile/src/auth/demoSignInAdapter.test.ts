import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const screen = readFileSync(join(__dirname, '../onboarding-v3/screens/BranchAccountScreen.tsx'), 'utf8');

test('unconfigured account onboarding skips directly into local app use, without demo sign-in controls', () => {
  assert.match(screen, /if \(!clerkAvailable\) onDone\(\)/);
  assert.match(screen, /SignInScreen/);
  assert.doesNotMatch(screen, /continueWithDemoSignIn|Continue with Apple|Continue with Google|Continue with Email/);
});
