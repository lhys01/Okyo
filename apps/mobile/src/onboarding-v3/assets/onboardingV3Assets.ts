import { Image as ExpoImage } from 'expo-image';
import { Image as ReactNativeImage } from 'react-native';

export const onboardingV3Assets: Readonly<Record<string, number>> = Object.freeze({
  approvedHeroArtwork: require('../../../assets/onboarding-approved/reach-your-food-goals.png'),
  // Derived screen-only exports. The supplied source PNGs remain untouched;
  // these assets remove the embedded device frame before rendering in-app.
  approvedOnboarding3: require('../../../assets/onboarding ex/onboarding3-screen.png'),
  approvedOnboarding4: require('../../../assets/onboarding ex/onboarding4-screen.png'),
  approvedOnboarding5: require('../../../assets/onboarding ex/onboarding5-screen.png'),
  approvedOnboarding1: require('../../../assets/onboarding ex/onboarding1.png'),
  approvedOnboarding2: require('../../../assets/onboarding ex/onboarding2.png'),
  onboarding3Composition: require('../../../assets/onboarding-ex-transparent/o3-approved-composition.png'),
  onboarding4Composition: require('../../../assets/onboarding-ex-transparent/o4-approved-composition.png'),
  onboarding5Composition: require('../../../assets/onboarding-ex-transparent/o5-approved-composition.png'),
  onboarding6KikoMark: require('../../../assets/onboarding-ex-transparent/o6-kiko-mark.png'),
  approachScanCard: require('../../../assets/onboarding-ex-transparent/o8-card-scan.png'),
  approachMacrosCard: require('../../../assets/onboarding-ex-transparent/o8-card-macros.png'),
  approachCustomizeCard: require('../../../assets/onboarding-ex-transparent/o8-card-customize.png'),
  meetKikoHero: require('../../../assets/onboarding-ex-transparent/o10-kiko-hero.png'),
  meetKikoHeroUpdated: require('../../../assets/onboarding-ex-transparent/o10-kiko-updated.png'),
  doodleCarrot: require('../../../assets/onboarding-ex-transparent/o10-doodle-carrot.png'),
  doodleMushroom: require('../../../assets/onboarding-ex-transparent/o10-doodle-mushroom.png'),
  doodleHerb: require('../../../assets/onboarding-ex-transparent/o10-doodle-herb.png'),
  doodleFishbone: require('../../../assets/onboarding-ex-transparent/o10-doodle-fishbone.png'),
  doodleAppleCore: require('../../../assets/onboarding-ex-transparent/o10-doodle-applecore.png'),
  doodleSparkle: require('../../../assets/onboarding-ex-transparent/o10-doodle-sparkle.png'),
  doodleSquiggle: require('../../../assets/onboarding-ex-transparent/o10-doodle-squiggle.png'),
  nameFoxKikoPeek: require('../../../assets/onboarding-ex-transparent/o11-kiko-peek.png'),
  nameFoxKikoPeekUpdated: require('../../../assets/onboarding-ex-transparent/o11-kiko-updated.png'),
  approvedMoreThanRecipeArtwork: require('../../../assets/onboarding-v3/more-than-just-a-recipe-artwork.png'),
});

export type OnboardingV3AssetKey = keyof typeof onboardingV3Assets;

export async function prefetchOnboardingV3Assets(keys: readonly OnboardingV3AssetKey[]): Promise<void> {
  const urls = keys
    .map((key) => onboardingV3Assets[key])
    .filter((source): source is number => typeof source === 'number')
    .map((source) => ReactNativeImage.resolveAssetSource(source).uri);
  await ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
}
