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
