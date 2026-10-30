import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('each asset role has a distinct, bundled fallback', () => {
  const fallbackRegistry = read('src/utils/imageAssetFallbacks.ts');
  const expectedKinds = ['food', 'mascot', 'icon', 'onboarding', 'emptyState', 'tour', 'appIcon', 'decorative'];
  const entries = [...fallbackRegistry.matchAll(/^\s*(\w+): require\(['\"]([^'\"]+)['\"]\)/gm)];

  assert.deepEqual(entries.map((entry) => entry[1]), expectedKinds);
  assert.equal(new Set(entries.map((entry) => entry[2])).size, expectedKinds.length);
  for (const [, kind, path] of entries) {
    assert.equal(existsSync(resolve(process.cwd(), 'src/utils', path)), true, `${kind} fallback must be bundled`);
    if (kind !== 'food') assert.doesNotMatch(path, /assets\/food\//);
  }
});

test('shared resolver chooses a fallback by category and has no universal rice fallback', () => {
  const source = read('src/components/ResilientImage.tsx');

  assert.match(source, /assetKind = 'decorative'/);
  assert.match(source, /getAssetFallback\(assetKind\)/);
  assert.doesNotMatch(source, /foodAssets/);
  assert.match(source, /isFoodFallbackSource/);
});

test('food, mascot, and onboarding-icon surfaces declare their image categories explicitly', () => {
  assert.match(read('src/components/FoodImage.tsx'), /assetKind="food"/);
  assert.match(read('src/components/KikoMascot.tsx'), /assetKind="mascot"/);
  assert.match(read('src/onboarding-v3/components/KikoOnboardingArtwork.tsx'), /assetKind="mascot"/);
  assert.match(read('src/onboarding-v3/assets/onboardingStickerIcons.tsx'), /assetKind="icon"/);
});
