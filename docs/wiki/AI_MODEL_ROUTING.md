# AI Model Routing

## Purpose
Explain default model routing, OpenRouter usage, vision/text paths, fallback behavior, and what must not change accidentally.

## Source Files Inspected
- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/config/openRouter.ts`
- `apps/api/src/server.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/.env.example`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/api/config.ts`

## Current Behavior
The default scan and recipe path is OpenRouter using `openai/gpt-4o-mini` for both `OPENROUTER_VISION_MODEL` and `OPENROUTER_TEXT_MODEL` unless env vars override them.

Vision path:
- `analyzeFoodImage` calls `analyzeFoodImageWithOpenRouter`.
- The request includes image data when a safe data URL or remote URL is available.
- Output is parsed and normalized into food state, dish guess, visible ingredients, likely ingredients, costs, confidence, and possible names.

Recipe path:
- `generateRecipeFromDish` calls `generateRecipeWithOpenRouter`.
- The provider asks for one structured JSON recipe.
- The recipe path has retry/repair gates for compact prompts, structure, quality, and component coverage.

Fallback behavior:
- Normal recipe generation can fail over on retryable errors through `google/gemini-3.1-flash-lite`, `google/gemini-3.5-flash`, and optional `RECIPE_PAID_FALLBACK_MODEL`.
- Vision has a compact retry for retryable output errors.
- Real uploaded image provider failure bubbles to a failure state; it must not silently become the default mock pasta result.
- Fable-active recipe generation does not use the Gemini chain.

Epicure is a separate additive enrichment flag using `OPENROUTER_MODEL`; it must not block base recipe generation.

## Important Constraints
- OpenRouter / `openai/gpt-4o-mini` remains the default model path unless explicitly changed.
- Model IDs should be read from config/env, not hardcoded in feature code.
- Fable must be opt-in, private, capped, and fail-closed.
- Never present AI outputs as exact.

## Known Risks or Edge Cases
- The normal recipe failover chain is useful for availability but can hide model-specific quality changes.
- Fable must not inherit the normal recipe failover chain.
- OpenRouter failures can be network, timeout, HTTP, empty content, invalid JSON, invalid schema, or output truncation.

## Related Docs
- [FABLE_ROUTING.md](./FABLE_ROUTING.md)
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [RECIPE_GENERATION.md](./RECIPE_GENERATION.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
