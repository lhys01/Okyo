import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { showcaseContent } from './showcaseContent';
import { showcasePages } from './showcasePages';
import { getShowcaseResponsiveLayout } from './showcaseResponsiveLayout';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

test('the reported Scan showcase slide fits above the pinned footer at iPhone SE compact height', () => {
  const layout = getShowcaseResponsiveLayout({ windowHeight: 667, topInset: 20, bottomInset: 0 });
  const pager = read('src/onboarding-v3/showcase/ShowcasePager.tsx');
  const frame = read('src/onboarding-v3/showcase/pages/ShowcasePageShell.tsx');

  assert.equal(showcaseContent.scan.title, 'Scan any dish. Get the recipe.');
  assert.ok(showcaseContent.scan.body.length > 0);
  assert.equal(layout.compact, true);
  assert.equal(layout.heroHeight, 250);
  assert.equal(layout.headlineSize, 27);

  const safeHeightAfterChrome = layout.usableHeight - (56 + 6 + 36) - (60 + 12);
  const twoLineTitleThreeLineBody = layout.framePaddingTop + layout.heroHeight + layout.artworkTextGap +
    layout.titleMarginTop + layout.headlineLineHeight * 2 + 8 + layout.bodyLineHeight * 3 + layout.contentBottomPadding;
  assert.ok(twoLineTitleThreeLineBody <= safeHeightAfterChrome);
  assert.match(pager, /<View style=\{styles\.content\}>\{pagerContent\}<\/View>[\s\S]*<Animated\.View[^>]*style=\{styles\.footer\}/);
  assert.match(frame, /<ScrollView/);
  assert.match(frame, /paddingBottom: layout\.contentBottomPadding/);
  assert.match(frame, /height: layout\.heroHeight/);
});

test('13 mini uses compact artwork so the Scan slide body clears Next while larger phones retain the baseline', () => {
  const mini = getShowcaseResponsiveLayout({ windowHeight: 812, topInset: 47, bottomInset: 34 });
  const standard = getShowcaseResponsiveLayout({ windowHeight: 844, topInset: 47, bottomInset: 34 });
  const baseline = getShowcaseResponsiveLayout({ windowHeight: 874, topInset: 62, bottomInset: 34 });
  assert.equal(mini.compact, true);
  assert.equal(mini.heroHeight, 250);
  assert.equal(standard.heroHeight, 430);
  assert.equal(baseline.heroHeight, 430);
  const scanCopyHeight = mini.framePaddingTop + mini.heroHeight + mini.artworkTextGap + mini.titleMarginTop +
    mini.headlineLineHeight * 2 + 8 + mini.bodyLineHeight * 3 + mini.contentBottomPadding;
  const spaceAboveFooter = mini.usableHeight - (56 + 6 + 36) - (60 + 12);
  assert.ok(scanCopyHeight <= spaceAboveFooter);
  assert.equal(getShowcaseResponsiveLayout({ windowHeight: 844, topInset: 47, bottomInset: 34, fontScale: 1.5 }).compact, true);
});

test('every showcase route has a bounded artwork or scrollable content path', () => {
  const sourceByPage: Record<string, string> = {
    hero: read('src/onboarding-v3/showcase/pages/HeroPage.tsx'),
    scan: read('src/onboarding-v3/showcase/pages/ScanPage.tsx'),
    value: read('src/onboarding-v3/showcase/pages/ValuePage.tsx'),
    customize: read('src/onboarding-v3/showcase/pages/CustomizePage.tsx'),
    customizeDetails: read('src/onboarding-v3/showcase/pages/CustomizeDetailsPage.tsx'),
    attribution: read('src/onboarding-v3/showcase/pages/AttributionPage.tsx'),
    meetKiko: read('src/onboarding-v3/showcase/pages/MeetKikoPage.tsx'),
  };
  const sharedFrame = read('src/onboarding-v3/showcase/pages/ShowcasePageShell.tsx');

  assert.deepEqual(showcasePages.map(({ id }) => id), Object.keys(sourceByPage));
  assert.match(sourceByPage.hero, /useWindowDimensions\(\)/);
  assert.match(sourceByPage.hero, /contentFit="contain"/);
  assert.match(sourceByPage.attribution, /<ScrollView/);
  for (const page of showcasePages.filter(({ id }) => id !== 'hero' && id !== 'attribution')) {
    const source = sourceByPage[page.id];
    assert.ok(/ShowcasePageFrame|ApprovedArtworkPage/.test(source), `${page.id} uses the shared responsive frame`);
  }
  assert.match(sharedFrame, /<ScrollView/);
  assert.match(sharedFrame, /maxFontSizeMultiplier=\{2\}/);
});

test('larger Dynamic Type can scroll instead of truncating showcase copy beneath the footer', () => {
  const frame = read('src/onboarding-v3/showcase/pages/ShowcasePageShell.tsx');
  const pager = read('src/onboarding-v3/showcase/ShowcasePager.tsx');

  assert.match(pager, /fontScale/);
  assert.match(frame, /<ScrollView[\s\S]*showsVerticalScrollIndicator=\{false\}/);
  assert.equal((frame.match(/maxFontSizeMultiplier=\{2\}/g) ?? []).length, 2);
});
