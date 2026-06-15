import type { Recipe } from '../mocks';

export function getRecipeImageUrl(recipe: Recipe | null | undefined, fallbackUri?: string | null) {
  const recipeWithImage = recipe as (Recipe & {
    image?: { uri?: unknown; url?: unknown };
    imageUri?: unknown;
    imageUrl?: unknown;
  }) | null | undefined;

  return getFirstString([
    recipeWithImage?.imageUrl,
    recipeWithImage?.imageUri,
    recipeWithImage?.image?.url,
    recipeWithImage?.image?.uri,
    fallbackUri,
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
