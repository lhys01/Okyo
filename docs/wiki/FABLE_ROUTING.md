# Fable Routing

## Purpose
Document the Phase 1/Phase 2 Fable implementation, guardrails, request header, mobile dev override, fail-closed behavior, and validation checklist.

## Source Files Inspected
- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/config/costControlConfig.ts`
- `apps/api/src/middleware/costControls.ts`
- `apps/api/src/server.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/.env.example`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/api/config.ts`
- `apps/mobile/.env.example`
- `docs/audits/FABLE5_PROVIDER_DESIGN.md`

## Current Behavior
Phase 1 Fable is implemented as an OpenRouter model selection, not a separate SDK provider. The default model path is unchanged unless a request explicitly opts in.

Required API conditions:
- `FABLE_ENABLED=true`
- `FABLE_MODEL=anthropic/claude-fable-5` or another explicit model ID
- `FABLE_DAILY_REQUEST_CAP`, hard-clamped to 10
- request header `x-okyo-model: fable`

If the header is present while `FABLE_ENABLED` is false, `/v1/scans` returns 403 `fable_not_enabled`. If the Fable daily cap is exceeded, it returns 429 `fable_daily_cap_exceeded`.

When active, `getAiConfig({ fableActive: true })` swaps both vision and text models to `FABLE_MODEL`. `getRecipeModelChain` returns only that model, so Fable recipe generation never silently falls back to Gemini or the default cheaper model.

Mobile has a dev-only override: `EXPO_PUBLIC_OKYO_DEV_AI_MODEL=fable` sets `OKYO_DEV_MODEL_OVERRIDE` only when `__DEV__` is true, and `client.ts` adds the header only for `/v1/scans`.

## Important Constraints
- Fable is opt-in only. There is no public UI toggle.
- Fable requires both server env and private request header.
- Fable must fail closed with no silent Gemini fallback and no silent default OpenRouter fallback.
- The Fable cap is separate from the global AI cap.
- Keep Fable usage internal/staff/dev unless a product decision explicitly changes it.

## Known Risks or Edge Cases
- Fable is expensive relative to `gpt-4o-mini`; misconfigured caps create cost exposure.
- It still uses the same `OPENROUTER_API_KEY`, so key absence fails the whole real scan path.
- Phase 2 may revisit provider architecture, but must preserve explicit opt-in and fail-closed semantics.

## Validation Checklist
- `FABLE_ENABLED=false` plus `x-okyo-model: fable` returns 403.
- `FABLE_ENABLED=true` plus header routes vision and text model metadata to `FABLE_MODEL`.
- Fable cap hit returns 429.
- Fable provider failure returns a scan failure, not Gemini/default-model output.
- Production mobile build does not send `x-okyo-model`.

## Related Docs
- [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)
