# Source of Truth Report

## The canonical image source

**`recipe.imageUri`** is the single source of truth for every recipe's visual identity.

It is set once, at session creation, and never overwritten unless a better image is available.

## Field inventory

| Field | Location | Role | Should be read directly? |
|-------|----------|------|--------------------------|
| `recipe.imageUri` | `state.latestScanRecipes[n]`, `state.savedRecipes[n]` | **Canonical** | Yes — primary source for all recipe screens |
| `recipe.imageUrl` | Same objects | Secondary | Only if `imageUri` is absent. May be stock photo for demo scans. |
| `selectedScanImage.uri` | `state.selectedScanImage`, `latestScanSession.selectedScanImage` | Session fallback | Via `getRealScanImageUri()` only. Never directly. |
| `latestScanSession.selectedScanImage` | `state.latestScanSession` | Session context | Via `?? storedSelectedScanImage` fallback only (ResultSummaryScreen) |
| `scanContext.image` | Navigation route params | Share card context | Via `scanContext?.image ?? selectedScanImage` — never alone |

## What should never be used directly

- `state.selectedScanImage.uri` without `getRealScanImageUri()` — placeholder check is required
- `latestScanSession.selectedScanImage` without the flat field fallback — session may be null
- `shareImage?.uri` without `!shareImage?.placeholder` — placeholder images have no valid URI

## How `getRecipeImageUrl` enforces priority

```typescript
getFirstString([
  recipe.imageUri,        // 1st: permanent user photo
  recipe.image?.uri,      // 2nd: nested API image
  fallbackUri,            // 3rd: getRealScanImageUri(selectedScanImage)
  recipe.imageUrl,        // 4th: may be stock photo (demo only)
  recipe.image?.url,      // 5th: last resort
])
```

All screens pass `getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage))`.
The user's image wins whenever `recipe.imageUri` is set.

## State coherence rule (new after fix)

`writeSavedRecipeContext` in `useOkyoStore.ts` now clears BOTH:
- Flat fields: `selectedScanImage: null`, `latestScanRecipes: [savedRecipe]`, etc.
- Session object: `latestScanSession: null`

This eliminates the `ResultSummaryScreen` reading stale session data from a previous scan.
