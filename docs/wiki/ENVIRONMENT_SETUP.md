# Environment Setup

## Purpose
List required environment variables for API and mobile, including opt-in/dev-only Fable variables.

## Source Files Inspected
- `apps/api/.env.example`
- `apps/mobile/.env.example`
- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/config/costControlConfig.ts`
- `apps/api/src/config/openRouter.ts`
- `apps/mobile/src/api/config.ts`

## Current Behavior
API env:
- `AI_ENABLED`: master switch for real AI calls; default false in example.
- `AI_PROVIDER`: currently `openrouter`.
- `OPENROUTER_API_KEY`: backend-only secret.
- `OPENROUTER_VISION_MODEL`: default `openai/gpt-4o-mini`.
- `OPENROUTER_TEXT_MODEL`: default `openai/gpt-4o-mini`.
- `AI_TIMEOUT_MS`: default 45000.
- `AI_MAX_OUTPUT_TOKENS`: default 1024.
- `EPICURE_ENABLED`: additive enrichment flag, default false.
- `OPENROUTER_MODEL`: Epicure model, default `openai/gpt-4o-mini`.
- `RECIPE_CACHE_TTL_DAYS`: recipe cache TTL.
- `EPICURE_TIMEOUT_MS`: enrichment timeout.
- `AI_DAILY_REQUEST_CAP`, `MAX_SCAN_IMAGE_BYTES`, `SCAN_RATE_LIMIT_WINDOW_MS`, `SCAN_RATE_LIMIT_MAX`.
- `IMAGE_GEN_ENABLED`, `IMAGE_GEN_DAILY_REQUEST_CAP`: future scaffold.

Fable API env, opt-in:
- `FABLE_ENABLED=false`
- `FABLE_MODEL=anthropic/claude-fable-5`
- `FABLE_DAILY_REQUEST_CAP=10`, hard-clamped to 10.

Mobile env:
- `EXPO_PUBLIC_OKYO_API_URL`: API base URL.
- `EXPO_PUBLIC_OKYO_DEV_AI_MODEL=fable`: dev-only private model override; only `"fable"` is honored and only in `__DEV__`.

## Important Constraints
- Do not commit actual `.env` files.
- `OPENROUTER_API_KEY` belongs only on the API side.
- Fable requires both server env and request header.
- Mobile dev override must remain unavailable in production builds.

## Known Risks or Edge Cases
- Missing API URL falls back to a local LAN IP in dev, which may be wrong.
- `AI_ENABLED=false` makes real uploaded scans fail even if the rest of the app runs.
- Missing OpenRouter key also makes real uploaded scans fail.

## Related Docs
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md)
- [FABLE_ROUTING.md](./FABLE_ROUTING.md)
- [SECURITY.md](./SECURITY.md)
