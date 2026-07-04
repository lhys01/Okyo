# Image System

## Purpose
Document local food assets, recipe images, fallback images, animation assets, image persistence/storage, and image ownership risks.

## Source Files Inspected
- `apps/mobile/assets/food/index.ts`
- `apps/mobile/assets/mascot/index.ts`
- `apps/mobile/assets/animations/animation_manifest.json`
- `apps/mobile/src/components/FoodImage.tsx`
- `apps/mobile/src/components/KikoMascot.tsx`
- `apps/mobile/src/data/sampleFoodImages.ts`
- `apps/mobile/src/data/recommendedRecipes.ts`
- `apps/mobile/src/utils/recipeImages.ts`
- `apps/mobile/src/utils/scanImageStorage.ts`
- `apps/mobile/src/utils/savedRecipeImage.ts`
- `scripts/download-food-images.sh`
- `docs/audits/IMAGE_OWNERSHIP_REPORT.md`
- `docs/audits/IMAGE_STORAGE_STRATEGY.md`

## Current Behavior
Image sources include:
- Bundled category food fallback images in `apps/mobile/assets/food/sample-*.png`.
- Per-recipe bundled images in `apps/mobile/assets/food/recipes/*.png`.
- Kiko mascot PNGs in `apps/mobile/assets/mascot`.
- Kiko GIF/MP4 animation assets with a manifest in `apps/mobile/assets/animations`.
- Recommendation images from local assets first, Pexels CDN second, category fallback third.
- User scan photos copied into app Documents under `okyo-scan-images/`.

Mobile attaches the real user scan image to a saved recipe only when the user saves it. Real uploaded/camera images beat generated or bundled artwork. Placeholder/demo images should not be attached as real saved recipe images.

## Important Constraints
- Do not store user food images beyond scan continuity/save behavior unless the user opts in.
- Never send local `file://` URIs as if they are provider-visible; use data URLs or remote URLs.
- Do not edit/generated asset folders casually.
- Track license/source for any new food imagery.

## Known Risks or Edge Cases
- `apps/mobile/assets` is about 51 MB; generated asset churn can bloat the repo.
- `docs/generated` contains generated screen images and should not be treated as app source.
- Pexels IDs in recommendation seed data rely on remote CDN availability.
- Old unused scan images are cleaned only when replaced/cleared relative to saved recipes.

## Related Docs
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [SECURITY.md](./SECURITY.md)
- [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md)
- [KNOWN_RISKS.md](./KNOWN_RISKS.md)
