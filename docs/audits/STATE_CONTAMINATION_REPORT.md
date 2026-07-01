# State Contamination Report

## Simulation: scan A → scan B → open library A

### Before fix

```
1. Scan meal A (burger)
   → latestScanSession = { selectedScanImage: { uri: 'burger.jpg' }, ... }
   → state.selectedScanImage = { uri: 'burger.jpg' }

2. User saves recipe A
   → savedRecipes[0].imageUri = 'burger.jpg'

3. User scans meal B (pasta)
   → latestScanSession = { selectedScanImage: { uri: 'pasta.jpg' }, ... }
   → state.selectedScanImage = { uri: 'pasta.jpg' }

4. User opens Library → taps Recipe A → writeSavedRecipeContext({ recipe: A })
   Sets:
     state.selectedScanImage = null
     state.latestScanRecipes = [recipeA]
     state.latestScanStatus = null
     ...
   Does NOT set:
     state.latestScanSession  ← still contains pasta scan session!

5. Navigation lands on RecipeDetailScreen
   → state.selectedScanImage = null (correct, recipeA.imageUri provides the image)
   → recipeImageUrl = getRecipeImageUrl(recipeA, null) = recipeA.imageUri = 'burger.jpg' ✓

6. User navigates BACK to ResultSummaryScreen
   → selectedScanImage = latestScanSession?.selectedScanImage ?? null
   → latestScanSession still exists (from pasta scan!)
   → selectedScanImage = { uri: 'pasta.jpg' } ← WRONG
   → FoodImageCard shows PASTA image for BURGER recipe ← contamination
```

### After fix

```
4. writeSavedRecipeContext now ALSO sets:
     state.latestScanSession = null  ← cleared

5. ResultSummaryScreen:
   → latestScanSession = null
   → selectedScanImage = latestScanSession?.selectedScanImage ?? storedSelectedScanImage
   → = null ?? null = null
   → FoodImageCard shows "Food photo unavailable" (correct — no active scan)
```

## Root cause

`writeSavedRecipeContext` updated 6 flat state fields but did not touch `latestScanSession`.

`ResultSummaryScreen` (and only `ResultSummaryScreen`) reads from `latestScanSession` first via:
```typescript
const selectedScanImage = latestScanSession?.selectedScanImage ?? storedSelectedScanImage;
```

This created a divergence between flat state (cleared) and session state (stale).

## Fix

`useOkyoStore.ts:writeSavedRecipeContext` now includes `latestScanSession: null` in its return value.

The `ResultSummaryScreen` fallback chain then reads `storedSelectedScanImage` (which is null), producing the correct "no active scan" state when a library recipe is loaded.

## All other screens unaffected

`RecipeDetailScreen` and `RecipeStepsScreen` read only `state.selectedScanImage` (flat field), not `latestScanSession`. These were never affected by this bug. They showed the correct image from `recipe.imageUri` even before the fix.
