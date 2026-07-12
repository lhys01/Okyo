# Okyo Scan Realism & Image Persistence Audit Report

Branch: `scan-realism-v2`
Scope: Scan image persistence, ownership, screen realism, fallback honesty
Prohibited: Onboarding redesign, RevenueCat, navigation structure, AI/OpenRouter logic

---

## Audit Loops Completed

| Loop | Area Inspected | Files Read |
|------|---------------|------------|
| 1 | Image resolution chain | `utils/recipeImages.ts` |
| 2 | Save-time image stamping | `utils/savedRecipeImage.ts` |
| 3 | Store write/clear/persist lifecycle | `state/useOkyoStore.ts` (full) |
| 4 | Permanent image copy to Documents | `screens/ScanScreen.tsx` |
| 5 | Result screen image display | `screens/ResultSummaryScreen.tsx` |
| 6 | Recipe detail image display | `screens/RecipeDetailScreen.tsx` |
| 7 | Library screen image display | `screens/LibraryScreen.tsx` |
| 8 | Home screen image display | `screens/HomeScreen.tsx` |
| 9 | Loading screen & share card | `screens/AnalysisLoadingScreen.tsx`, `screens/ShareCardPreviewScreen.tsx` |

---

## Findings

### Critical (Pre-Fix)

**C1 — Cold restart wipes food photos**
File: `screens/ScanScreen.tsx`

`expo-image-manipulator` writes compressed images to `NSCachesDirectory`. iOS may clear this directory when the app is terminated or under memory pressure, wiping the user's scan image URI permanently. On cold restart, `selectedScanImage.uri` pointed to a non-existent file.

Status: **FIXED** — `copyToDocuments()` now copies the image to `NSDocumentDirectory/okyo-scan-images/scan-{timestamp}.jpg` before `beginLatestScanSession()` is called. Documents directory is never cleared by iOS.

---

**C2 — Scan session contamination (Recipe A shows Recipe B's image)**
File: `state/useOkyoStore.ts`, `screens/LibraryScreen.tsx`, `screens/HomeScreen.tsx`

`writeSavedRecipeContext()` previously preserved `latestScanSession` when opening a saved recipe. On `RecipeDetailScreen`, `getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage))` resolves the image. If a prior scan session was still in state, its `selectedScanImage` (e.g. a photo of a burger) would render on a saved pasta recipe. The user's most recent scan photo contaminated every saved recipe opened from Library/Home.

Status: **FIXED** — `writeSavedRecipeContext()` now writes `latestScanSession: null`. The recipe itself carries `imageUri` (stamped at save time), which is the canonical source.

---

### High (Pre-Fix)

**H1 — Recipes in scan session not stamped with imageUri**
File: `state/useOkyoStore.ts`

`writeLatestScanSession()` stored `latestScanRecipes` without stamping `imageUri` on each recipe. When `RecipeDetailScreen` read `recipe.imageUri`, it was undefined. The screen fell through to `selectedScanImage` fallback, which worked only while the scan session was active — failing after any navigation that cleared the session.

Status: **FIXED** — `createLatestScanSession()` calls `attachScanImageUri(recipe, realScanImageUri)` on every recipe in `latestScanRecipes` and on `latestScanRecipe`.

---

**H2 — Saved recipes not stamped with imageUri at save time**
File: `screens/RecipeDetailScreen.tsx`

`saveRecipe(recipe)` was called without attaching the scan image URI. Saved recipes had no `imageUri`. After a cold restart or after `writeSavedRecipeContext()` cleared `selectedScanImage`, the recipe image was permanently lost.

Status: **FIXED** — Save call is now `saveRecipe(attachRealScanImage(recipe, selectedScanImage))`. `attachRealScanImage()` stamps `imageUri` and `imageUrl` on the recipe before it enters the saved recipes list.

---

**H3 — AnalysisLoadingScreen showed no user food photo**
File: `screens/AnalysisLoadingScreen.tsx`

The loading screen showed Kiko mascot + progress steps only. The user's food photo was in state (`selectedScanImage`) before the screen rendered, but was never displayed. The product felt disconnected — the user couldn't verify their photo was being processed.

Status: **FIXED** — A 96×96 food photo thumbnail is now shown below the Kiko mascot during analysis, with caption "Your photo · analyzing". Guarded by `getRealScanImageUri(selectedScanImage)` (skipped for mock/demo scans).

---

### Medium (Pre-Fix)

**M1 — ShareCardPreviewScreen: missing placeholder guard**
File: `screens/ShareCardPreviewScreen.tsx`

`imageUri: shareImage?.uri ? shareImage.uri : getRecipeImageUri(cardRecipe)` did not check `shareImage.placeholder`. A placeholder URI (used in demo scans) could silently resolve as a real URI, or an undefined path could break the native `<Image>` component.

Status: **FIXED** — All five card types now use `(!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe)`.

---

**M2 — ResultSummaryScreen: savings hidden on real scans**
File: `screens/ResultSummaryScreen.tsx`

`canShowSavings = isDemoScan || userRestaurantPrice !== null`. For real scans, `isDemoScan = false` and `userRestaurantPrice = null` (empty text input). Savings were hidden until the user manually typed a price, even when the AI scan result included a `restaurantPrice`.

Status: **FIXED** — `restaurantPriceInput` is pre-filled with `scanResult.restaurantPrice.toFixed(2)` when the scan result has a positive restaurant price. Savings display immediately on real scans.

---

**M3 — ResultSummaryScreen: identical kicker regardless of scan confidence**
File: `screens/ResultSummaryScreen.tsx`

The kicker text previously said "Okyo understood your food" for all scan outcomes including low-confidence or partial results, creating false certainty.

Status: **FIXED** — Kicker is now confidence-aware: `isUncertainResult ? 'Okyo made a best guess' : 'Okyo understood your food'`. `isUncertainResult` is true when confidence < 55% or scan status is `partial`.

---

**M4 — ResultSummaryScreen: misleading dish name confirmNote**
File: `screens/ResultSummaryScreen.tsx`

The `confirmNote` text said "Using this guess for the recipe shown below", implying that editing the dish name would regenerate the recipe. It does not — `dishNameOverride` is local UI state only.

Status: **FIXED** — Copy now reads "Edit if the name is off. Recipe content follows the original scan." (unconfirmed) and "Dish name updated. The recipe content follows the original scan." (confirmed).

---

### Low (Remaining)

**L1 — `getStorageLocation()` misclassifies iOS simulator Documents paths**
File: `utils/imageValidation.ts`

iOS simulator Documents paths resolve as `/private/var/mobile/Containers/...` (with the `/private` prefix) rather than `/var/mobile/...`. `getStorageLocation()` checks for `FileSystem.documentDirectory` which starts without `/private`. Valid permanent URIs on the simulator are reported as `'unknown'` instead of `'documents'` in trace logs.

Status: **Open** — Does not affect functionality. Trace logs will show `storageLocation: 'unknown'` for valid Documents-dir files in the simulator. Fix: normalize URI by stripping the `/private` prefix before comparison, or check for both prefixes.

---

**L2 — Legacy saved recipes missing imageUri**
All saved recipes in AsyncStorage from before `attachRealScanImage()` was introduced have no `imageUri`. These recipes show a spark icon fallback when opened from Library/Home.

Status: **Open (low priority)** — Only affects dev installs during development. Production users will not have legacy data. No migration needed for launch.

---

**L3 — HomeScreen recent timeline has no per-item image trace**
File: `screens/HomeScreen.tsx`

Timeline recipe rows call `getRecipeImageUrl(recipe)` with no fallback and no `imageTraceLog()`. Image source is untraceable for individual timeline items.

Status: **Accepted** — Adding traces to all list items would generate excessive log noise. Image resolution for timeline items is deterministic: recipe.imageUri → spark fallback. The `openRecipe` path logs via `LibraryScreen` / `RecipeDetailScreen` traces when the user taps.

---

## Image Resolution Priority Chain

All screens resolve food images through the same hierarchy:

```
1. recipe.imageUri          ← canonical; stamped at scan session write + at save
2. recipe.image?.uri        ← API response field (may be placeholder)
3. fallbackUri              ← getRealScanImageUri(selectedScanImage); session-scoped
4. recipe.imageUrl          ← secondary; used for stock photos in demo mode
5. recipe.image?.url        ← API response field; may be remote
```

The chain is enforced by `getRecipeImageUrl()` in `utils/recipeImages.ts`. All screens call this function — no screen reads `recipe.imageUri` directly.

---

## Screen Image Source Map

| Screen | Image Source | Fallback |
|--------|-------------|----------|
| `AnalysisLoadingScreen` | `getRealScanImageUri(selectedScanImage)` | Hidden (not shown) |
| `ResultSummaryScreen` | `getRealScanImageUri(latestScanSession?.selectedScanImage ?? storedSelectedScanImage)` | Inline empty state |
| `RecipeDetailScreen` | `getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage))` | Spark icon |
| `LibraryScreen` (card thumb) | `getRecipeImageUrl(recipe)` | Spark icon |
| `HomeScreen` (hero) | `getRecipeImageUrl(heroRecipe, getRealScanImageUri(session?.selectedScanImage) ?? getRealScanImageUri(selectedScanImage))` | Spark icon |
| `HomeScreen` (timeline) | `getRecipeImageUrl(recipe)` | Spark icon |
| `ShareCardPreviewScreen` | `(!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe)` | No image |

---

## Persistence Matrix

| Event | Image survives? | Mechanism |
|-------|----------------|-----------|
| Navigate between screens | ✓ | Zustand in-memory state |
| Background → foreground | ✓ | Zustand in-memory state |
| Cold restart | ✓ | Documents dir + AsyncStorage URI |
| Recipe save | ✓ | `attachRealScanImage()` stamps imageUri |
| Library reopen | ✓ | `savedRecipes[n].imageUri` from AsyncStorage |
| Recipe A open after Recipe B | ✓ | `writeSavedRecipeContext` clears session; recipe.imageUri is canonical |
| Demo scan | ✓ | `placeholder: true` → `getRealScanImageUri()` returns null; stock image used |

---

## Ownership Guarantees

- `recipe.imageUri` is set exactly once per recipe, at `createLatestScanSession()` (scan write) or at `saveRecipe(attachRealScanImage(...))` (save). It is never overwritten downstream.
- `writeSavedRecipeContext()` sets `latestScanSession: null` and `selectedScanImage: null` before loading a saved recipe. This prevents any active scan's image from contaminating a saved recipe's display.
- `getRealScanImageUri()` explicitly rejects `placeholder: true` images. A placeholder cannot be silently used as a real food photo.
- `getRecipeImageUrl()` enforces a strict priority chain. `recipe.imageUri` always wins when set.

---

## Scan Realism Improvements (This Session)

Beyond persistence hardening, these changes make the product feel like a real AI food scanner:

| Improvement | Screen | Effect |
|-------------|--------|--------|
| Food photo thumbnail during analysis | `AnalysisLoadingScreen` | User sees their uploaded food while waiting |
| Confidence-aware kicker text | `ResultSummaryScreen` | Product is honest about uncertain results |
| Honest dish name confirmNote | `ResultSummaryScreen` | User not misled that editing a name regenerates the recipe |
| Restaurant price pre-fill from AI | `ResultSummaryScreen` | Savings visible immediately on real scans |

---

## What Was Not Changed

Per project constraints, the following were not touched:

- Onboarding screens and flow
- RevenueCat / paywall / subscription logic
- Scan AI logic and prompts
- OpenRouter provider
- Backend scan generation and recipe generation
- Navigation structure
- Branding and cosmetic styles outside of the scan flow
