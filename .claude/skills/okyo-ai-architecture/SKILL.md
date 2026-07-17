---
name: okyo-ai-architecture
description: Safely change Okyo model routing, OpenRouter configuration, Fable gates, fallbacks, timeouts, quotas, latency, cost controls, or provider evaluation. Use for any provider/model/configuration change.
---

# Okyo AI architecture

Read `docs/AI_AND_RECIPE_QUALITY.md` and the relevant configuration before editing.

## Preserve the routing contract

- Keep OpenRouter as the only always-on provider.
- Keep `openai/gpt-4o-mini` as the default vision and text model unless the user explicitly approves a change.
- Treat the recipe fallback list in `openRouterProvider.ts` as intentional and review its cost before editing it.
- Activate Fable only when both `FABLE_ENABLED=true` and `x-okyo-model: fable` are present. Keep the code-level cap at 10 or lower and fail closed without another model.
- Keep Epicure optional and non-blocking.

Inspect:

- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/config/openRouter.ts`
- `apps/api/src/config/costControlConfig.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/src/middleware/costControls.ts`

## Diagnose before changing architecture

1. Confirm the OpenRouter account is funded and the configured model is available. An unfunded account previously appeared to be an architecture failure.
2. Identify the failing stage from existing timing and provider telemetry.
3. Change one variable at a time.
4. Keep model output schema-validated and bounded.
5. Run API typecheck, tests, and build.
6. Run paid quality scripts only with explicit approval; start with `--limit 1 --concurrency 1`.

Never log keys, full images, bearer tokens, or raw provider payloads. Report what was locally verified versus what still needs a funded live call.
