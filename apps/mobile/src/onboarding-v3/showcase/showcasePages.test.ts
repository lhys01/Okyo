import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { showcasePages } from './showcasePages';

test('showcase descriptors are frozen and follow the approved routing-only order', () => {
  assert.equal(Object.isFrozen(showcasePages), true);
  assert.equal(showcasePages.length, 7);
  assert.deepEqual(showcasePages.map((page) => page.id), [
    'hero', 'scan', 'value', 'customize', 'customizeDetails', 'attribution', 'meetKiko',
  ]);
  assert.deepEqual(showcasePages.map((page) => page.primaryAsset), [
    'approvedHeroArtwork', 'approvedOnboarding3', 'valuePastaBowl', 'approvedOnboarding5',
    'approvedMoreThanRecipeArtwork', 'onboarding6KikoMark', 'meetKikoHeroUpdated',
  ]);
  assert.deepEqual(showcasePages[0].prefetchAssets, ['approvedHeroArtwork']);
  assert.deepEqual(showcasePages.slice(1, 4).map(({ approvedSource, kikoCount }) => ({ approvedSource, kikoCount })), [
    { approvedSource: 'onboarding3.png', kikoCount: 1 },
    { approvedSource: 'onboarding4.png', kikoCount: 1 },
    { approvedSource: 'onboarding5.png', kikoCount: 1 },
  ]);
  assert.deepEqual(showcasePages.map((page) => page.approvedSource), [
    'reach-your-food-goals.png', 'onboarding3.png', undefined, 'onboarding5.png',
    undefined, 'onboarding6.png', 'onboarding10.png',
  ]);
  assert.equal(showcasePages.some((page) => page.approvedSource === 'onboarding7.png'), false);
  assert.equal(showcasePages.some((page) => page.approvedSource === 'onboarding9.png'), false);
});

test('the final customization-details page renders the approved crop with native surrounding controls', async () => {
  const source = readFileSync(resolve(process.cwd(), 'src/onboarding-v3/showcase/pages/CustomizeDetailsPage.tsx'), 'utf8');
  assert.match(source, /approvedMoreThanRecipeArtwork/);
  assert.match(source, /contentFit="contain"/);
  assert.match(source, /More than just a recipe/);
  assert.match(source, /OnboardingCTA/);
  assert.doesNotMatch(source, /pan-seared-salmon|kiko-pointing/);
  assert.doesNotMatch(source, /ScrollView|withRepeat|setInterval|setTimeout/);
});
