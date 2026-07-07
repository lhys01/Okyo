---
name: Okyo Recipe Quality
description: Use when improving recipe generation, ingredient consistency, step coherence, recipe prompts, recipe validation/repair, or running recipe quality evals and model benchmarks.
---

# Okyo Recipe Quality

## When to use this

Any task about what generated recipes contain: ingredient closure, step coherence, prompt changes, quality validation, or model benchmarking.

## Goal

Recipes that are specific, coherent, and honest: every step's ingredients exist in `recipe.ingredients`, strategy stays coherent per dish, "why" text is real, and quality is measured — not assumed.

## Okyo product context

Okyo is an AI food companion, not a calorie tracker, not a generic recipe app, and not a meal planner. Recipes are copycat-style / "inspired-by", never official restaurant recipes. AI output is uncertain — validate and repair, never fake.

## Files to inspect first

- `apps/api/src/services/aiService.ts` (~4,560 lines — navigate by anchor, do not read whole file):
  - Zod schemas: `foodImageAnalysisSchema` ~line 159, `generatedRecipeOutputSchema` ~197
  - `analyzeFoodImage` ~277, `generateRecipeFromDish` ~339, `createAiScan` ~523
  - `normalizeVisionOutput` ~977 (exported, unit-tested), dish-name/ingredient normalization helpers ~1300–1600
- `apps/api/src/services/openRouterProvider.ts` — recipe prompt built via `getRecipePrompt` (called ~line 640); retry prompt ~line 300.
- `apps/api/src/services/recipeIngredientValidation.ts` — ingredient closure (API strip + repair; `recipe.ingredients` is single source of truth).
- `apps/api/src/services/recipeQualityAnalytics.ts` — persistent JSONL quality analytics.
- `apps/api/src/services/scanEvalLogger.ts` — scan eval logging.
- Mobile: `apps/mobile/src/screens/RecipeDetailScreen.tsx` (guided cooking; has post-generation step-reorder safety net so "Serve" never precedes cooking steps).
- `docs/wiki/RECIPE_GENERATION.md`.

## Safe commands

- API typecheck: `cd apps/api && npm run typecheck`
- Model benchmark (5 models × 25 recipes, ranked table): `cd apps/api && npx tsx scripts/model-benchmark.ts` (flags: `--models gemma,mistral`, `--limit 5`)
  - **Cost warning:** benchmark and stress scripts hit live OpenRouter — they need a funded `OPENROUTER_API_KEY` and spend real credits. Start with `--limit 5`, never run the full matrix without the user asking.
- Quality summary: `cd apps/api && npx tsx scripts/recipe-quality-report.ts`
- Stress test: `cd apps/api && npx tsx scripts/quality-stress-test.ts`
- Unit tests (node:test, no npm script wired — inferred invocation): `cd apps/api && npx tsx --test src/services/aiService.scan.test.ts`

## Exact workflow

1. Read `docs/wiki/RECIPE_GENERATION.md`, then the specific pipeline stage involved (prompt → provider parse → normalize → validate → repair → mobile render).
2. Check `docs/audits/` and memory for prior findings before re-diagnosing.
3. Prefer fixing in the right layer: prompt rules in `openRouterProvider.ts`, structural repair in normalization/validation, display filtering only as last-resort in mobile.
4. Keep API and mobile filtering rules identical — a known bug class is regex on API vs exact-string match on mobile letting variants leak.
5. After changes, run `recipe-quality-report.ts` and/or `model-benchmark.ts --limit 5` to prove impact.
6. Typecheck API. Update `docs/wiki/RECIPE_GENERATION.md` if behavior changed.

## Quality bar

- Ingredient closure holds: no step references an ingredient missing from `recipe.ingredients` or the grocery list.
- Strategy coherence generalizes (known gap: coherence rule in prompt is dumpling-specific; hardcoded dish handlers have inconsistent oil quantities).
- Validation that matters blocks or repairs — known gap: current quality validation pass only logs warnings.
- Fail closed: a bad recipe surfaces as failure/retry, never a silently degraded fake.

## Bad patterns to avoid

- Growing `aiService.ts` further — it already violates the 800-line rule; extract new logic into separate services.
- Mock/demo data leaking into real scan paths.
- Prompt edits without running an eval script after.
- Adding a dish-specific hardcoded handler when a general rule is possible.
- Presenting AI cost/nutrition/recipe data as exact.

## Example final output

> Fixed generic "why" leakage. Unified detection: moved regex patterns from API into shared list, mobile filter in `RecipeDetailScreen.tsx` now uses the same patterns instead of exact-string match. Ran `recipe-quality-report.ts`: generic-why rate 14% → 0% over logged sample. API typecheck clean. Test: scan any dish, check step "why" text never reads "This step builds flavor."

## Done checklist

- [ ] Right layer fixed (prompt vs repair vs display)
- [ ] Eval script run, before/after numbers reported
- [ ] `npm run typecheck` clean in `apps/api`
- [ ] `aiService.ts` did not grow materially
- [ ] Wiki page updated if behavior changed
