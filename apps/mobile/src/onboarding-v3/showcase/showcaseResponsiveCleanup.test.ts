import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { showcasePages } from './showcasePages';

const pagesDir = resolve(process.cwd(), 'src/onboarding-v3/showcase/pages');
const readPage = (name: string) => readFileSync(resolve(pagesDir, name), 'utf8');

const mappings = [
  { page: 1, component: 'ScanPage.tsx', source: 'onboarding3.png', asset: 'onboarding3CarouselArtwork' },
  { page: 3, component: 'CustomizePage.tsx', source: 'onboarding5.png', asset: 'onboarding5CarouselArtwork' },
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
  assert.equal(showcasePages[2].primaryAsset, 'approvedSalmonRecipeValueArtwork');
  assert.match(readPage('ValuePage.tsx'), /showcaseContent\.value\.title/);
  assert.doesNotMatch(readPage('ValuePage.tsx'), /More than just a recipe/);
});

test('the approved crop is a new asset outside the restored onboarding directory', () => {
  const assets = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/assets/onboardingV3Assets.ts'), 'utf8');
  assert.match(assets, /onboarding4CarouselArtwork/);
  assert.equal(showcasePages[4]?.primaryAsset, 'onboarding4CarouselArtwork');
  assert.equal(showcasePages.filter((page) => page.primaryAsset === 'onboarding4CarouselArtwork').length, 1);
});

test('pages 1–3 cannot substitute one another’s approved artwork', () => {
  for (const mapping of mappings) {
    const source = readPage(mapping.component);
    for (const other of mappings.filter((candidate) => candidate.asset !== mapping.asset)) {
      assert.doesNotMatch(source, new RegExp(other.asset));
    }
  }
});

test('the shared artwork page uses the native shell and real Back/Next controls', () => {
  const source = readPage('ApprovedArtworkPage.tsx');
  assert.match(source, /ShowcasePageShell/);
  assert.match(source, /ShowcasePageFrame/);
  assert.match(source, /page/);
});

test('all routed pages use seven native indicators and no autoplay timers', () => {
  const pager = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/showcase/ShowcasePager.tsx'), 'utf8');
  const shell = readPage('ShowcasePageShell.tsx');
  assert.match(pager, /showcasePages\.map\(\(page, index\)/);
  assert.match(pager, /<OnboardingBackButton/);
  assert.match(pager, /<OnboardingCTA label="Next"/);
  assert.doesNotMatch(shell, /OnboardingBackButton|OnboardingCTA|Array\.from/);
  assert.doesNotMatch(pager + shell, /setInterval|setTimeout|withRepeat/);
});

test('ShowcasePager owns one fixed header and enlarged shared artwork region', () => {
  const pager = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/showcase/ShowcasePager.tsx'), 'utf8');
  const shell = readPage('ShowcasePageShell.tsx');
  assert.equal((pager.match(/<OnboardingBackButton/g) ?? []).length, 1);
  assert.equal((pager.match(/<OnboardingCTA/g) ?? []).length, 1);
  assert.match(pager, /<SafeAreaView edges=\{carouselChromeVisible \? \['top', 'bottom'\] : \[\]\}/);
  assert.match(pager, /<PagerView/);
  assert.match(shell, /height: 430/);
  assert.match(shell, /maxWidth: 392/);
  assert.match(shell, /contentFit="contain"/);
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

test('approved carousel crops have exact panel dimensions and native pages do not rebuild them', () => {
  const expected = {
    'onboarding3-carousel-artwork.png': [636, 744],
    'onboarding4-carousel-artwork.png': [682, 845],
    'onboarding5-carousel-artwork.png': [615, 844],
  } as const;
  for (const [file, [width, height]] of Object.entries(expected)) {
    const bytes = readFileSync(resolve(process.cwd(), 'assets/onboarding-v3', file));
    assert.equal(bytes.readUInt32BE(16), width, file);
    assert.equal(bytes.readUInt32BE(20), height, file);
  }
  for (const [page, asset] of [['ScanPage.tsx', 'onboarding3CarouselArtwork'], ['CustomizeDetailsPage.tsx', 'onboarding4CarouselArtwork'], ['CustomizePage.tsx', 'onboarding5CarouselArtwork']] as const) {
    const source = readPage(page);
    assert.match(source, new RegExp(`onboardingV3Assets\\.${asset}`));
    assert.doesNotMatch(source, /<Image[\s\S]*<Image/);
  }
});

test('the value page uses the approved salmon-and-fox artwork crop', () => {
  const bytes = readFileSync(resolve(process.cwd(), 'assets/onboarding-v3/approved-salmon-recipe-value-artwork.png'));
  assert.equal(bytes.readUInt32BE(16), 772);
  assert.equal(bytes.readUInt32BE(20), 1043);
  assert.equal(showcasePages[2]?.approvedSource, 'onboarding2.png');
  assert.match(readPage('ValuePage.tsx'), /approvedSalmonRecipeValueArtwork/);
  assert.doesNotMatch(readPage('ValuePage.tsx'), /onboarding2GranolaCarouselArtwork|halo|borderRadius|valuePastaBowl/);
});
