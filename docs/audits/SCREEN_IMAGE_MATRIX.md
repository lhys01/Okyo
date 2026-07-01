# Screen Image Matrix

Branch: `feature/scan-image-persistence-hardening`

Every component that renders a user food image or a recipe image.

| Screen / Component | Image Source | Fallback Source | Uploaded Image Supported | Has SCREEN_IMAGE_TRACE | Verified |
|-------------------|-------------|-----------------|--------------------------|------------------------|----------|
| `AnalysisLoadingScreen` | `getRealScanImageUri(selectedScanImage)` → 96×96 thumb | Hidden (not shown for mock scans) | Yes | No — fires before navigation | FIXED + VERIFIED |
| `ResultSummaryScreen` (main) | `getRealScanImageUri(selectedScanImage)` → `FoodImageCard` | Inline empty state (`PlusCircle` icon) | Yes | Yes | VERIFIED |
| `ResultSummaryScreen` (failure) | `getRealScanImageUri(selectedScanImage)` → `Image` | Hidden | Yes | Yes | VERIFIED |
| `ResultSummaryScreen` (partial) | `getRealScanImageUri(selectedScanImage)` → `Image` | Hidden | Yes | Yes | VERIFIED |
| `ResultSummaryScreen` (no-recipe) | `getRealScanImageUri(selectedScanImage)` → `Image` | Hidden | Yes | Yes | VERIFIED |
| `RecipeDetailScreen` (hero) | `getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage))` → `FoodImage` | Spark icon + label | Yes | Yes | VERIFIED |
| `RecipeStepsScreen` (completion) | `getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage))` → `FoodImage` | Spark icon + label | Yes | Yes | VERIFIED |
| `LibraryScreen.RecipeThumb` | `getRecipeImageUrl(recipe)` → `FoodImage` | Spark icon | Yes (via recipe.imageUri) | Yes (on open) | VERIFIED |
| `HomeScreen` (hero) | `getRecipeImageUrl(heroRecipe, getRealScanImageUri(latestScanSession?.selectedScanImage) ?? getRealScanImageUri(selectedScanImage))` → `FoodImage` | Spark icon | Yes | Yes | VERIFIED |
| `HomeScreen` (recent recipes) | `getRecipeImageUrl(recipe)` → `FoodImage` | Spark icon | Yes (via recipe.imageUri) | No — list items (low noise) | VERIFIED |
| `HomeScreen` (RecommendationCard) | `getRecipeImageUrl(recipe)` → `FoodImage` | Spark icon | No (discover content only) | No — discover content | VERIFIED |
| `ScanScreen` (recent recipe) | `getRecipeImageUrl(recentRecipe)` → `FoodImage` | Spark icon | Yes (via recipe.imageUri) | No — preview only | VERIFIED |
| `ShareCardPreviewScreen` (card) | `(!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe)` → `Image` | No image shown | Yes | Yes | VERIFIED |

## Notes

### AnalysisLoadingScreen — Stage 2 gap

Loading screen shows Kiko mascot + progress steps only. No food photo displayed during the wait. This is intentional product design. The uploaded image arrives in state before the loading screen renders, but the loading screen was designed around Kiko branding rather than the food photo. This is a UX gap, not a persistence bug.

### RecipeStepsScreen — per-step images

Individual cooking steps (e.g., "Heat the pan", "Add ingredients") do not show the user's food photo at each step. Only the completion card shows it. This is also a UX gap, not a persistence bug.

### LibraryScreen trace fires on open, not on render

The `LibraryScreen` trace is attached to `openSavedRecipe()` rather than a `useEffect`. This means it fires when the user taps a saved recipe card, not on initial render. The initial render of all cards is not traced individually to avoid log spam. The trace captures the URI and `fileExists` status of the specific recipe being opened.

### `getRecipeImageUrl(recipe)` with no fallbackUri

Used in: `LibraryScreen.RecipeThumb`, `ScanScreen` recent recipe, `HomeScreen` recent recipes, `RecommendationCard`.

These surfaces rely entirely on `recipe.imageUri` (stamped at save time). No active scan session exists at these points. If `recipe.imageUri` is unset (e.g., recipe saved before the fix), the Spark fallback renders. This is correct behavior.
