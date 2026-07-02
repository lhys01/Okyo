# End-to-End Validation

## Image journey: scan → library → cooking → share

```
Stage                  Image source                        URI type      Passes?
──────────────────────────────────────────────────────────────────────────────────
1. Scan upload         getImageMetadata → copyToDocuments  documents/    ✓
2. Loading screen      getRealScanImageUri(selectedScanImage) documents/    ✓ (FIXED)
3. Result screen       selectedScanImage.uri               documents/    ✓
4. Recipe overview     recipe.imageUri                     documents/    ✓
5. Guided cooking      recipe.imageUri (completion card)   documents/    ✓
6. Recipe completion   recipe.imageUri                     documents/    ✓
7. Save recipe         attachRealScanImage → imageUri      documents/    ✓
8. Library screen      savedRecipe.imageUri                documents/    ✓
9. Saved recipe open   savedRecipe.imageUri via recipe     documents/    ✓
10. Share card         scanContext.image.uri               documents/    ✓
11. App refresh        Zustand rehydrate → same URI        documents/    ✓
12. Cold restart       AsyncStorage → file exists          documents/    ✓ (FIXED)
```

## Expected SCREEN_IMAGE_TRACE output after fix

### ResultSummaryScreen (active scan)
```json
{
  "screen": "ResultSummaryScreen",
  "action": "SCREEN_IMAGE_TRACE",
  "recipeId": "recipe-abc123",
  "imageSource": "latestScanSession",
  "imageUri": "file:///...Documents/okyo-scan-images/scan-1718000000000.jpg",
  "fallbackUsed": false,
  "storageLocation": "documents"
}
```

### RecipeDetailScreen (active scan)
```json
{
  "screen": "RecipeDetailScreen",
  "action": "SCREEN_IMAGE_TRACE",
  "recipeId": "recipe-abc123",
  "imageSource": "recipe.imageUri",
  "imageUri": "file:///...Documents/okyo-scan-images/scan-1718000000000.jpg",
  "fallbackUsed": false,
  "storageLocation": "documents"
}
```

### RecipeDetailScreen (opened from library)
```json
{
  "screen": "RecipeDetailScreen",
  "action": "SCREEN_IMAGE_TRACE",
  "recipeId": "recipe-abc123",
  "imageSource": "recipe.imageUri",
  "imageUri": "file:///...Documents/okyo-scan-images/scan-1718000000000.jpg",
  "fallbackUsed": false,
  "storageLocation": "documents"
}
```

## Known gaps not fixed

| Gap | Reason not fixed |
|-----|-----------------|
| Stage 5 (guided cooking steps) — no image per step | Out of scope: requires UI change |
| Permanent file cleanup on recipe delete | Out of scope: requires store refactor |

## Success criteria check

| Criterion | Status |
|-----------|--------|
| Scan image survives app refresh | ✓ (was already working via AsyncStorage) |
| Scan image survives app restart | ✓ (FIXED: permanent URI now) |
| Scan image survives device memory pressure | ✓ (FIXED: documentDirectory immune) |
| Scan image survives recipe save | ✓ (attachRealScanImage at save time) |
| Scan image survives recipe reopen | ✓ (recipe.imageUri persisted in savedRecipes) |
| Scan image survives library navigation | ✓ (savedRecipe.imageUri → getRecipeImageUrl) |
| Recipe A cannot display Recipe B's image | ✓ (FIXED: writeSavedRecipeContext clears latestScanSession) |
| Library recipes show their own image | ✓ (recipe.imageUri on each saved recipe) |
| ResultSummaryScreen shows correct image | ✓ (FIXED: no stale session contamination) |
| Guided cooking shows correct image | ✓ (completion card uses recipe.imageUri) |
| Share card shows correct image | ✓ (placeholder guard fixed in previous session) |
| Uploaded image always wins | ✓ (getRecipeImageUrl priority: imageUri first) |
| No placeholder can override real upload | ✓ (getRealScanImageUri checks placeholder flag) |
