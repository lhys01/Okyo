# AI routing and recipe quality

This document preserves the operational lessons needed to change Okyo's AI path safely. Runtime code and app-specific `.env.example` files remain authoritative for exact configuration.

## Routing contract

- OpenRouter is the only always-on provider.
- Vision and recipe text default to `openai/gpt-4o-mini`.
- Recipe text may use the explicit fallback chain in `openRouterProvider.ts`: `google/gemini-3.1-flash-lite`, then `google/gemini-3.5-flash`.
- A configured `RECIPE_PAID_FALLBACK_MODEL` is optional and produces a startup warning because it can increase spend.
- Fable is a model selection on OpenRouter, not a second provider. It requires both `FABLE_ENABLED=true` and `x-okyo-model: fable`, is hard-capped at 10 attempts per UTC day, and fails closed without cross-model fallback.
- Epicure enrichment is optional. When disabled, unconfigured, slow, or invalid, it contributes no context and cannot block the base recipe path.

Relevant code:

- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/config/openRouter.ts`
- `apps/api/src/config/costControlConfig.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/src/middleware/costControls.ts`

## Failure and privacy rules

- A real uploaded-image failure never becomes a demo recipe.
- Non-food, unclear-food, provider, validation, persistence, and timeout outcomes remain distinct and user-friendly.
- Treat model output as untrusted. Parse it, validate it, repair only within the bounded repair budget, and fail when the final contract is still unsafe.
- Do not log keys, bearer tokens, full image data, raw provider responses, or persistent dish-level JSONL files from normal traffic.
- Images are transient API input. The mobile app makes a local durable copy only when the user saves a recipe.

## Recipe quality contract

A delivered recipe should have:

- the scanned dish identity or an explicit best guess;
- ingredient closure between the ingredient list, steps, and grocery derivation;
- coherent component coverage for platters and multi-part dishes;
- ordered, actionable steps with observable doneness cues;
- honest substitutions and tradeoffs;
- inspired-by language, never claims of an official restaurant formula.

Recipe Check and Make It Mine accept flexible client recipes but enforce request-size, title, and collection bounds in `apps/api/src/routes/recipeInput.ts`.

## Model-change procedure

1. Verify the OpenRouter account is funded and the current model is available before changing architecture. An unfunded account previously looked like a pipeline failure.
2. Change one variable at a time: model, timeout, token budget, or prompt—not all of them together.
3. Run API tests and build.
4. If credentials and spend are explicitly approved, run a small quality sample first:

   ```bash
   cd apps/api
   npx tsx scripts/quality-stress-test.ts --limit 1 --concurrency 1
   ```

5. Manually test clear food, uncertain food, partial food, non-food, and an intentionally unavailable provider.
6. Compare recipe closure, component coverage, latency, token usage, and failure rate before accepting a model change.

The quality stress script makes paid provider calls when AI is enabled. Never run its full matrix without explicit approval and a funded key.
