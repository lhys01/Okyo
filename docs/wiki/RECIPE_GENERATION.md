# Recipe Generation

## Purpose
Explain how recipes are generated, structured, retried, repaired, enriched, validated, and delivered.

## Source Files Inspected
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/src/services/epicureService.ts`
- `apps/api/src/services/recipeQualityAnalytics.ts`
- `apps/api/src/store.ts`
- `apps/mobile/src/screens/RecipeDetailScreen.tsx`
- `apps/mobile/src/screens/GroceryListScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`

## Current Behavior
One scan produces one canonical recipe. `Restaurant Copy`, `Budget`, and `Healthy` are view modes/lenses around the recipe rather than separate generated recipes for the current AI scan path.

Generation flow:
- Vision output creates dish context, ingredients, visible components, cuisine, confidence, and cost hints.
- Optional Epicure enrichment adds complementary ingredients and substitutions when enabled or when vision returns inline Epicure data.
- OpenRouter recipe generation asks for one JSON recipe with structured steps.
- Retryable initial failures use a compact retry.
- Structural validation requires usable steps and sequential step numbers; one repair pass is attempted, then generation fails closed.
- Quality validation can attempt one focused repair and keeps the cleaner valid result.
- Platter-style meals can trigger component coverage repair.
- The API converts output into Okyo recipe shape, sanitizes vague copy, builds grocery items, cost estimates, step image prompts, cooking terms, and storage/mistake notes.
- Generated recipes are stored in memory for 24 hours so deferred Guided Cooking coaching can repair weak step coaching later.

## Important Constraints
- Never fabricate a fallback recipe when real generation fails.
- Recipes must remain inspired-by or copycat-style, not official restaurant recipes.
- Cost and confidence are estimates.
- Keep beginner-cook detail: ingredients, tools, timing, visual cues, and safety/why notes where possible.

## Known Risks or Edge Cases
- Model outputs can be invalid JSON, invalid schema, too vague, truncated, or structurally weak.
- The recipe cache is in memory and keyed by analysis/mode with TTL.
- Deferred coaching returns original steps if repair fails; it should not block recipe detail.

## Related Docs
- [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md)
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
