# Data and Mocks

## Purpose
Explain mock recipes, recommended recipes, food assets, scan mock data, and where they are used.

## Source Files Inspected
- `apps/api/src/mockData.ts`
- `apps/api/src/store.ts`
- `apps/mobile/src/mocks/*.ts`
- `apps/mobile/src/data/recommendedRecipes.ts`
- `apps/mobile/src/data/sampleFoodImages.ts`
- `apps/mobile/assets/food/index.ts`
- `docs/seed/*`

## Current Behavior
The API has mock scan results, recipes, grocery lists, share cards, restaurant packs, XP events, badges, and leaderboard data. These back routes like recipes, library, savings, challenges, rankings, and packs.

The mobile app has its own mock data module for UI fallbacks, saved library flows, default demo result, restaurant packs, grocery lists, share cards, and XP. It also has recommendation recipes that are not scan results; these appear as food inspiration and use home-kitchen cost estimates with zero fake savings.

Sample food image URLs and bundled assets provide fallbacks for cards, onboarding, and demo/mock recipes. Real scan images are shown from local copied user photos when available.

## Important Constraints
- Mock data is for demo/support flows and should not replace a failed real uploaded image scan.
- Recommended recipes should not fake restaurant savings.
- Keep mock API/mobile shapes aligned with shared concepts like recipe modes and scan states.
- Avoid adding huge generated datasets without a clear product need.

## Known Risks or Edge Cases
- API and mobile mock data are duplicated rather than generated from one source.
- Existing docs may call the current app “fake-data V1,” but the scan endpoint now has real AI paths.
- Recommendation images can come from local assets, Pexels CDN, or category fallbacks.

## Related Docs
- [RECIPE_GENERATION.md](./RECIPE_GENERATION.md)
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)
