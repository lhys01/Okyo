import { Image } from 'react-native';

import { foodAssets } from '../../assets/food';

export type SampleFoodImageKey = keyof typeof foodAssets;

export const sampleFoodImageUrls: Record<SampleFoodImageKey, string> = {
  bowl: getAssetUri(foodAssets.bowl),
  breakfast: getAssetUri(foodAssets.breakfast),
  burger: getAssetUri(foodAssets.burger),
  dessert: getAssetUri(foodAssets.dessert),
  pasta: getAssetUri(foodAssets.pasta),
  salad: getAssetUri(foodAssets.salad),
};

export function getSampleFoodImageUrl(key: SampleFoodImageKey) {
  return sampleFoodImageUrls[key];
}

function getAssetUri(asset: number) {
  return Image.resolveAssetSource(asset).uri;
}
