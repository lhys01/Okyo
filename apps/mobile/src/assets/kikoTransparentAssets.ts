import type { ImageSourcePropType } from 'react-native';

import { getKikoAsset } from './kikoAssets';

// Transparent derivatives of the exact approved kiko-static originals. Keep
// this list intentionally limited to poses used by active onboarding so a new
// onboarding pose cannot silently fall back to unrelated mascot artwork.
export const onboardingKikoTransparentAssets = {
  default: require('../../assets/kiko-static/transparent-generated/kiko-default.png'),
  wave: require('../../assets/kiko-static/transparent-generated/kiko-wave.png'),
  happy: require('../../assets/kiko-static/transparent-generated/kiko-happy.png'),
  thinking: require('../../assets/kiko-static/transparent-generated/kiko-thinking.png'),
  cooking: require('../../assets/kiko-static/transparent-generated/kiko-cooking.png'),
  scanning: require('../../assets/kiko-static/transparent-generated/kiko-scanning.png'),
  celebrating: require('../../assets/kiko-static/transparent-generated/kiko-celebrating.png'),
  success: require('../../assets/kiko-static/transparent-generated/kiko-success.png'),
  pointing: require('../../assets/kiko-static/transparent-generated/kiko-pointing.png'),
  groceryList: require('../../assets/kiko-static/transparent-generated/kiko-groceryList.png'),
  recipe: require('../../assets/kiko-static/transparent-generated/kiko-recipe.png'),
  recipeCard: require('../../assets/kiko-static/transparent-generated/kiko-recipeCard.png'),
  waveAlt: require('../../assets/kiko-static/transparent-generated/kiko-waveAlt.png'),
  sideProfile: require('../../assets/kiko-static/transparent-generated/kiko-sideProfile.png'),
} satisfies Record<string, ImageSourcePropType>;

export type OnboardingTransparentKikoPose = keyof typeof onboardingKikoTransparentAssets;

export function getTransparentKikoAsset(pose?: string): ImageSourcePropType {
  if (pose && Object.prototype.hasOwnProperty.call(onboardingKikoTransparentAssets, pose)) {
    return onboardingKikoTransparentAssets[pose as OnboardingTransparentKikoPose];
  }

  // Non-onboarding callers retain the existing approved static behavior.
  return getKikoAsset(pose);
}
