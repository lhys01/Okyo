# AI Model Routing (Default Path)

## Purpose
Documents how scans route to AI models by default, and what must not change accidentally.

## Source Files Inspected
`apps/api/src/config/aiConfig.ts`, `apps/api/src/config/openRouter.ts`, `apps/api/src/services/aiService.ts`, `apps/api/src/services/openRouterProvider.ts`, `apps/api/.env.example`.

## Current Behavior
- **Provider:** OpenRouter is the only provider (`provider: 'openrouter'`, hardcoded type). All calls hit `https://openrouter.ai/api/v1/chat/completions`.
- **Default models:** `openai/gpt-4o-mini` for both vision (`OPENROUTER_VISION_MODEL`) and recipe text (`OPENROUTER_TEXT_MODEL`) — defaults in `aiConfig.ts:12-13`.
- **Vision path:** `analyzeFoodImage()` → `analyzeFoodImageWithOpenRouter()` — strict JSON contract, quality evaluation, compact/focused retry prompts on weak output.
- **Recipe/text path:** `generateRecipeFromDish()` → `generateRecipeWithOpenRouter()` — uses a failover chain from `getRecipeModelChain()` (`openRouterProvider.ts:540`):
  1. `OPENROUTER_TEXT_MODEL` (default gpt-4o-mini)
  2. `google/gemini-3.1-flash-lite`
  3. `google/gemini-3.5-flash`
  4. optional `RECIPE_PAID_FALLBACK_MODEL` (env, off by default)
  Failover backoff delays: 2 s / 5 s / 10 s. Fallbacks log `recipe_model_fallback`.
- **Epicure enrichment model:** separate `OPENROUTER_MODEL` (default gpt-4o-mini) in `config/openRouter.ts`, used only by the additive ingredient-intelligence layer; fail-open (recipe generation proceeds without it).
- **Kill switches:** `AI_ENABLED=false` disables all real AI; missing `OPENROUTER_API_KEY` has the same effect.
- **Fable exception:** when a request is Fable-active, both vision and text models are swapped to `FABLE_MODEL` and the failover chain collapses to that single model — see [FABLE_ROUTING.md](./FABLE_ROUTING.md).

## Important Constraints (Do Not Change Accidentally)
- OpenRouter/gpt-4o-mini stays the default path unless explicitly changed by the user.
- Models must be read from config, never hardcoded in services.
- `aiSourceSchema` only allows `'openrouter_ai'` — adding sources is a deliberate schema change.
- Fable must never join the default chain, and the default chain must never silently apply to Fable requests.

## Known Risks / Edge Cases
- Gemini fallback models change behavior/quality mid-chain — fallback use is logged, watch for it in QA.
- `RECIPE_PAID_FALLBACK_MODEL` can add unexpected cost if set carelessly.

## Related Docs
[FABLE_ROUTING.md](./FABLE_ROUTING.md) · [RECIPE_GENERATION.md](./RECIPE_GENERATION.md) · [COST_CONTROLS.md](./COST_CONTROLS.md) · legacy [AI_PIPELINE.md](./AI_PIPELINE.md)
