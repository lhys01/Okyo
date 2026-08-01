import type { ImageSourcePropType } from 'react-native';

// The filenames in kiko-static are generated asset IDs. Keep this mapping in
// one place so pose names remain stable even when the artwork is replaced.
const currentKiko = {
  default: require('../../assets/kiko-static/e608cbae-daaf-4c93-a030-eaf19caa4c02.png'),
  wave: require('../../assets/kiko-static/ec041431-c9cf-47fa-be98-d878c23d299a.png'),
  happy: require('../../assets/kiko-static/7a66978e-3804-40e0-98d8-49fa14892b32.png'),
  thinking: require('../../assets/kiko-static/7030013a-09f8-469e-9e0c-42b20f478a21.png'),
  cooking: require('../../assets/kiko-static/40b4aa9b-1feb-4b6b-b4dc-c1af7c11b9ee.png'),
  celebrating: require('../../assets/kiko-static/2a6be0ee-fc9c-4764-a9a6-4b986e7abe58.png'),
  success: require('../../assets/kiko-static/c279b3db-0645-4378-b1a7-91e9628f1079.png'),
  pointing: require('../../assets/kiko-static/2b5bb906-8664-4d1b-9b9c-68e273daba67.png'),
  scanning: require('../../assets/kiko-static/384183e9-8ebb-4d77-9c80-afae5aed6102.png'),
  groceryList: require('../../assets/kiko-static/bb5aa691-ce28-43ae-a353-8bc73f3ca365.png'),
  recipe: require('../../assets/kiko-static/89cb6dd1-744e-46b9-a6b7-40d7cd33be60.png'),
  recipeCard: require('../../assets/kiko-static/7d2db6d2-1953-40da-be95-888df7479345.png'),
  waveAlt: require('../../assets/kiko-static/7b015d63-792c-484b-9308-f99f406e60e4.png'),
  sideProfile: require('../../assets/kiko-static/958e38df-ef26-4e68-8651-0821a144a0ed.png'),
} satisfies Record<string, ImageSourcePropType>;

export const kikoAssets = currentKiko;

export type KikoAssetPose = keyof typeof kikoAssets;

export function getKikoAsset(pose?: string): ImageSourcePropType {
  if (pose && Object.prototype.hasOwnProperty.call(kikoAssets, pose)) {
    return kikoAssets[pose as KikoAssetPose];
  }

  return kikoAssets.default;
}
