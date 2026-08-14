import type { ImageSourcePropType } from 'react-native';

import { getKikoAsset } from './kikoAssets';

// Active mascot poses use the exact approved flat artwork. Keep this map
// explicit because React Native requires statically analyzable asset paths.
export const onboardingKikoTransparentAssets = {
  default: require('../../assets/kiko-static/approved/kiko-soup.png'),
  wave: require('../../assets/kiko-static/approved/kiko-flex.png'),
  happy: require('../../assets/kiko-static/approved/kiko-soup.png'),
  thinking: require('../../assets/kiko-static/approved/kiko-thinking.png'),
  cooking: require('../../assets/kiko-static/approved/kiko-ramen.png'),
  scanning: require('../../assets/kiko-static/approved/kiko-soup.png'),
  celebrating: require('../../assets/kiko-static/approved/kiko-savings.png'),
  success: require('../../assets/kiko-static/approved/kiko-savings.png'),
  pointing: require('../../assets/kiko-static/approved/kiko-vegetables.png'),
  groceryList: require('../../assets/kiko-static/approved/kiko-grocery-list.png'),
  recipe: require('../../assets/kiko-static/approved/kiko-recipe.png'),
  recipeCard: require('../../assets/kiko-static/approved/kiko-recipe.png'),
  waveAlt: require('../../assets/kiko-static/approved/kiko-shopping-cart.png'),
  sideProfile: require('../../assets/kiko-static/approved/kiko-grocery-tote.png'),
} satisfies Record<string, ImageSourcePropType>;

export type OnboardingTransparentKikoPose = keyof typeof onboardingKikoTransparentAssets;

export function getTransparentKikoAsset(pose?: string): ImageSourcePropType {
  if (pose && Object.prototype.hasOwnProperty.call(onboardingKikoTransparentAssets, pose)) {
    return onboardingKikoTransparentAssets[pose as OnboardingTransparentKikoPose];
  }

  // Non-onboarding callers retain the existing approved static behavior.
  return getKikoAsset(pose);
}
