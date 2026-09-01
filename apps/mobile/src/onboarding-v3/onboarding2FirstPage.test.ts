import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), 'src/onboarding-v3', relativePath), 'utf8');

test('splash transitions into the restored pager whose first page uses the approved hero artwork', () => {
  const machine = read('controller/onboardingV3Machine.ts');
  const pager = read('showcase/ShowcasePager.tsx');
  const descriptors = read('showcase/showcasePages.ts');
  assert.match(machine, /case 'splash':[\s\S]{0,350}event\.type === 'SPLASH_FINISHED'[\s\S]{0,350}'showcase'/);
  assert.match(pager, /<PagerView/);
  assert.match(pager, /<HeroPage \{\.\.\.pageProps\(0\)\}/);
  assert.match(pager, /<ScanPage \{\.\.\.pageProps\(1\)\}/);
  assert.match(pager, /<RecipeOutputPage \{\.\.\.pageProps\(2\)\}/);
  assert.match(pager, /<CustomizePage \{\.\.\.pageProps\(3\)\}/);
  assert.match(pager, /<AttributionPage[\s\S]*\{\.\.\.pageProps\(4\)\}/);
  assert.match(pager, /<MeetKikoPage \{\.\.\.pageProps\(5\)\}/);
  assert.doesNotMatch(pager, /SavingsPage|ValuePage/);
  assert.match(descriptors, /id: 'hero', primaryAsset: 'approvedHeroArtwork'/);
});

test('hero page renders the supplied approved artwork as one uncropped image', () => {
  const hero = read('showcase/pages/HeroPage.tsx');
  assert.match(hero, /approvedHeroArtwork/);
  assert.match(hero, /contentFit="contain"/);
  assert.match(hero, /Math\.min\(windowWidth \/ ARTWORK\.width, windowHeight \/ ARTWORK\.height\)/);
  assert.doesNotMatch(hero, /HeartSolid|ScanQrCode|PageEdit|<Text/);
});

test('Get started is a real accessible Pressable that advances to onboarding3', () => {
  const hero = read('showcase/pages/HeroPage.tsx');
  assert.match(hero, /accessibilityLabel="Get started"[\s\S]{0,100}accessibilityRole="button"[\s\S]{0,100}onPress=\{props\.onNext\}/);
});

test('account and legal art have isolated non-crashing Pressable overlays without invented URLs', () => {
  const hero = read('showcase/pages/HeroPage.tsx');
  for (const label of ['I already have an account', 'Terms of Use', 'Privacy Notice']) {
    assert.match(hero, new RegExp(`accessibilityLabel="${label}"`));
  }
  assert.match(hero, /Alert\.alert/);
  assert.doesNotMatch(hero, /https?:\/\//);
});

test('the restored approved components hand off from onboarding11 to user Name without duplicate pages', () => {
  const host = read('OnboardingV3.tsx');
  const machine = read('controller/onboardingV3Machine.ts');
  const pager = read('showcase/ShowcasePager.tsx');
  const personalized = read('screens/PersonalizedOnboardingScreen.tsx');
  const approvedComponents = [
    'ScanPage', 'RecipeOutputPage', 'CustomizePage', 'AttributionPage',
    'MeetKikoPage',
  ];

  for (const component of approvedComponents) {
    assert.match(pager, new RegExp(`<${component}`), component);
  }
  assert.match(host, /case 'nameFox':[\s\S]{0,180}<NameFoxScreen/);
  assert.match(machine, /case 'showcase':[\s\S]{0,180}step: 'nameFox'/);
  assert.match(machine, /case 'nameFox':[\s\S]{0,220}step: 'name'/);
  assert.match(machine, /case 'name':[\s\S]{0,220}step: 'primaryGoal'/);
  assert.match(personalized, /What should we call you\?/);
  assert.equal((pager.match(/<AttributionPage/g) ?? []).length, 1);
  assert.doesNotMatch(pager, /SavingsPage|ValuePage|PersonalizedOnboardingScreen|KikoOnboardingArtwork/);
});
