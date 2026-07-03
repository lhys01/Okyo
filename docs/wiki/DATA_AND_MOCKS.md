# Data And Mocks

## Purpose
Where mock/seed data lives and where it's allowed to appear.

## Source Files Inspected
`apps/api/src/mockData.ts`, `apps/api/src/store.ts`, `apps/mobile/src/mocks/*`, `apps/mobile/src/data/recommendedRecipes.ts`, `apps/mobile/src/data/sampleFoodImages.ts`, `apps/mobile/assets/food/index.ts`.

## Current Behavior
- **API mock data** (`apps/api/src/mockData.ts`): seeded recipes, scan results, grocery lists, share cards, XP/badges, leaderboards, restaurant packs. Serves the non-scan endpoints (`/v1/library`, `/v1/rankings/weekly`, `/v1/restaurant-packs`, …) and demo/mock scans.
- **Mobile mocks** (`apps/mobile/src/mocks/`): typed mirrors of the same domain (recipes, scanResults, groceryLists, shareCards, xp, restaurantPacks) plus `safeData.ts` defensive accessors. Barrel-exported via `mocks/index.ts`; most screens import types from here.
- **Recommended recipes** (`src/data/recommendedRecipes.ts`): curated, real, cookable seed recipes for Home/Discover so the app feels alive pre-scan. Honest by design: `estimatedSavings: 0` (no scanned restaurant price), clearly-labeled home-cost estimates.
- **Sample food images** (`src/data/sampleFoodImages.ts`) and bundled `foodAssets`/`recipeAssets` ([IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)).
- **Validation datasets** (`apps/api/data/*.json`) and benchmark scripts (`apps/api/scripts/`): offline model-quality tooling, not runtime data.

## Important Constraints
- **The mock pasta rule:** the default mock result (Spicy Vodka Rigatoni) must only appear in explicit demo/mock mode — never as a stand-in for a failed real scan.
- Real uploaded-image failures are fail-closed errors, not mock fallbacks ([SCAN_FLOW.md](./SCAN_FLOW.md)).
- Keep mobile and API mock type shapes aligned when editing either.

## Known Risks / Edge Cases
- Two mock domains (API + mobile) can drift — there is no shared package; sync by hand.
- Seeded savings/leaderboard numbers look real in screenshots; label them in marketing use.

## Related Docs
[STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) · [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md) · legacy [DATA_MODEL.md](./DATA_MODEL.md), [FAKE_V1_STATUS.md](./FAKE_V1_STATUS.md)
