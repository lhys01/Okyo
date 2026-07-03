# Image System

## Purpose
Documents food/mascot assets, recipe images, fallbacks, and scan-image persistence.

## Source Files Inspected
`apps/mobile/assets/food/index.ts`, `apps/mobile/assets/mascot/index.ts`, `apps/mobile/assets/animations/animation_manifest.json`, `apps/mobile/src/utils/scanImageStorage.ts`, `apps/mobile/src/utils/savedRecipeImage.ts`, `apps/mobile/src/utils/recipeImages.ts`, `apps/mobile/src/components/FoodImage.tsx`, `apps/mobile/src/data/sampleFoodImages.ts`, `scripts/download-food-images.sh`.

## Current Behavior
- **Category fallbacks:** `foodAssets` bundles six category PNGs (bowl, breakfast, burger, dessert, pasta, salad) used by OnboardingUI, ScanScreen, and anywhere a specific image is missing.
- **Per-recipe images:** `recipeAssets` maps ~60 recipe slugs to bundled PNGs for Home/Discover recommendation cards. Placeholders ship in git; `scripts/download-food-images.sh` swaps in real Pexels photos, then restart Expo with `expo start -c`.
- **Sample food images:** `sampleFoodImages.ts` provides remote sample URLs for demo scans.
- **Scan image persistence:** `scanImageStorage.copyToDocuments()` copies a real user photo from the OS cache into `Documents/okyo-scan-images/` (permanent, survives cold restart and cache eviction). Fails soft — returns the original image if the copy fails. `recipe.imageUri` pointing at this permanent copy is the canonical image for a scanned recipe; `savedRecipeImage.ts` resolves images for the saved library.
- **Animations:** `assets/animations/` with `animation_manifest.json` describing Kiko/loading animation assets.
- **API side:** the API never stores images; the scan response strips the base64 data URL and returns `hasDataUrl` instead.

## Important Constraints
- Do not store user food images server-side unless the user saves a recipe or opts in.
- Never log full base64 image payloads.
- `assets/` is ~51 MB — think before adding more bundled PNGs.

## Known Risks / Edge Cases (Ownership)
- Pexels photos have their own license terms — verify before App Store distribution; bundled placeholder art provenance should be tracked.
- Stale-image contamination bugs were fixed by making `recipe.imageUri` canonical — don't reintroduce parallel image fields.
- Documents-dir copies accumulate; no cleanup job exists yet.

## Related Docs
[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [SCAN_FLOW.md](./SCAN_FLOW.md) · [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md) · [KNOWN_RISKS.md](./KNOWN_RISKS.md)
