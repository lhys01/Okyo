import { Image, type ImageSourcePropType } from 'react-native';

import { getFoodLibraryImageAsset } from '../../assets/food';
import type { Recipe } from '../mocks';

/**
 * Static image source for built-in library recipes. This deliberately resolves
 * from the bundle at render time instead of from persisted recipe state.
 */
export function getRecipeImageSource(recipe: Recipe | null | undefined): ImageSourcePropType | undefined {
  const recipeWithIds = recipe as (Recipe & { id?: unknown; recipeId?: unknown; sourceRecipeId?: unknown }) | null | undefined;
  const ids = [recipeWithIds?.id, recipeWithIds?.recipeId, recipeWithIds?.sourceRecipeId];

  for (const id of ids) {
    const source = getFoodLibraryImageAsset(typeof id === 'string' ? id : undefined);
    if (source !== undefined) {
      return source;
    }
  }

  return undefined;
}

export function getRecipeImageUrl(recipe: Recipe | null | undefined, fallbackUri?: string | null) {
  const bundledSource = getRecipeImageSource(recipe);
  if (bundledSource) {
    return Image.resolveAssetSource(bundledSource).uri;
  }

  const recipeWithImage = recipe as (Recipe & {
    image?: { uri?: unknown; url?: unknown };
    imageUri?: unknown;
    imageUrl?: unknown;
  }) | null | undefined;

  return getFirstString([
    recipeWithImage?.imageUri,
    recipeWithImage?.image?.uri,
    fallbackUri,
    recipeWithImage?.imageUrl,
    recipeWithImage?.image?.url,
  ]);
}

export function getRecipeImageStatus(recipe: Recipe | null | undefined) {
  const status = (recipe as (Recipe & { imageStatus?: unknown }) | null | undefined)?.imageStatus;
  return typeof status === 'string' && status.trim().length > 0 ? status.trim() : undefined;
}

export function getRealScanImageUri(image: { placeholder?: boolean; uri?: string } | null | undefined) {
  return image?.placeholder ? null : getFirstString([image?.uri]);
}

function getFirstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
