# Epicure — Ingredient Intelligence Layer

Epicure is an **additive** enrichment layer that makes generated recipes smarter by
feeding ingredient relationships into the recipe prompt. It does **not** replace the
existing scan → recipe generation system. If Epicure is disabled or fails, recipe
generation behaves exactly as before.

## Flow

```
Image
  → dish analysis            (unchanged)
  → ingredient extraction    (visibleIngredients + likelyIngredients from analysis)
  → Epicure enrichment       (NEW — getEpicureSuggestions / enrichRecipeContext)
  → recipe generation        (prompt now includes optional Epicure section)
  → recipe display           (unchanged)
```

## What Epicure adds

Given the detected ingredients, a food-intelligence model returns:

```json
{
  "complementaryIngredients": ["basil", "parmesan"],
  "healthySubstitutions": { "cream": "greek yogurt" },
  "budgetSubstitutions": { "parmesan": "pecorino" }
}
```

These are injected into the recipe prompt as **optional guidance** ("use when helpful,
but do not force them"). Mode-specific emphasis:

| Mode            | Prioritizes                |
| --------------- | -------------------------- |
| Restaurant Copy | complementary ingredients  |
| Healthy         | healthy substitutions      |
| Budget          | budget substitutions       |

## Configuration

Environment variables (see `apps/api/.env.example`):

| Variable             | Default                                          | Purpose                                                        |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `EPICURE_ENABLED`    | `false`                                          | Master feature flag. `true` enables enrichment.               |
| `OPENROUTER_API_KEY` | _(required)_                                     | Shared OpenRouter key (also used by vision/text models).      |
| `OPENROUTER_MODEL`   | `nvidia/llama-3.3-nemotron-super-49b-v1:free`    | Food-intelligence model used **only** by Epicure.             |
| `EPICURE_TIMEOUT_MS` | `12000`                                          | Max time for an enrichment call before falling back.          |
| `EPICURE_ANALYTICS`  | _(on)_                                           | Set to `off` to disable the JSONL usage log.                  |

On startup the server prints whether Epicure is on, off, or misconfigured
(`validateEpicureConfigAtStartup`). Missing key + enabled flag → warning, enrichment
silently skipped.

> Model IDs are read only from `apps/api/src/config/openRouter.ts`. Do not hardcode
> the Epicure model anywhere else.

## Feature flag / safety guarantees

- `EPICURE_ENABLED=false` (or no key) → `enrichRecipeContext` returns `null` and the
  recipe prompt is built byte-for-byte as before.
- Every provider failure (timeout, HTTP error, bad JSON) is swallowed; enrichment
  resolves to empty and recipe generation proceeds normally.
- Enrichment never throws into the recipe path and runs before generation, bounded by
  `EPICURE_TIMEOUT_MS`.

## Analytics

Each enrichment attempt logs an `epicure_usage` event (and a JSONL row at
`apps/api/data/epicure-analytics.jsonl` unless disabled):

```json
{ "epicureUsed": true, "ingredientCount": 5, "suggestionCount": 4, "generationMode": "Healthy" }
```

## Key files

| File                                          | Role                                                          |
| --------------------------------------------- | ------------------------------------------------------------- |
| `src/config/openRouter.ts`                    | Epicure OpenRouter config, feature flag, startup validation.  |
| `src/services/epicureService.ts`              | `getEpicureSuggestions`, `enrichRecipeContext`, prompt builder. |
| `src/services/epicureAnalytics.ts`            | Best-effort usage logging.                                    |
| `src/services/openRouterProvider.ts`          | Calls `enrichRecipeContext` and injects the prompt section.   |
| `src/services/epicureService.test.ts`         | Unit tests (flag, missing key, JSON shape, mode behavior).    |

## Tests

```bash
cd apps/api
npx tsx --test src/services/epicureService.test.ts
```
