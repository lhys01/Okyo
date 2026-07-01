# Image Ownership Map

## Canonical image flow

```
User takes photo (camera / library)
  → ImagePicker.launchCameraAsync / launchImageLibraryAsync
  → asset.uri  (OS cache copy of original)

ImageManipulator.manipulateAsync(asset.uri)
  → processed.uri  (compressed JPEG in OS cache)

getImageMetadata()
  → ScanImageMetadata { uri: processed.uri, placeholder: false, ... }

copyToDocuments()  ← NEW: permanent copy step
  → ScanImageMetadata { uri: documentDirectory/okyo-scan-images/scan-{ts}.jpg }

startScan(source, persistedImage)
  → getPreviewImageMetadata(image)  ← strips dataUrl, keeps uri
  → beginLatestScanSession({ selectedScanImage: previewImage })

createLatestScanSession()
  → attachScanImageUri(recipe, realScanImageUri)
  → recipe.imageUri = permanentUri
  → recipe.imageUrl = permanentUri

Zustand store
  → latestScanSession.selectedScanImage.uri = permanentUri
  → latestScanSession.latestScanRecipes[n].imageUri = permanentUri
  → state.selectedScanImage.uri = permanentUri
  → state.latestScanRecipes[n].imageUri = permanentUri

AsyncStorage persist
  → "okyo-local-state" key includes all above

User saves recipe
  → attachRealScanImage(recipe, selectedScanImage)
  → savedRecipe.imageUri = selectedScanImage.uri  (permanentUri)
  → state.savedRecipes[n].imageUri = permanentUri
```

## Image consumption per screen

| Screen | Reads from | Field path |
|--------|-----------|------------|
| ResultSummaryScreen | `latestScanSession.selectedScanImage` → `storedSelectedScanImage` | `selectedScanImageUri → FoodImageCard.imageUri` |
| RecipeDetailScreen | `state.latestScanRecipes` via `getStoredRecipeForMode` | `recipe.imageUri → getRecipeImageUrl() → FoodImage.imageUrl` |
| RecipeStepsScreen | Same as above | Same |
| Completion screen | Same recipe object | Same |
| LibraryScreen | `state.savedRecipes[n]` | `recipe.imageUri → getRecipeImageUrl() → FoodImage.imageUrl` |
| ShareCardPreviewScreen | `scanContext.image ?? state.selectedScanImage` | `.uri → PhotoBlock.imageUri` |

## Canonical source

`recipe.imageUri` is the single canonical image source.

- Set at session creation (`createLatestScanSession → attachScanImageUri`)
- Carried into saved recipes (`attachRealScanImage`)
- Never overwritten by AI images or stock photos when set
- All screens call `getRecipeImageUrl(recipe, fallback)` which reads `recipe.imageUri` first

## Priority chain in `getRecipeImageUrl`

1. `recipe.imageUri` — user's permanent scan photo (wins always)
2. `recipe.image?.uri` — nested image object URI (API fallback)
3. `fallbackUri` — `getRealScanImageUri(selectedScanImage)` (session fallback)
4. `recipe.imageUrl` — may be stock photo for demo scans
5. `recipe.image?.url` — last resort
