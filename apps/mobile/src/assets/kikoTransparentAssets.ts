import type { ImageSourcePropType } from 'react-native';

import { getKikoAsset } from './kikoAssets';

// Active mascot poses use the exact approved flat artwork. Keep this map
// explicit because React Native requires statically analyzable asset paths.
export const onboardingKikoTransparentAssets = {
  default: require('../../assets/kiko-static/approved/kiko-soup-sticker.png'),
  wave: require('../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  happy: require('../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  thinking: require('../../assets/kiko-static/approved/kiko-thinking-sticker.png'),
  cooking: require('../../assets/kiko-static/approved/kiko-ramen-sticker.png'),
  scanning: require('../../assets/kiko-transparent/kiko-curious-sticker.png'),
  celebrating: require('../../assets/kiko-static/approved/kiko-savings-sticker.png'),
  success: require('../../assets/kiko-static/approved/kiko-savings-sticker.png'),
  pointing: require('../../assets/kiko-static/approved/kiko-vegetables-sticker.png'),
  groceryList: require('../../assets/kiko-static/approved/kiko-grocery-list-sticker.png'),
  recipe: require('../../assets/kiko-static/approved/kiko-recipe-sticker.png'),
  recipeCard: require('../../assets/kiko-static/approved/kiko-recipe-sticker.png'),
  waveAlt: require('../../assets/kiko-static/approved/kiko-shopping-cart-sticker.png'),
  sideProfile: require('../../assets/kiko-static/approved/kiko-grocery-tote-sticker.png'),
} satisfies Record<string, ImageSourcePropType>;

export type OnboardingTransparentKikoPose = keyof typeof onboardingKikoTransparentAssets;

export function getTransparentKikoAsset(pose?: string): ImageSourcePropType {
  if (pose && Object.prototype.hasOwnProperty.call(onboardingKikoTransparentAssets, pose)) {
    return onboardingKikoTransparentAssets[pose as OnboardingTransparentKikoPose];
  }

  // Non-onboarding callers retain the existing approved static behavior.
  return getKikoAsset(pose);
}
