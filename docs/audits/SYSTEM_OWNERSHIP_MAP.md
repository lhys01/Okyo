# System Ownership Map

Branch: `activation-audit-v1`
Date: 2026-06-17
Method: Code trace only. No prior reports trusted.

---

## Full Ownership Trace

### Stage 1 — Image Selection (Camera / Gallery)

```
User taps camera button → takePhoto()                       [ScanScreen.tsx ~L230]
  → expo-image-picker (launchCameraAsync, base64:false)
  → result.uri = cache URI (expo temp cache)
  → image = { uri: cacheUri, width, height, source:'camera' }

User taps upload button → uploadFromPhotos()                [ScanScreen.tsx ~L260]
  → expo-image-picker (launchImageLibraryAsync, base64:false)
  → image = { uri: cacheUri, width, height, source:'photos' }
```

**Owner at this point**: `image.uri` is a cache-directory URI (temporary). Not yet in Documents.

---

### Stage 2 — Image Preprocessing

```
startScan(source, image) called                             [ScanScreen.tsx ~L50]
  → previewImage = getPreviewImageMetadata(image)
      → strips dataUrl field to prevent base64 in state
      → returns: { uri, width, height, source, ... } (no dataUrl)
  → beginLatestScanSession({ selectedScanImage: previewImage, ... })
      → sets store.selectedScanImage = previewImage (cache URI)
      → cleans up prior scan's Documents image if unreferenced
  → navigation.navigate('AnalysisLoadingScreen')
```

**Owner at this point**: Store has cache URI. Documents has nothing yet.

---

### Stage 3 — Image Storage (Documents Copy)

```
startScan passes image to API via: copyToDocuments(image)    [ScanScreen.tsx ~L496]
  → guards: placeholder? → return image unchanged
  → guards: no uri? → return image unchanged
  → guards: no documentDirectory? → return image unchanged
  → dest = documentDirectory + 'okyo-scan-images/scan-{timestamp}.jpg'
  → FileSystem.copyAsync({ from: cacheUri, to: destUri })
  → returns: { ...image, uri: destUri }  ← DOCUMENTS URI

startScan('camera', await copyToDocuments(cameraImage))      [ScanScreen.tsx ~L251]
startScan('photos', await copyToDocuments(photosImage))      [ScanScreen.tsx ~L285]
```

**Owner at this point**: Documents has the scan image. Cache URI is abandoned.
**IMPORTANT**: `copyToDocuments` runs BEFORE `beginLatestScanSession` is called inside `startScan`. So the Documents file is created first, then the session begins.

---

### Stage 4 — API Request

```
createMockScan({ image: documentsImage, mode, source })       [api/client.ts]
  → compresses image: processImageForUpload()                 [ScanScreen.tsx ~L555]
      → 6 compression attempts (widths: 1400→1200→1000→800→600→400)
      → target: dataUrlSizeBytes < 12_000_000 bytes
      → result.base64 → dataUrl = 'data:image/jpeg;base64,...'
  → POST /v1/scans with { source, mode, image: { uri, dataUrl, ... } }
  → 60s AbortController timeout
  → NO auth headers
  → response: CreateScanResult
```

**Owner at this point**: API has transient reference to base64. Mobile still owns Documents file.

---

### Stage 5 — Scan Response Processing

```
API response received                                         [ScanScreen.tsx ~L80]
  → isActiveScanSession(scanSessionId) guard check
      → if stale: log + return (no state mutation)
  → imageForStorage = (!image.placeholder && image.uri) ? image : result.image
  → responseImage = getPreviewImageMetadata(imageForStorage)  ← strips dataUrl
  → status = result.status (success|partial|rejected|failed)
  → foodEvidence = hasFoodEvidence({ result, status })
  → scanRecipes = API recipes OR createStarterRecipesFromScan(scan, scanSessionId)
      → starter recipe IDs: scan-starter-{dish}-{mode}-{sessionSuffix8}
  → writeLatestScanSession({ selectedScanImage: responseImage, ... })
      → guard: rejects if scanSessionId doesn't match store
      → state update: latestScanStatus = 'success'|'partial'|etc.
      → state update: latestScanRecipes = [recipe1, recipe2, recipe3]
      → state update: selectedScanImage = { uri: documentsUri, ... }
  → navigation.navigate('ResultSummaryScreen')
```

**Owner at this point**: Store.selectedScanImage.uri = Documents URI.
All 3 recipes have `.image.uri` = Documents URI (via `attachScanImageUri`).

---

### Stage 6 — Result Display

```
ResultSummaryScreen mounts                                    [ResultSummaryScreen.tsx]
  → reads selectedMode, latestScanResult, latestScanRecipes from store
  → getRecipeImageUrl(recipe, fallbackUri) chain:
      1. recipe.imageUri          ← save-time snapshot (not set yet)
      2. recipe.image?.uri        ← Documents URI (set by API response)
      3. fallbackUri              ← passed by screen (same scanImage)
      4. recipe.imageUrl          ← remote URL (API-hosted, not used)
      5. recipe.image?.url        ← remote URL fallback
  → displays recipe.image.uri (Documents URI)
```

**Owner at this point**: Screen renders Documents URI directly.

---

### Stage 7 — Recipe Save

```
User taps save button → saveRecipe(recipe)                   [ResultSummaryScreen.tsx]
  → store.saveRecipe(recipe):
      → existingRecipe = savedRecipes.find(r => r.id === recipe.id)
      → if new: savedRecipes.push(recipe)
      → if exists: update imageUri only
  → attachRealScanImage(recipe, selectedScanImage):
      → uri = selectedScanImage.uri (Documents URI, not placeholder)
      → returns { ...recipe, imageUri: documentsUri, imageStatus:'ready' }
```

**Owner at this point**: `recipe.imageUri` = Documents URI.
This URI is the canonical save-time snapshot. It never changes unless recipe is re-saved.

---

### Stage 8 — Library Display

```
LibraryScreen mounts                                         [LibraryScreen.tsx]
  → reads store.savedRecipes
  → for each recipe: getRecipeImageUrl(recipe)
      1. recipe.imageUri         ← Documents URI (set at save time) ← WINS
      2. recipe.image?.uri       ← skipped (imageUri already wins)
  → renders Documents URI via <FoodImage />
```

**Owner at this point**: Library always reads `recipe.imageUri` (canonical). ✓

---

### Stage 9 — Recipe Reopen from Library

```
User taps a saved recipe card                                [LibraryScreen.tsx]
  → store.writeSavedRecipeContext(recipe):
      → clears latestScanSession (prevents stale contamination)
      → sets latestScanRecipe = savedRecipe
      → sets selectedScanImage = { uri: recipe.imageUri, ... }
  → navigation.navigate('RecipeDetailScreen')
  → RecipeDetailScreen: reads latestScanRecipe, selectedScanImage from store
  → getRecipeImageUrl(recipe, scanContext.image) resolves to recipe.imageUri
```

**Owner at this point**: Store is in "library display mode" — scan session cleared, recipe owns its own image. ✓

---

### Stage 10 — Guided Cooking

```
User taps "Start Cooking"                                    [RecipeDetailScreen.tsx]
  → navigation.navigate('RecipeStepsScreen', { recipeId })
  → RecipeStepsScreen reads recipe from latestScanRecipes or savedRecipes
  → No image display in steps (per-step photos are not implemented — accepted limitation)
```

**Owner at this point**: Recipe identity is locked to `recipeId`. Steps render text only.

---

### Stage 11 — Share Card

```
User taps share button → ShareCardPreviewScreen              [ShareCardPreviewScreen.tsx]
  → reads scanContext (latestScanResult, scanContext.image) from store at render time
  → getRecipeImageUrl(cardRecipe, scanContext.image?.uri)
  → generates share image via expo-sharing
```

**Owner at this point**: Share card uses `cardRecipe.imageUri` or `scanContext.image.uri` as fallback.

---

### Stage 12 — App Kill + Cold Restart

```
iOS kills app (background, low memory, etc.)
  → Zustand persist middleware: serializes state to AsyncStorage key 'okyo-local-state'
  → partialize() includes:
      selectedScanImage (with Documents URI, WITHOUT dataUrl)
      latestScanSession (full object with all recipes)
      latestScanRecipes, latestScanRecipe, latestScanResult (flat mirrors)
      savedRecipes (all saved recipes with imageUri)
      awardedXpEvents, completedChallenges, weeklyScanCount, xp, etc.

App reopens
  → Zustand rehydrates from AsyncStorage
  → selectedScanImage.uri = Documents URI (survives restart) ✓
  → savedRecipes[n].imageUri = Documents URI (survives restart) ✓
  → Documents files are permanent — survive app restarts ✓
```

**Owner at this point**: All URIs survive restart. ✓

---

## Ownership Invariants

| Invariant | Where Enforced |
|-----------|---------------|
| `dataUrl` never in AsyncStorage | `getPreviewImageMetadata()` strips it before store write |
| Stale scan session cannot write | `isActiveScanSession()` + `writeLatestScanSession()` session ID guard |
| Recipe A cannot display Recipe B's image | Session replaced atomically in `beginLatestScanSession()` |
| Unsaved scan images cleaned up | `clearLatestScan()` + `beginLatestScanSession()` call `deleteUnusedScanImage()` |
| Saved recipe image not deleted | `deleteUnusedScanImage()` checks `savedRecipes.some(r => r.imageUri === uri)` |
| Library always uses save-time snapshot | `recipe.imageUri` wins in `getRecipeImageUrl()` priority chain |

---

## Data Flow Diagram

```
Camera/Gallery
     │
     ▼
Cache URI (temp)
     │
     ▼ copyToDocuments()
Documents URI (permanent)
     │
     ├── → previewImage (no dataUrl) → beginLatestScanSession → store.selectedScanImage
     │
     ├── → processImageForUpload → base64 dataUrl → POST /v1/scans
     │                                               (dataUrl NOT stored in state)
     │
     ▼
API Response
     │ imageForStorage = prefer user's real photo over API image
     ▼
responseImage (no dataUrl) → writeLatestScanSession
     │
     ├── → latestScanRecipes[n].image.uri = Documents URI
     │
     ▼
ResultSummaryScreen (displays recipe.image.uri)
     │
     ├── saveRecipe() → recipe.imageUri = Documents URI (canonical snapshot)
     │
     ▼
LibraryScreen (displays recipe.imageUri)
```

---

## State Persistence Map

| Field | Persisted? | Type | Notes |
|-------|-----------|------|-------|
| `selectedScanImage` | ✓ | `ScanImageMetadata` | dataUrl stripped before storage |
| `latestScanSession` | ✓ | Full session object | Includes all 3 recipes — redundant |
| `latestScanRecipes` | ✓ | `Recipe[]` | Flat mirror of session.latestScanRecipes |
| `latestScanRecipe` | ✓ | `Recipe \| null` | Flat mirror |
| `latestScanResult` | ✓ | `ScanResult \| null` | Flat mirror |
| `latestScanStatus` | ✓ | string | Flat mirror |
| `savedRecipes` | ✓ | `Recipe[]` | All saved recipes, grows unboundedly |
| `awardedXpEvents` | ✓ | `string[]` | GROWS UNBOUNDEDLY — 2+ entries per scan |
| `completedChallenges` | ✓ | `CompletedChallenge[]` | Grows with challenge completions |
| `weeklyScanCount` | ✓ | `number` | Only increments, never resets |
| `leaderboardEntries` | ✓ | `LeaderboardEntry[]` | Initialized with mock data, static |
| `xp`, `unlockedBadges` | ✓ | scalar/array | Normal growth |
