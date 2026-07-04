# Product Overview

## Purpose
Describe what Okyo is, what promise it makes, what it is not, and how product decisions should feel.

## Source Files Inspected
- `AGENTS.md`
- `README.md`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/screens/WelcomeScreen.tsx`
- `apps/mobile/src/data/recommendedRecipes.ts`

## Current Behavior
Okyo is an AI food companion that helps a user turn a restaurant, cafe, takeout, or home food photo into a homemade inspired-by recipe. The core promise is: scan what you want, get a cookable version, understand the likely savings, and save or share the result.

The main three features are:
- Scan a food photo and get a best-guess dish result with confidence.
- Generate a single inspired-by recipe with grocery list and cooking detail.
- Save, share, and revisit recipes through library, grocery, savings, and challenge surfaces.

Okyo should feel cute, clean, simple, friendly, modern, and food-focused. Copy should be casual and hook-first without sounding corporate.

## Important Constraints
- Okyo is not a calorie tracker, generic recipe app, or meal planner.
- Recipes are inspired-by or copycat-style, never official restaurant recipes.
- Food ID, costs, savings, and recipes must be presented as estimates.
- The first session should stay fast: open app, scan meal, see result.

## Known Risks or Edge Cases
- Recommendations and mock recipes can make the app look more complete than the backend currently is.
- Savings can be misleading if restaurant price is guessed too confidently; UI lets users edit price for real scans.
- Viral/share moments should not outrun AI honesty.

## Related Docs
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [RECIPE_GENERATION.md](./RECIPE_GENERATION.md)
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- [KNOWN_RISKS.md](./KNOWN_RISKS.md)
