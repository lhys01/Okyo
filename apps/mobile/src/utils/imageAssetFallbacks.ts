import type { OkyoImageSource } from './imageSource';

/**
 * Image fallbacks are separated by visual role. A recipe photo is a useful
 * fallback for another recipe photo, but never for Kiko, an icon, or artwork.
 */
export const assetKinds = [
  'food',
  'mascot',
  'icon',
  'onboarding',
  'emptyState',
  'tour',
  'appIcon',
  'decorative',
] as const;

export type AssetKind = (typeof assetKinds)[number];

export const assetFallbacks: Readonly<Record<AssetKind, OkyoImageSource>> = Object.freeze({
  food: require('../../assets/food/recipes/garlic-chicken-rice-bowl.png'),
  mascot: require('../../assets/kiko-static/approved/kiko-neutral-transparent-sticker.png'),
  icon: require('../../assets/onboarding-v3/iconsnew/onboarding-icon-sparkle.png'),
  onboarding: require('../../assets/onboarding-v3/welcome.png'),
  emptyState: require('../../assets/kiko-static/approved/kiko-shopping-cart-sticker.png'),
  tour: require('../../assets/onboarding-v3/stickers/fox-sleeping.png'),
  appIcon: require('../../assets/app-icon/icon.png'),
  decorative: require('../../assets/onboarding-v3/sticker-sparkle.png'),
});

export function getAssetFallback(kind: AssetKind): OkyoImageSource {
  return assetFallbacks[kind];
}

export function isFoodAssetKind(kind: AssetKind): boolean {
  return kind === 'food';
}

export function isFoodFallbackSource(source: OkyoImageSource | null | undefined): boolean {
  return source === assetFallbacks.food;
}
