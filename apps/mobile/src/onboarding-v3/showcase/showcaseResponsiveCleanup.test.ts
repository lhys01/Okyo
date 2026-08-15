import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { showcasePages } from './showcasePages';

const pagesDir = resolve(process.cwd(), 'src/onboarding-v3/showcase/pages');
const readPage = (name: string) => readFileSync(resolve(pagesDir, name), 'utf8');

const mappings = [
  { page: 1, component: 'ScanPage.tsx', source: 'onboarding3.png', asset: 'approvedOnboarding3' },
  { page: 3, component: 'CustomizePage.tsx', source: 'onboarding5.png', asset: 'approvedOnboarding5' },
] as const;

test('legacy screenshot pages retain their approved source mappings', () => {
  for (const mapping of mappings) {
    const descriptor = showcasePages[mapping.page];
    assert.equal(descriptor.approvedSource, mapping.source);
    assert.equal(descriptor.primaryAsset, mapping.asset);
    assert.equal(descriptor.kikoCount, 1);
    assert.match(readPage(mapping.component), new RegExp(`artwork=\\{onboardingV3Assets\\.${mapping.asset}\\}`));
  }
});

test('the value page replaces the duplicate baked More than just a recipe screen', () => {
  assert.equal(showcasePages[2].id, 'value');
  assert.equal(showcasePages[2].primaryAsset, 'valuePastaBowl');
  assert.match(readPage('ValuePage.tsx'), /showcaseContent\.value\.title/);
  assert.doesNotMatch(readPage('ValuePage.tsx'), /More than just a recipe/);
});

test('the approved crop is a new asset outside the restored onboarding directory', () => {
  const assets = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/assets/onboardingV3Assets.ts'), 'utf8');
  assert.match(assets, /approvedMoreThanRecipeArtwork/);
  assert.equal(showcasePages.at(-1)?.primaryAsset, 'approvedMoreThanRecipeArtwork');
});

test('pages 1–3 cannot substitute one another’s approved artwork', () => {
  for (const mapping of mappings) {
    const source = readPage(mapping.component);
    for (const other of mappings.filter((candidate) => candidate.asset !== mapping.asset)) {
      assert.doesNotMatch(source, new RegExp(other.asset));
    }
  }
});

test('the shared full-artwork page preserves aspect ratio and real Back/Next controls', () => {
  const source = readPage('ApprovedArtworkPage.tsx');
  assert.match(source, /contentFit="cover"/);
  assert.match(source, /Math\.max\(windowWidth \/ ARTWORK\.width, windowHeight \/ ARTWORK\.height\) \* V3_ARTWORK_SCALE/);
  assert.match(source, /top: Math\.max\(0, \(windowHeight - ARTWORK\.height \* scale\) \/ 2\)/);
  assert.match(source, /ARTWORK = \{ height: 1608, width: 852 \}/);
  assert.match(source, /hidden=\{false\}/);
  assert.match(source, /accessibilityLabel="Go back"[\s\S]{0,180}onPress=\{onBack\}/);
  assert.match(source, /accessibilityLabel="Next"[\s\S]{0,120}onPress=\{onNext\}/);
});

test('screen-only derivatives keep the supplied artwork dimensions', () => {
  for (const file of ['onboarding3-screen.png', 'onboarding4-screen.png', 'onboarding5-screen.png']) {
    const bytes = readFileSync(resolve(process.cwd(), 'assets/onboarding ex', file));
    assert.equal(bytes.readUInt32BE(16), 852, file);
    assert.equal(bytes.readUInt32BE(20), 1608, file);
  }
  const assets = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/assets/onboardingV3Assets.ts'), 'utf8');
  for (const file of ['onboarding3-screen.png', 'onboarding4-screen.png', 'onboarding5-screen.png']) {
    assert.match(assets, new RegExp(file.replace('.', '\\.')));
  }
});

test('approved source PNG checksums remain byte-identical', () => {
  const expected = {
    'onboarding3.png': '713761ca3b80524db0fc6854cc4bd0ad01db2215f163cee1f43cadbc544886bc',
    'onboarding4.png': '168ab3a5858c7c9c4e49bc72d31290cdfb439dcc7cc4cd2718a5b3a61da72e88',
    'onboarding5.png': 'eb9fb9257587077e64c2629e42a221bb64e61c9d29f405e38e7b82a5853d7928',
  } as const;
  for (const [file, checksum] of Object.entries(expected)) {
    const bytes = readFileSync(resolve(process.cwd(), 'assets/onboarding ex', file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), checksum);
  }
});
