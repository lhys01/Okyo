/**
 * Only pass image URIs to React Native that its image loader can actually
 * resolve. Invalid values should select a bundled food fallback immediately,
 * rather than leaving a card in an indefinite loading state.
 */
export function normalizeRecipeImageUri(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const uri = value.trim();
  if (!uri) return null;

  // These schemes cover bundled asset URIs as well as camera/library and CDN
  // images used by existing recipe records. Bare strings such as "undefined"
  // or malformed URLs are never handed to <Image>.
  return /^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|assets-library:\/\/)/i.test(uri)
    ? uri
    : null;
}

type RecipeImageRecord = {
  origin?: unknown;
  imageUri?: unknown;
  originalImage?: { placeholder?: unknown; uri?: unknown } | null;
  image?: { uri?: unknown } | null;
};

/** The exact image owned by a persisted recipe, never a title/category asset. */
export function getStoredRecipeImageUri(recipe: unknown): string | null {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return null;
  const record = recipe as RecipeImageRecord;
  // Description recipes have no source photo. Old scan state can leave an
  // image stamped on the recipe, but it must never be shown for this origin.
  if (record.origin === 'description') return null;
  const originalImageUri = record.originalImage?.placeholder === true
    ? undefined
    : record.originalImage?.uri;
  return normalizeRecipeImageUri(record.imageUri)
    ?? normalizeRecipeImageUri(originalImageUri)
    ?? normalizeRecipeImageUri(record.image?.uri);
}

export function isUserScanRecipe(recipe: unknown): boolean {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return false;
  const origin = (recipe as RecipeImageRecord).origin;
  return origin === 'scan' || origin === 'description';
}
