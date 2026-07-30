import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

// Regression guard: the onboarding process chips and the onboarding paywall
// must never regain emoji characters (camera/clipboard/money-bag/heart-style,
// etc.) — those are replaced with iconoir icon components or plain text.
// Source-inspection sweep, same pattern as scanScreenNavigationGuard.test.ts,
// because these files pull in React Native modules that can't execute under
// the plain Node test runtime used here.

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pictographic emoji ranges, plus the specific heart symbol called out in the
// spec. Deliberately excludes plain typographic punctuation (e.g. the arrow
// "→" or bullet "•") which are not emoji.
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function readSource(relativePath: string) {
  return readFileSync(path.join(srcDir, relativePath), 'utf8');
}

test('onboarding shared UI (hero process chips + paywall) contains no emoji characters', () => {
  const source = readSource('components/onboarding/OnboardingUI.tsx');
  const matches = source.match(EMOJI_PATTERN) ?? [];
  assert.deepEqual(matches, []);
});

test('the onboarding hero screen uses icon components, not emoji, for its process chips', () => {
  const source = readSource('components/onboarding/OnboardingUI.tsx');
  assert.match(source, /function ProofPill\(\{ icon, label \}: \{ icon: ReactNode; label: string \}\)/);
  assert.equal(source.includes('proofEmoji'), false);
});

const additionalEmojiScanTargets = [
  'screens/WelcomeScreen.tsx',
  'screens/AnalysisLoadingScreen.tsx',
  'screens/ResultSummaryScreen.tsx',
  'utils/purchaseAvailability.ts',
];

for (const relativePath of additionalEmojiScanTargets) {
  test(`${relativePath} contains no emoji characters`, () => {
    const source = readSource(relativePath);
    const matches = source.match(EMOJI_PATTERN) ?? [];
    assert.deepEqual(matches, []);
  });
}

test('the onboarding scan-intro Kiko speech bubble uses plain text', () => {
  const source = readSource('screens/WelcomeScreen.tsx');
  assert.match(source, /Now show me what you're craving\./);
});
