import type { ImageSourcePropType } from 'react-native';

// Keep pose names stable while using the current approved flat Kiko artwork.
// The artwork is bundled and intentionally mapped in one place so every
// screen gets the same visual language without changing layout or behavior.
const currentKiko = {
  default: require('../../assets/kiko-static/approved/kiko-soup.png'),
  wave: require('../../assets/kiko-static/approved/kiko-flex.png'),
  happy: require('../../assets/kiko-static/approved/kiko-soup.png'),
  thinking: require('../../assets/kiko-static/approved/kiko-thinking.png'),
  cooking: require('../../assets/kiko-static/approved/kiko-ramen.png'),
  celebrating: require('../../assets/kiko-static/approved/kiko-savings.png'),
  success: require('../../assets/kiko-static/approved/kiko-savings.png'),
  pointing: require('../../assets/kiko-static/approved/kiko-vegetables.png'),
  scanning: require('../../assets/kiko-static/approved/kiko-soup.png'),
  groceryList: require('../../assets/kiko-static/approved/kiko-grocery-list.png'),
  recipe: require('../../assets/kiko-static/approved/kiko-recipe.png'),
  recipeCard: require('../../assets/kiko-static/approved/kiko-recipe.png'),
  waveAlt: require('../../assets/kiko-static/approved/kiko-shopping-cart.png'),
  sideProfile: require('../../assets/kiko-static/approved/kiko-grocery-tote.png'),
} satisfies Record<string, ImageSourcePropType>;

export const kikoAssets = currentKiko;

export type KikoAssetPose = keyof typeof kikoAssets;

export function getKikoAsset(pose?: string): ImageSourcePropType {
  if (pose && Object.prototype.hasOwnProperty.call(kikoAssets, pose)) {
    return kikoAssets[pose as KikoAssetPose];
  }

  return kikoAssets.default;
}
