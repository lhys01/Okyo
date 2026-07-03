# API Backend

## Purpose
Overview of the Express API in `apps/api`.

## Source Files Inspected
`apps/api/package.json`, `src/server.ts`, `src/store.ts`, `src/mockData.ts`, `src/config/aiConfig.ts`, `src/config/costControlConfig.ts`, `src/config/openRouter.ts`, `src/middleware/costControls.ts`, `src/services/aiService.ts`, `src/services/openRouterProvider.ts`, `.env.example`.

## Current Behavior
- **Stack:** Express 4 + TypeScript (ESM, `tsx watch` dev), Zod validation, dotenv (loads repo-root `.env` then `apps/api/.env`). Port 8081 (override `PORT`). No database — everything in memory.
- **Endpoints:** `GET /health`, `GET /debug/ai-config` (404 in production), `POST /v1/scans`, `GET /v1/scans/:id`, `GET /v1/recipes/:id`, `POST /v1/recipes/:id/save`, `POST /v1/recipes/:id/coaching`, `GET /v1/library`, `GET /v1/savings`, `POST /v1/challenges`, `POST /v1/xp-events`, `GET /v1/rankings/weekly`, `GET /v1/restaurant-packs(/:id)`.
- **Scan endpoint** (`POST /v1/scans`, `server.ts:96`): per-IP rate limit middleware → zod schema (base64 jpeg/png/webp data URL, ≤12 M chars; JSON body limit 16 MB) → configurable image-size guard (413) → global daily AI cap (429) → Fable opt-in gates (403/429, [FABLE_ROUTING.md](./FABLE_ROUTING.md)) → `createAiScan()` → 201 with the data URL stripped from the echoed image metadata (`hasDataUrl` boolean instead).
- **AI service** (`services/aiService.ts`): orchestrates vision analysis → food gate → recipe generation → cost estimate; fail-closed on any real-image failure ([RECIPE_GENERATION.md](./RECIPE_GENERATION.md)).
- **OpenRouter provider** (`services/openRouterProvider.ts`): the only outbound AI integration — chat-completions endpoint, JSON contracts, retries, model failover chain, recipe cache.
- **Store** (`store.ts`): in-memory saved recipes, challenges, XP events; `generatedRecipeStore` keeps AI recipes for 24 h so `/coaching` can enrich them later.
- **Errors:** central handler maps `FoodRejectionError` → 422 (with `rejectionType`, `scanState`, `confidence`), payload-too-large → 413, ZodError → 400, everything else → 500. Envelope: `{ ok, data }` / `{ ok: false, error }`.

## Important Constraints
- All config via env vars with safe defaults (`AI_ENABLED=false` default) — see [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md).
- Verbose scan logging is `NODE_ENV !== 'production'` only; never logs full base64 payloads or keys.
- `dist/` and `logs/` in `apps/api` are build/runtime output — don't edit.

## Known Risks / Edge Cases
- In-memory caps/caches/library reset on restart — needs DB/Redis before public launch.
- Rate limiter trusts `request.ip` — configure trusted proxy before deploying behind a load balancer.

## Related Docs
[AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md) · [COST_CONTROLS.md](./COST_CONTROLS.md) · [SCAN_FLOW.md](./SCAN_FLOW.md) · [SECURITY.md](./SECURITY.md) · legacy [API_SPEC.md](./API_SPEC.md)
