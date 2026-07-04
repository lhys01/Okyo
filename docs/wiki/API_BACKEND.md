# API Backend

## Purpose
Document the Express API server, scan endpoint, AI service, OpenRouter provider, cost controls, store, and config.

## Source Files Inspected
- `apps/api/package.json`
- `apps/api/src/server.ts`
- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/config/costControlConfig.ts`
- `apps/api/src/config/openRouter.ts`
- `apps/api/src/middleware/costControls.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/src/services/epicureService.ts`
- `apps/api/src/store.ts`
- `apps/api/src/mockData.ts`
- `apps/api/.env.example`

## Current Behavior
The API is a TypeScript Express app on port `8081` by default. It exposes health, scan, recipe, library, savings, challenge, XP, rankings, restaurant pack, and deferred coaching routes.

`POST /v1/scans` validates JSON with Zod, accepts optional image metadata and data URLs, enforces image size and rate/cost limits, handles optional Fable routing, then calls `createAiScan`.

`createAiScan` requires real uploaded images to have AI enabled, an OpenRouter key, and provider-visible image data. It runs vision analysis, gates non-food or unclear photos, generates a recipe, estimates costs, builds grocery/share data, logs evaluation metadata, and caches same-image scans in memory.

The store is in memory. Mock data backs library-style routes and demo data, while generated recipes are stored for 24-hour deferred coaching.

## Important Constraints
- Do not expose `.env` secrets or raw base64 image payloads.
- OpenRouter model defaults live in config, not scattered through code.
- API errors shown to users should be friendly and non-technical.
- Move in-memory caps/stores to persistent infrastructure before public launch.

## Known Risks or Edge Cases
- Existing `README.md` says the app falls back to mock data more broadly than the current fail-closed uploaded-image code does.
- `GET /debug/ai-config` is dev-only and hides the key, but still reveals model/cap state.
- Recipe quality analytics write to `apps/api/data/`, which is gitignored runtime data.

## Related Docs
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md)
- [FABLE_ROUTING.md](./FABLE_ROUTING.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
- [SECURITY.md](./SECURITY.md)
