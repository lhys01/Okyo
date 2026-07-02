# Regression Report

## Files changed in this PR

| File | Change | Risk |
|------|--------|------|
| `apps/mobile/package.json` | Added `expo-file-system@~18.0.0` | Low: first-party Expo package, no breaking changes |
| `apps/mobile/src/screens/ScanScreen.tsx` | Added `copyToDocuments()`, updated `takePhoto` and `uploadFromPhotos` handlers | Low: failure falls back to original URI |
| `apps/mobile/src/state/useOkyoStore.ts` | `writeSavedRecipeContext` now sets `latestScanSession: null` | Low: all state consumers fall back to flat fields |
| `apps/mobile/src/screens/ResultSummaryScreen.tsx` | Enhanced `SCREEN_IMAGE_TRACE` log fields | None: logging only |
| `apps/mobile/src/screens/RecipeDetailScreen.tsx` | Enhanced `SCREEN_IMAGE_TRACE` log fields (x2) | None: logging only |

## Verified untouched

| Area | Status |
|------|--------|
| Onboarding screens (`WelcomeScreen.tsx`, `OnboardingUI.tsx`) | Untouched |
| RevenueCat integration | Untouched |
| Paywall screens | Untouched |
| Subscription logic | Untouched |
| AI prompts | Untouched |
| OpenRouter provider | Untouched |
| Backend scan generation | Untouched |
| Recipe generation logic | Untouched |
| Navigation structure | Untouched |
| HomeScreen, DiscoverScreen | Untouched |
| GroceryListScreen | Untouched |
| ProfileScreen | Untouched |
| AnalysisLoadingScreen | Untouched |
| ShareCardPreviewScreen | Untouched (fixed in previous session) |

## Demo scan / mock scan unaffected

`copyToDocuments` guards with `if (image.placeholder || !image.uri) return image;`

Demo scans use `createPlaceholderImage('mock')` which sets `placeholder: true`. The copy step is skipped — demo behavior is completely unchanged.

## `writeSavedRecipeContext` change — what could break

Before: `latestScanSession` was preserved when opening a library recipe.
After: `latestScanSession` is cleared.

Screens that read from `latestScanSession`:
- `ResultSummaryScreen` — falls back to flat fields. Flat fields are correctly set by `writeSavedRecipeContext`. No regression.
- `AnalysisLoadingScreen` — reads only `latestScanStatus`, `latestScanResult`, etc. Not `latestScanSession` directly. No regression.

All other screens read flat state fields (`state.latestScanRecipes`, `state.selectedScanImage`, etc.) which are correctly set. No regression.

## TypeScript verification

```
cd apps/mobile && npx tsc --noEmit
```

Exit code 0. No errors.
