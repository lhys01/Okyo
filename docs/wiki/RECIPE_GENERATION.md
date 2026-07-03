# Recipe Generation

## Purpose
Explains how a recipe is generated, retried, repaired, enriched, and validated after a successful vision analysis.

## Source Files Inspected
`apps/api/src/services/aiService.ts` (`generateRecipeFromDish`, `createAiScan`, `enrichRecipeCoaching`, normalization helpers), `apps/api/src/services/openRouterProvider.ts` (`generateRecipeWithOpenRouter`, `validateRecipeStructure`, failover/repair helpers), `apps/api/src/services/recipeIngredientValidation.ts`, `apps/api/src/services/epicureService.ts`, `apps/api/src/store.ts`.

## Current Behavior
1. **One recipe per scan.** `generateRecipeFromDish()` produces a single AI recipe; the Restaurant Copy / Budget / Healthy modes are view projections, not separate generations.
2. **Recipe cache:** keyed by analysis + mode, TTL `RECIPE_CACHE_TTL_DAYS` (default 7 d). Hit skips Epicure and generation entirely.
3. **Epicure enrichment (additive, fail-open):** ingredient pairings and healthy/budget substitutions enrich the prompt. Preferred source is inline `epicureSuggestions` from the vision call (saves ~8-12 s); otherwise a separate call with a 12 s timeout. Any failure → `null` enrichment, generation proceeds unchanged.
4. **Generation with failover:** prompt built by `getRecipePrompt()`; the model chain from `getRecipeModelChain()` is tried with backoff (2/5/10 s) via `callOpenRouterJsonWithFailover`. Fable-active requests use a single-model chain (fail closed).
5. **Structure enforcement:** `validateRecipeStructure()` checks required fields; failures trigger a structure-repair prompt (`getRecipeStructureRepairPrompt`) and retry. Quality checks reject vague ingredients ("protein", "sauce"), vague steps ("cook until done"), and missing amounts, with repair prompts.
6. **Ingredient closure:** `recipeIngredientValidation.ts` enforces `recipe.ingredients` as the single source of truth — every `step.ingredientsUsed` entry and grocery item must resolve to a recipe ingredient via a culinary synonym map (scallion/green onion, cilantro/coriander, …) plus plural stripping and substring matching. Pure functions, no AI calls.
7. **Post-processing:** step image prompts added per step; step reorder safety net keeps "Serve" after cooking steps; grocery items regenerate from merged components.
8. **Deferred coaching:** generated recipes are stored 24 h in `generatedRecipeStore`; `POST /v1/recipes/:id/coaching` enriches steps on demand (`enrichRecipeCoaching`), returning 404 after expiry.
9. **Fail-closed:** if `aiSource !== 'openrouter_ai'` or the recipe is missing for a real uploaded image, `createAiScan` throws (`RECIPE_GENERATION_FAILED` / `RECIPE_MISSING`) — never a partial or mock result.

## Important Constraints
- Never bypass structural validation to "make a scan succeed" — the fail-closed behavior is a product decision.
- Prompts and JSON contracts live in `openRouterProvider.ts`; keep contract and zod schema in sync.
- Recipes are inspired-by; copy must not claim official restaurant provenance.

## Known Risks / Edge Cases
- Free/cheap models return truncated or non-JSON output — handled by `OpenRouterFailureReason` taxonomy and retries, but adds latency.
- Synonym map is finite; exotic ingredient aliases may fail closure matching and trigger repair.
- Cache can serve a stale recipe after prompt improvements (bump `RECIPE_PIPELINE_VERSION`).

## Related Docs
[AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md) · [SCAN_FLOW.md](./SCAN_FLOW.md) · [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md) · legacy [AI_PIPELINE.md](./AI_PIPELINE.md), [COST_ENGINE.md](./COST_ENGINE.md)
