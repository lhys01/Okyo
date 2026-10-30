import type { ImageSourcePropType } from 'react-native';

// Keep pose names stable while using the current approved flat Kiko artwork.
// The artwork is bundled and intentionally mapped in one place so every
// screen gets the same visual language without changing layout or behavior.
const currentKiko = {
  default: require('../../assets/kiko-static/approved/kiko-soup-sticker.png'),
  wave: require('../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  happy: require('../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  thinking: require('../../assets/kiko-static/approved/kiko-thinking-sticker.png'),
  cooking: require('../../assets/kiko-static/approved/kiko-ramen-sticker.png'),
  celebrating: require('../../assets/kiko-static/approved/kiko-savings-sticker.png'),
  success: require('../../assets/kiko-static/approved/kiko-savings-sticker.png'),
  pointing: require('../../assets/kiko-static/approved/kiko-vegetables-sticker.png'),
  scanning: require('../../assets/kiko-transparent/kiko-curious-sticker.png'),
  groceryList: require('../../assets/kiko-static/approved/kiko-grocery-list-sticker.png'),
  recipe: require('../../assets/kiko-static/approved/kiko-recipe-sticker.png'),
  recipeCard: require('../../assets/kiko-static/approved/kiko-recipe-sticker.png'),
  waveAlt: require('../../assets/kiko-static/approved/kiko-shopping-cart-sticker.png'),
  sideProfile: require('../../assets/kiko-static/approved/kiko-grocery-tote-sticker.png'),
} satisfies Record<string, ImageSourcePropType>;

export const kikoAssets = currentKiko;

export type KikoAssetPose = keyof typeof kikoAssets;

export function getKikoAsset(pose?: string): ImageSourcePropType {
  if (pose && Object.prototype.hasOwnProperty.call(kikoAssets, pose)) {
    return kikoAssets[pose as KikoAssetPose];
  }

  return kikoAssets.default;
}
