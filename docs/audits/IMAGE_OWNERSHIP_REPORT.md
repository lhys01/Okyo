# Image Ownership Report

Branch: `feature/scan-image-persistence-hardening`

## Source Hierarchy

Priority order enforced by `getRecipeImageUrl(recipe, fallbackUri)`:

| Priority | Field | Set by | Guaranteed permanent? |
|----------|-------|--------|-----------------------|
| 1 | `recipe.imageUri` | `attachScanImageUri()` at session write; `attachRealScanImage()` at save | Yes — Documents dir after fix |
| 2 | `recipe.image?.uri` | API response parsing | No — may be placeholder |
| 3 | `fallbackUri` (getRealScanImageUri(selectedScanImage)) | Passed by each screen | No — session-scoped |
| 4 | `recipe.imageUrl` | Sample image injection for demo scans | May be remote or undefined |
| 5 | `recipe.image?.url` | API response | May be remote or undefined |

**The canonical source of truth is `recipe.imageUri`.**

## Exact Fields

| Field | Type | Location | Description |
|-------|------|----------|-------------|
| `recipe.imageUri` | `string` (untyped extension) | `latestScanRecipes[n]`, `savedRecipes[n]` | Canonical. Stamped at session write and at save. |
| `recipe.imageUrl` | `string` (untyped extension) | Same | Secondary. Used for stock photos in demo mode. |
| `selectedScanImage.uri` | `string \| undefined` | `state.selectedScanImage`, `latestScanSession.selectedScanImage` | Session-scoped preview URI. Read via `getRealScanImageUri()` only. |
| `selectedScanImage.placeholder` | `boolean \| undefined` | Same | If true, `getRealScanImageUri()` returns null — image is not real. |
| `latestScanSession.selectedScanImage` | `ScanImageMetadata \| null` | `state.latestScanSession` | Active scan session image. Preferred over flat `selectedScanImage`. |

## Exact Files

| File | Role |
|------|------|
| `utils/recipeImages.ts` | `getRecipeImageUrl()` priority chain, `getRealScanImageUri()` placeholder guard |
| `utils/savedRecipeImage.ts` | `attachRealScanImage()` — stamps `imageUri` on save |
| `utils/imageValidation.ts` | `checkImageFileExists()`, `getStorageLocation()`, `validateRecipeImage()` |
| `state/useOkyoStore.ts` | `createLatestScanSession()` stamps `imageUri` on all recipes; `writeSavedRecipeContext()` clears stale session |
| `screens/ScanScreen.tsx` | `copyToDocuments()` moves image to Documents before state write |

## Ownership Transitions

```
1. User picks photo (camera/photos)
   → expo-image-manipulator writes to NSCachesDirectory

2. copyToDocuments() in ScanScreen.tsx
   → copies to NSDocumentDirectory/okyo-scan-images/scan-{ts}.jpg
   → returns updated ScanImageMetadata with permanent URI

3. startScan() calls beginLatestScanSession() with previewImage
   → previewImage = getPreviewImageMetadata(image) = image without dataUrl
   → URI is permanent (Documents) ✓

4. API responds → writeLatestScanSession()
   → imageForStorage = (!image.placeholder && image.uri) ? image : result.image ?? image
   → selects user's real image over API-returned placeholder
   → createLatestScanSession() stamps imageUri on every recipe via attachScanImageUri()

5. User saves recipe → saveRecipe(attachRealScanImage(recipe, selectedScanImage))
   → attachRealScanImage() stamps imageUri = selectedScanImage.uri on recipe
   → savedRecipes[n].imageUri = permanent URI ✓

6. Library open → writeSavedRecipeContext()
   → clears latestScanSession = null (prevents stale contamination)
   → latestScanRecipes = [savedRecipe] — recipe carries imageUri from step 5

7. Cold restart → AsyncStorage rehydrates
   → recipe.imageUri survives (string in AsyncStorage)
   → file at Documents URI survives (NSDocumentDirectory never cleared)
```

## What Must Never Be Done

- `selectedScanImage?.uri` read directly without `getRealScanImageUri()` — placeholder check required
- `shareImage?.uri` without `!shareImage?.placeholder` guard — all five cases in ShareCardPreviewScreen verified
- `recipe.imageUrl` read before `recipe.imageUri` — `getRecipeImageUrl()` enforces order
