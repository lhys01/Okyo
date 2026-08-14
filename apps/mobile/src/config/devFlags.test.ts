import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const flags = readFileSync(resolve(process.cwd(), 'src/config/devFlags.ts'), 'utf8');
const paywall = readFileSync(
  resolve(process.cwd(), 'src/onboarding-v3/screens/OnboardingPaywallScreen.tsx'),
  'utf8',
);

test('the paywall bypass is clearly labelled as temporary and development-only', () => {
  assert.match(flags, /TEMPORARY DEVELOPMENT PAYWALL BYPASS/);
  assert.match(flags, /HOW TO TURN IT OFF/);
});

test('the bypass can never be active in a production build', () => {
  // Gated on __DEV__ so a release build ignores the constant entirely.
  assert.match(flags, /__DEV__/);
  assert.match(flags, /export const DEV_BYPASS_PAYWALL\s*=[\s\S]*__DEV__/);
});

test('the bypass is a single flag, not scattered true conditions', () => {
  // Count executable references only — comments naming the flag do not count.
  const code = paywall
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const usages = code.match(/\bDEV_BYPASS_PAYWALL\b/g) ?? [];
  assert.equal(usages.length, 2, `expected import + one guard, found ${usages.length}`);
  assert.match(paywall, /import \{ DEV_BYPASS_PAYWALL \} from '\.\.\/\.\.\/config\/devFlags'/);
});

test('the bypass finishes onboarding directly instead of the real-purchase handoff', () => {
  // Regression: the bypass previously called onAlreadyEntitled(), which routes
  // through 'postPurchase' and shows "Okyo Pro unlocked" during development.
  assert.match(paywall, /if \(DEV_BYPASS_PAYWALL[\s\S]{0,120}\bonDevSkipToHome\(\)/);
  assert.doesNotMatch(
    paywall.split('\n').find((line) => line.includes('if (DEV_BYPASS_PAYWALL')) ?? '',
    /onAlreadyEntitled/,
  );
});

test('no other file hardcodes an entitlement bypass', () => {
  // The whole point of the flag is that nothing else fakes being entitled.
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        // Skip analytics/telemetry lines — reporting isEntitled: true after a
        // real purchase is correct, it is not a bypass.
        const lines = readFileSync(full, 'utf8')
          .split('\n')
          .filter((line) => !/log\(|Log\(|track\(/.test(line));
        if (lines.some((line) => /isEntitled\s*[:=]\s*true/.test(line))) offenders.push(full);
      }
    }
  };
  walk(resolve(process.cwd(), 'src'));
  assert.deepEqual(offenders, [], `hardcoded entitlement found in: ${offenders.join(', ')}`);
});

test('RevenueCat and the paywall architecture are left intact', () => {
  assert.match(paywall, /useEntitlement/);
  assert.match(paywall, /entitlement\.isEntitled/);
  assert.match(paywall, /onPurchase/);
  assert.match(paywall, /onRestore/);
});

test('ONBOARDING_V4_ENABLED master switch defaults to false — V4 rejected, legacy V3 is production-visible again', () => {
  assert.match(flags, /export const ONBOARDING_V4_ENABLED\s*=\s*false;/);
});

test('ONBOARDING_V4_ENABLED is referenced only by devFlags.ts and its one sanctioned gate insertion point (OnboardingV3.tsx, Step 03)', () => {
  // Step 02 required this flag be unreferenced by any live screen; Step 03 is
  // the plan's designated first reader — `OnboardingV3.tsx`'s top-of-function
  // gate (`if (ONBOARDING_V4_ENABLED) return <OnboardingV4 .../>`-equivalent).
  // A route/type module documenting the future gate in a comment is not a
  // reference — only code outside comments that actually imports or reads the
  // flag counts, and only that one file may do so.
  const sanctioned = resolve(process.cwd(), 'src/onboarding-v3/OnboardingV3.tsx');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && full !== resolve(process.cwd(), 'src/config/devFlags.ts') && full !== sanctioned && !entry.name.includes('.test.')) {
        const code = readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        if (code.includes('ONBOARDING_V4_ENABLED')) offenders.push(full);
      }
    }
  };
  walk(resolve(process.cwd(), 'src'));
  assert.deepEqual(offenders, [], `ONBOARDING_V4_ENABLED referenced outside devFlags.ts/OnboardingV3.tsx in: ${offenders.join(', ')}`);

  const onboardingV3Source = readFileSync(sanctioned, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(onboardingV3Source.includes('ONBOARDING_V4_ENABLED'), 'OnboardingV3.tsx should be the one screen reading ONBOARDING_V4_ENABLED');
});
