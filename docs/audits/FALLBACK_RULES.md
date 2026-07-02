# Fallback Rules

Branch: `feature/scan-image-persistence-hardening`

## Rule: Fallback only fires when no uploaded image exists

A Spark-icon or empty-state fallback must only render when:
1. The user used a demo scan (`source === 'mock'`, `placeholder === true`), OR
2. The user's image URI is absent from both `recipe.imageUri` and `selectedScanImage`

Fallback must NOT render when:
- The uploaded image exists and its URI is a valid non-empty string
- The uploaded image path resolves to an existing file on disk
- The image is recoverable from `selectedScanImage` as a session fallback

## Verification by Screen

### ResultSummaryScreen

```typescript
const selectedScanImageUri = getRealScanImageUri(selectedScanImage);
// getRealScanImageUri returns null if image.placeholder === true
// Returns null if image.uri is empty
// Otherwise returns image.uri

if (imageUri) {
  <Image source={{ uri: imageUri }} />   // ← real image shown
} else {
  <FoodImageCard isDemoScan={isDemoScan} />  // ← fallback
}
```

**Verdict**: Fallback only if `placeholder === true` OR `uri` is absent. VERIFIED ✓

### RecipeDetailScreen / RecipeStepsScreen

```typescript
const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
// Priority: recipe.imageUri → recipe.image?.uri → fallbackUri → recipe.imageUrl → recipe.image?.url
// Returns first non-empty string, or null

<FoodImage imageUrl={recipeImageUrl} />
// FoodImage renders Image if imageUrl is truthy; Spark icon fallback otherwise
```

**Verdict**: Fallback only if ALL five sources in `getRecipeImageUrl` are null/empty. VERIFIED ✓

### LibraryScreen

```typescript
<FoodImage imageUrl={getRecipeImageUrl(recipe)} />
// No fallback URI — relies on recipe.imageUri stamped at save time
```

**Verdict**: Fallback if `recipe.imageUri` is unset. Recipes saved without a real photo correctly show the Spark fallback. VERIFIED ✓

### ShareCardPreviewScreen

```typescript
imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
```

**Verified logic**:
- If `shareImage.placeholder === true` → skip → use `recipe.imageUri`
- If `shareImage.uri` is absent → skip → use `recipe.imageUri`
- If `shareImage` is null → `(!null?.placeholder && null?.uri)` → `false` → use `recipe.imageUri`

**Verdict**: Placeholder guard verified on all 5 `imageUri` assignments. VERIFIED ✓

### HomeScreen

```typescript
const heroImageUri = getRecipeImageUrl(
  heroRecipe,
  getRealScanImageUri(latestScanSession?.selectedScanImage) ?? getRealScanImageUri(selectedScanImage),
);
<FoodImage imageUrl={heroImageUri} />
```

**Verdict**: Fallback only if hero recipe has no image and no session image. VERIFIED ✓

## Placeholder Guard Invariant

`getRealScanImageUri()` (in `utils/recipeImages.ts`):
```typescript
export function getRealScanImageUri(image) {
  return image?.placeholder ? null : getFirstString([image?.uri]);
}
```

`attachRealScanImage()` (in `utils/savedRecipeImage.ts`):
```typescript
const uri = typeof image?.uri === 'string' && image.uri.trim().length > 0 && !image.placeholder
  ? image.uri
  : undefined;
return uri ? { ...recipe, imageStatus: 'ready', imageUri: uri, imageUrl: uri } : recipe;
```

**Both functions check `placeholder` before using the URI.** No placeholder URI can contaminate a real recipe.

## Silent Failure Detection

`imageValidation.ts:validateRecipeImage()` detects:
- `recipe.imageUri` unset when scan image is available → `fallbackReason: 'recipe_imageUri_not_stamped'`
- Image URI points to cache dir → `warning: 'image_in_cache_not_documents'`
- File does not exist at URI → `warning: 'file_missing'`

These are emitted in `__DEV__` via `imageTraceLog`. No silent success.
