import { File } from 'expo-file-system';

export type ImageStorageLocation = 'documents' | 'cache' | 'remote' | 'none' | 'unknown';

export type ImageValidationResult = {
  valid: boolean;
  imageUri: string | null;
  fileExists: boolean | 'n/a' | 'error';
  storageLocation: ImageStorageLocation;
  usingFallback: boolean;
  fallbackReason: string | null;
  warnings: string[];
};

export async function checkImageFileExists(uri: string | null | undefined): Promise<boolean> {
  if (!uri) return false;
  if (!uri.startsWith('file://') && !uri.startsWith('/var/') && !uri.startsWith('/private/')) {
    return false;
  }
  try {
    const info = new File(uri).info();
    return info.exists;
  } catch {
    return false;
  }
}

export function getStorageLocation(uri: string | null | undefined): ImageStorageLocation {
  if (!uri) return 'none';
  if (uri.includes('/Documents/') || uri.includes('/documents/')) return 'documents';
  if (uri.includes('/Caches/') || uri.includes('/caches/')) return 'cache';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return 'remote';
  if (uri.startsWith('file://') || uri.startsWith('/var/') || uri.startsWith('/private/')) return 'unknown';
  return 'none';
}

// Returns a structured validation result for a recipe's image.
// Use in __DEV__ to detect image ownership failures before they reach users.
export async function validateRecipeImage(
  recipe: { id?: string; imageUri?: unknown; imageUrl?: unknown } | null | undefined,
  selectedScanImage: { uri?: string; placeholder?: boolean; source?: string } | null | undefined,
): Promise<ImageValidationResult> {
  const warnings: string[] = [];

  const recipeImageUri = typeof recipe?.imageUri === 'string' && recipe.imageUri.trim().length > 0
    ? recipe.imageUri.trim()
    : null;
  const fallbackUri = !selectedScanImage?.placeholder && selectedScanImage?.uri
    ? selectedScanImage.uri
    : null;
  const imageUri = recipeImageUri ?? fallbackUri;
  const usingFallback = !recipeImageUri;

  let fileExists: boolean | 'n/a' | 'error' = 'n/a';
  if (imageUri) {
    const location = getStorageLocation(imageUri);
    if (location === 'documents' || location === 'cache' || location === 'unknown') {
      fileExists = await checkImageFileExists(imageUri);
      if (!fileExists) {
        warnings.push(`file_missing: ${imageUri}`);
      }
    } else if (location === 'remote') {
      fileExists = 'n/a';
    }
  }

  const storageLocation = getStorageLocation(imageUri);
  if (storageLocation === 'cache') {
    warnings.push('image_in_cache_not_documents: may not survive cold restart');
  }

  if (usingFallback) {
    if (!selectedScanImage) {
      warnings.push('no_scan_image_available: recipe.imageUri unset and no selectedScanImage');
    } else if (selectedScanImage.placeholder) {
      warnings.push('scan_image_is_placeholder: recipe.imageUri unset, scan image is placeholder');
    } else {
      warnings.push('recipe_imageUri_unset: using selectedScanImage as fallback');
    }
  }

  let fallbackReason: string | null = null;
  if (usingFallback) {
    if (!selectedScanImage) fallbackReason = 'no_scan_image_available';
    else if (selectedScanImage.placeholder) fallbackReason = 'scan_image_is_placeholder';
    else if (!selectedScanImage.uri) fallbackReason = 'scan_image_has_no_uri';
    else fallbackReason = 'recipe_imageUri_not_stamped';
  }

  const valid = Boolean(imageUri) && (fileExists === true || fileExists === 'n/a') && warnings.length === 0;

  return {
    valid,
    imageUri,
    fileExists,
    storageLocation,
    usingFallback,
    fallbackReason,
    warnings,
  };
}
