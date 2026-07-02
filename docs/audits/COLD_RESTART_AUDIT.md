# Cold Restart Audit

Branch: `feature/scan-image-persistence-hardening`

## Scenario Simulated

scan → save → kill app → reopen → open library recipe → image visible

## URI Lifecycle Trace

### Step 1 — User picks photo

```
expo-image-manipulator.manipulateAsync(asset.uri, [...])
→ Writes JPEG to:
  file:///var/mobile/.../Library/Caches/ExponentExperienceData/{appId}/ImageManipulator/{uuid}.jpg
  (NSCachesDirectory — CLEARED by OS under storage pressure)
```

### Step 2 — copyToDocuments() (ScanScreen.tsx:497)

```
FileSystem.copyAsync({
  from: <cache URI>,
  to: FileSystem.documentDirectory + 'okyo-scan-images/scan-{Date.now()}.jpg'
})
→ Writes to:
  file:///var/mobile/.../Documents/okyo-scan-images/scan-1718000000000.jpg
  (NSDocumentDirectory — NEVER cleared by OS)
→ ScanImageMetadata.uri is updated to permanent URI before state write
```

**Failure handling**: if `copyAsync` throws (e.g., device full), function returns the original cache URI and logs `okyo_scan_image_persist_failed`. Session works. Cold restart may fail silently for that scan.

### Step 3 — Zustand state write

```
beginLatestScanSession({ selectedScanImage: previewImage })
→ previewImage.uri = permanent Documents URI ✓
→ createLatestScanSession() stamps imageUri on all recipes
→ recipe.imageUri = permanent Documents URI ✓
```

### Step 4 — User saves recipe

```
saveRecipe(attachRealScanImage(recipe, selectedScanImage))
→ attachRealScanImage() stamps imageUri = selectedScanImage.uri on the recipe
→ savedRecipes[n].imageUri = permanent URI ✓
```

### Step 5 — Zustand persists to AsyncStorage

```
partialize() includes:
  latestScanSession: { selectedScanImage: { uri: '<documents URI>' } }
  latestScanRecipes: [{ imageUri: '<documents URI>' }]
  savedRecipes: [{ imageUri: '<documents URI>' }]
→ AsyncStorage stores the URI string ✓
```

### Step 6 — App killed

```
OS may clear NSCachesDirectory.
NSDocumentDirectory untouched.
```

### Step 7 — App restarts

```
Zustand rehydrates from AsyncStorage:
  savedRecipes[n].imageUri = 'file:///...Documents/okyo-scan-images/scan-1718000000000.jpg'
→ URI string is intact ✓
→ File at that path is intact ✓ (Documents dir)
```

### Step 8 — User opens library recipe

```
LibraryScreen.RecipeThumb:
  FoodImage imageUrl={getRecipeImageUrl(recipe)}
  = getRecipeImageUrl({ imageUri: 'file:///...Documents/...' })
  = recipe.imageUri
  = 'file:///...Documents/okyo-scan-images/scan-1718000000000.jpg'
→ FoodImage renders Image source={{ uri }} ✓
```

## Verdict

**VERIFIED**: Uploaded scan image survives cold restart.

## Remaining Risk

| Scenario | Behavior | Verified? |
|----------|----------|-----------|
| Device full at scan time | Falls back to cache URI; cold restart may lose image | Verified (fallback path) |
| App uninstall/reinstall | All data lost including Documents. Expected. | n/a |
| iCloud backup restore to new device | Documents restored if iCloud backup enabled | UNVERIFIED — out of scope |
| App update changing container UUID | Container UUID preserved across updates (iOS behavior) | UNVERIFIED |
| File deleted manually by user | FoodImage shows Spark fallback. No crash. | Verified (FoodImage fallback) |
