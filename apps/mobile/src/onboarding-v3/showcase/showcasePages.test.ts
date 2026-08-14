import assert from 'node:assert/strict';
import test from 'node:test';

import { showcasePages } from './showcasePages';

test('showcase descriptors are frozen and follow the approved routing-only order', () => {
  assert.equal(Object.isFrozen(showcasePages), true);
  assert.equal(showcasePages.length, 6);
  assert.deepEqual(showcasePages.map((page) => page.id), [
    'hero', 'scan', 'recipeOutput', 'customize', 'attribution', 'meetKiko',
  ]);
  assert.deepEqual(showcasePages.map((page) => page.primaryAsset), [
    'approvedHeroArtwork', 'approvedOnboarding3', 'approvedOnboarding4', 'approvedOnboarding5',
    'onboarding6KikoMark', 'meetKikoHeroUpdated',
  ]);
  assert.deepEqual(showcasePages[0].prefetchAssets, ['approvedHeroArtwork']);
  assert.deepEqual(showcasePages.slice(1, 5).map(({ approvedSource, kikoCount }) => ({ approvedSource, kikoCount })), [
    { approvedSource: 'onboarding3.png', kikoCount: 1 },
    { approvedSource: 'onboarding4.png', kikoCount: 1 },
    { approvedSource: 'onboarding5.png', kikoCount: 1 },
    { approvedSource: 'onboarding6.png', kikoCount: 1 },
  ]);
  assert.deepEqual(showcasePages.map((page) => page.approvedSource), [
    'reach-your-food-goals.png', 'onboarding3.png', 'onboarding4.png', 'onboarding5.png',
    'onboarding6.png', 'onboarding10.png',
  ]);
  assert.equal(showcasePages.some((page) => page.approvedSource === 'onboarding7.png'), false);
  assert.equal(showcasePages.some((page) => page.approvedSource === 'onboarding9.png'), false);
});
