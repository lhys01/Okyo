# Image Persistence Audit

## URI lifecycle (before fix)

| Stage | URI type | Directory | Survives restart? |
|-------|---------|-----------|-------------------|
| ImagePicker output | `file://` | `NSCachesDirectory/ExponentExperienceData/ImagePicker/` | No guarantee |
| ImageManipulator output | `file://` | `NSCachesDirectory/ExponentExperienceData/{appId}/` | No guarantee |
| Stored in Zustand | same cache URI | AsyncStorage key `okyo-local-state` | URI string yes, file no |
| recipe.imageUri | same cache URI | AsyncStorage | URI string yes, file no |

## URI lifecycle (after fix)

| Stage | URI type | Directory | Survives restart? |
|-------|---------|-----------|-------------------|
| ImagePicker output | `file://` | OS cache | No guarantee |
| ImageManipulator output | `file://` | OS cache | No guarantee |
| `copyToDocuments()` output | `file://` | `NSDocumentDirectory/okyo-scan-images/` | YES |
| Stored in Zustand | permanent URI | AsyncStorage key `okyo-local-state` | YES |
| recipe.imageUri | permanent URI | AsyncStorage | YES |

## Persistence chain

```
documentDirectory/okyo-scan-images/scan-{timestamp}.jpg
  → ScanImageMetadata.uri
    → getPreviewImageMetadata()  [strips dataUrl, keeps uri]
      → latestScanSession.selectedScanImage.uri
        → createLatestScanSession → recipe.imageUri
          → Zustand persist → AsyncStorage
            → cold restart rehydration → same permanent path
              → FoodImage renders correctly
```

## Zustand partialize (what is persisted)

Confirmed persisted in `useOkyoStore.ts:387–416`:
- `latestScanSession` — includes `selectedScanImage` and all recipes with `imageUri`
- `selectedScanImage` — flat field mirror
- `savedRecipes` — includes `imageUri` per recipe

## Storage locations

- Permanent: `FileSystem.documentDirectory` → `NSDocumentDirectory` (iOS), `files/` (Android)
- Cache (previous): `FileSystem.cacheDirectory` → `NSCachesDirectory` (iOS), `cache/` (Android)

## Known limitations

- Permanent files are never deleted (no cleanup on recipe remove or data clear)
- Storage accumulates across scans — ~50–200KB per scan
- Recommendation: add cleanup in `removeSavedRecipe` and `clearSavedData` in a follow-up
