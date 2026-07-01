# Final Regression Report

Branch: `feature/scan-image-persistence-hardening`
TypeScript: `npx tsc --noEmit` → exit 0, no errors.

## Loop Re-Audit

### Loop 1 — Image Ownership

- Source hierarchy: VERIFIED (IMAGE_OWNERSHIP_REPORT.md)
- `recipe.imageUri` is canonical: VERIFIED
- `getRecipeImageUrl()` priority chain enforces order: VERIFIED
- No screen reads `selectedScanImage.uri` directly without `getRealScanImageUri()`: VERIFIED

### Loop 2 — Cold Restart

- `copyToDocuments()` copies to `NSDocumentDirectory`: VERIFIED (COLD_RESTART_AUDIT.md)
- Documents URI survives OS cache eviction: VERIFIED
- Documents URI survives app kill: VERIFIED
- Documents URI stored in AsyncStorage: VERIFIED

### Loop 3 — State Contamination

- `writeSavedRecipeContext` clears `latestScanSession: null`: VERIFIED (STATE_ISOLATION_REPORT.md)
- Recipe A never shows Recipe B's image: VERIFIED
- Library recipe navigation isolated from prior scan session: VERIFIED

### Loop 4 — Screen Coverage

- 13 image surfaces catalogued in SCREEN_IMAGE_MATRIX.md
- All surfaces traced: VERIFIED
- Two UX gaps documented (loading screen, per-step cooking images): VERIFIED (out of scope)

### Loop 5 — Fallback Rules

- Fallback only when no uploaded image exists: VERIFIED (FALLBACK_RULES.md)
- Placeholder guard on all URIs: VERIFIED
- `validateRecipeImage()` detects incorrect fallback in `__DEV__`: VERIFIED

### Loop 6 — Logging

- `imageTraceLog` enabled in all `__DEV__` builds: VERIFIED
- Required fields on all traces: screen, recipeId, imageSource, imageUri, fileExists, usingFallback, fallbackReason: VERIFIED
- Screens with traces: ResultSummaryScreen, RecipeDetailScreen, RecipeStepsScreen, HomeScreen, LibraryScreen, ShareCardPreviewScreen: VERIFIED
- `uiLog` (general UI events) remains gated by `shouldLogUiDebug = false` — unchanged: VERIFIED

### Loop 7 — File Persistence

- IMAGE_STORAGE_STRATEGY.md written: VERIFIED
- Cleanup gap documented (recipe delete does not remove files): VERIFIED
- Cleanup is a separate task, not in scope here: VERIFIED

### Loop 8 — Validation Harness

- `imageValidation.ts` created with `validateRecipeImage()`, `checkImageFileExists()`, `getStorageLocation()`: VERIFIED
- Imported in: ResultSummaryScreen, RecipeDetailScreen, HomeScreen, LibraryScreen, ShareCardPreviewScreen: VERIFIED
- All traces include `fileExists` from async `checkImageFileExists()`: VERIFIED

## Files Changed in This Branch

| File | Change | Risk |
|------|--------|------|
| `apps/mobile/package.json` | Added `expo-file-system@~18.0.0` | Low |
| `apps/mobile/src/screens/ScanScreen.tsx` | `copyToDocuments()`, updated `takePhoto`/`uploadFromPhotos` handlers | Low: fallback to original URI on failure |
| `apps/mobile/src/state/useOkyoStore.ts` | `writeSavedRecipeContext` sets `latestScanSession: null` | Low: all consumers fall back to flat fields |
| `apps/mobile/src/screens/ResultSummaryScreen.tsx` | Updated SCREEN_IMAGE_TRACE with `fileExists`, `usingFallback`, `fallbackReason`; uses `imageTraceLog` | None: logging only |
| `apps/mobile/src/screens/RecipeDetailScreen.tsx` | Same for RecipeDetailScreen and RecipeStepsScreen | None: logging only |
| `apps/mobile/src/screens/HomeScreen.tsx` | Added hero image SCREEN_IMAGE_TRACE via `imageTraceLog` | None: logging only |
| `apps/mobile/src/screens/LibraryScreen.tsx` | Added SCREEN_IMAGE_TRACE in `openSavedRecipe` | None: logging only |
| `apps/mobile/src/screens/ShareCardPreviewScreen.tsx` | Added SCREEN_IMAGE_TRACE in `useEffect` | None: logging only |
| `apps/mobile/src/utils/uiDebug.ts` | Added `imageTraceLog` export | None: new export only |
| `apps/mobile/src/utils/imageValidation.ts` | New file: `checkImageFileExists`, `getStorageLocation`, `validateRecipeImage` | None: dev utility |

## Verified Untouched

| Area | Status |
|------|--------|
| RevenueCat | Untouched |
| Onboarding screens | Untouched |
| Paywall | Untouched |
| Subscriptions | Untouched |
| AI prompts | Untouched |
| OpenRouter provider | Untouched |
| Backend API | Untouched |
| Recipe generation | Untouched |
| Navigation structure | Untouched |
| GroceryListScreen | Untouched |
| ProfileScreen | Untouched |
| SettingsScreen | Untouched |
| AnalysisLoadingScreen | Untouched |
| RestaurantPacksScreen | Untouched |

## Remaining Risks

| Risk | Severity | Status |
|------|----------|--------|
| Scan image files never deleted on recipe remove | Medium | KNOWN GAP — separate task queued |
| iCloud restore to new device untested | Low | UNVERIFIED — out of scope |
| `copyToDocuments` failure on full device | Low | Handled: fallback to cache URI, logged |
| Per-step cooking images not shown | Low | UX gap — design decision, out of scope |
| Loading screen image not shown | Low | UX gap — design decision, out of scope |

## Bugs Found in This Audit

| Bug | Severity | Fixed? |
|-----|----------|--------|
| Cache URI used for scan image → lost on cold restart | High | Yes — `copyToDocuments()` in ScanScreen.tsx |
| Stale `latestScanSession` contaminated result screen | High | Yes — `writeSavedRecipeContext` clears session |
| `uiLog` gated to `false` silenced all SCREEN_IMAGE_TRACE | Medium | Yes — `imageTraceLog` always enabled in `__DEV__` |
| SCREEN_IMAGE_TRACE missing `fileExists`, `usingFallback`, `fallbackReason` fields | Medium | Yes — all traces updated |
| SCREEN_IMAGE_TRACE missing from HomeScreen, LibraryScreen, ShareCardPreviewScreen | Low | Yes — all three added |
| No file existence validation utility | Low | Yes — `imageValidation.ts` created |
