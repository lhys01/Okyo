import type { Recipe } from '../mocks';

type ScanImageLike = { uri?: string; placeholder?: boolean } | null | undefined;

// Snapshots the user's real scan photo onto a recipe at save time so saved
// surfaces can show the actual meal. Rules:
//  - Real uploaded/camera photos always win over generated or bundled artwork.
//  - Only attach a real uploaded/camera photo — never a demo/placeholder image.
//  - If no real image is available, leave image fields unset so cards use the
//    clean Okyo fallback instead of a fake/broken image.
export function attachRealScanImage(recipe: Recipe, image: ScanImageLike): Recipe {
  const uri = typeof image?.uri === 'string' && image.uri.trim().length > 0 && !image.placeholder
    ? image.uri
    : undefined;

  return uri ? { ...recipe, imageStatus: 'ready', imageUri: uri, imageUrl: uri } : recipe;
}
