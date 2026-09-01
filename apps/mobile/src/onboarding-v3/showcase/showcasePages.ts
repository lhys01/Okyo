import type { OnboardingV3AssetKey } from '../assets/onboardingV3Assets';

export type ShowcasePageId =
  | 'hero'
  | 'scan'
  | 'value'
  | 'customize'
  | 'customizeDetails'
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
  { id: 'scan', primaryAsset: 'onboarding3CarouselArtwork', prefetchAssets: ['onboarding3CarouselArtwork'], approvedSource: 'onboarding3.png', kikoCount: 1 },
  { id: 'value', primaryAsset: 'approvedSalmonRecipeValueArtwork', prefetchAssets: ['approvedSalmonRecipeValueArtwork'], approvedSource: 'onboarding2.png', kikoCount: 1 },
  { id: 'customize', primaryAsset: 'onboarding5CarouselArtwork', prefetchAssets: ['onboarding5CarouselArtwork'], approvedSource: 'onboarding5.png', kikoCount: 1 },
  { id: 'customizeDetails', primaryAsset: 'onboarding4CarouselArtwork', prefetchAssets: ['onboarding4CarouselArtwork'] },
  { id: 'attribution', primaryAsset: 'onboarding6KikoMark', prefetchAssets: ['onboarding6KikoMark'], approvedSource: 'onboarding6.png', kikoCount: 1 },
  { id: 'meetKiko', primaryAsset: 'welcomeArtwork', prefetchAssets: ['welcomeArtwork'], approvedSource: 'onboarding10.png', kikoCount: 1 },
]);
