import type { Recipe } from '../mocks';

type ScanImageLike = { uri?: string; placeholder?: boolean } | null | undefined;

// Snapshots the user's real scan photo onto a recipe at save time so the saved
// library card can show the actual meal. Rules:
//  - Keep an existing imageUri (e.g. re-saving an already-saved recipe) so a
//    stale store image never clobbers the correct one.
//  - Only attach a real uploaded/camera photo — never a demo/placeholder image.
//  - If no real image is available, leave imageUri unset so the card uses the
//    clean Okyo fallback instead of a fake/broken image.
// TODO: prefer a safe generated bird's-eye dish image here once that pipeline exists.
export function attachRealScanImage(recipe: Recipe, image: ScanImageLike): Recipe {
  if (recipe.imageUri) {
    return recipe;
  }

  const uri = typeof image?.uri === 'string' && image.uri.trim().length > 0 && !image.placeholder
    ? image.uri
    : undefined;

  return uri ? { ...recipe, imageUri: uri } : recipe;
}
