import { Image, type ImageSourcePropType } from 'react-native';

import { getFoodLibraryFallbackAsset, getFoodLibraryImageAsset } from '../../assets/food';
import type { Recipe } from '../mocks';
import { getStoredRecipeImageUri, isUserScanRecipe, normalizeRecipeImageUri } from './recipeImageSource';

/**
 * Static image source for built-in library recipes. This deliberately resolves
 * from the bundle at render time instead of from persisted recipe state.
 */
export function getRecipeImageSource(recipe: Recipe | null | undefined): ImageSourcePropType | undefined {
  const storedImageUri = getStoredRecipeImageUri(recipe);
  if (storedImageUri) return { uri: storedImageUri };
  if (isUserScanRecipe(recipe)) return undefined;

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
  const storedImageUri = getStoredRecipeImageUri(recipe);
  if (storedImageUri) return storedImageUri;
  if (isUserScanRecipe(recipe)) return null;

  const bundledSource = getRecipeImageSource(recipe);
  if (bundledSource) {
    return Image.resolveAssetSource(bundledSource).uri;
  }

  const recipeWithImage = recipe as (Recipe & {
    image?: { uri?: unknown; url?: unknown };
    imageUri?: unknown;
    imageUrl?: unknown;
  }) | null | undefined;

  return normalizeRecipeImageUri(getFirstString([
    recipeWithImage?.imageUri,
    recipeWithImage?.image?.uri,
    fallbackUri,
    recipeWithImage?.imageUrl,
    recipeWithImage?.image?.url,
  ]));
}

/**
 * A bundled fallback used by every recipe-card surface. Dedicated library art
 * always wins; otherwise choose stable approved food photography by category.
 */
export function getRecipeImageFallbackSource(recipe: Recipe | null | undefined): ImageSourcePropType {
  const recipeWithCategory = recipe as (Recipe & { category?: unknown }) | null | undefined;
  const category = typeof recipeWithCategory?.category === 'string'
    ? recipeWithCategory.category
    : null;

  return getRecipeImageSource(recipe) ?? getFoodLibraryFallbackAsset(
    category,
    typeof recipe?.title === 'string' ? recipe.title : null,
  );
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
