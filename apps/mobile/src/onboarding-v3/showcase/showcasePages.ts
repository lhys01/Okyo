import type { OnboardingV3AssetKey } from '../assets/onboardingV3Assets';

export type ShowcasePageId =
  | 'hero'
  | 'scan'
  | 'recipeOutput'
  | 'customize'
  | 'attribution'
  | 'meetKiko';

export type ShowcasePageDescriptor = {
  id: ShowcasePageId;
  primaryAsset: OnboardingV3AssetKey;
  prefetchAssets: readonly OnboardingV3AssetKey[];
  approvedSource?: `onboarding${number}.png` | 'reach-your-food-goals.png';
  kikoCount?: number;
};

export const showcasePages: readonly ShowcasePageDescriptor[] = Object.freeze([
  { id: 'hero', primaryAsset: 'approvedHeroArtwork', prefetchAssets: ['approvedHeroArtwork'], approvedSource: 'reach-your-food-goals.png', kikoCount: 1 },
  { id: 'scan', primaryAsset: 'approvedOnboarding3', prefetchAssets: ['approvedOnboarding3'], approvedSource: 'onboarding3.png', kikoCount: 1 },
  { id: 'recipeOutput', primaryAsset: 'approvedOnboarding4', prefetchAssets: ['approvedOnboarding4'], approvedSource: 'onboarding4.png', kikoCount: 1 },
  { id: 'customize', primaryAsset: 'approvedOnboarding5', prefetchAssets: ['approvedOnboarding5'], approvedSource: 'onboarding5.png', kikoCount: 1 },
  { id: 'attribution', primaryAsset: 'onboarding6KikoMark', prefetchAssets: ['onboarding6KikoMark'], approvedSource: 'onboarding6.png', kikoCount: 1 },
  { id: 'meetKiko', primaryAsset: 'meetKikoHeroUpdated', prefetchAssets: ['meetKikoHeroUpdated'], approvedSource: 'onboarding10.png', kikoCount: 1 },
]);
