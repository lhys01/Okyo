# Cost Controls

## Purpose
Explain request caps, Fable cap, global AI cap, cost middleware, and failure modes.

## Source Files Inspected
- `apps/api/src/config/costControlConfig.ts`
- `apps/api/src/middleware/costControls.ts`
- `apps/api/src/server.ts`
- `apps/api/.env.example`
- `apps/api/src/services/openRouterProvider.ts`

## Current Behavior
Cost controls are currently in-memory:
- Per-IP scan rate limit: `SCAN_RATE_LIMIT_WINDOW_MS`, `SCAN_RATE_LIMIT_MAX`.
- Global daily AI request cap: `AI_DAILY_REQUEST_CAP`, reset at midnight UTC or process restart.
- Maximum scan image payload: `MAX_SCAN_IMAGE_BYTES`.
- Fable daily cap: `FABLE_DAILY_REQUEST_CAP`, hard-clamped to 10.
- Image generation kill switch scaffold: `IMAGE_GEN_ENABLED`, `IMAGE_GEN_DAILY_REQUEST_CAP`.

`POST /v1/scans` applies rate limiting to all scan requests, rejects oversized image payloads with 413, increments the global AI cap only for real uploaded images, and increments the Fable cap only after Fable is requested and enabled.

Failure modes include 429 `rate_limit_exceeded`, 429 `ai_daily_cap_exceeded`, 429 `fable_daily_cap_exceeded`, 413 `image_payload_too_large`, and 403 `fable_not_enabled`.

## Important Constraints
- Fable cap must stay separate from the default AI cap.
- Fable cap is hard-clamped to 10 even if env is set higher.
- In-memory counters are not production-grade.
- AI provider failures should not produce fake successful scans for real uploads.

## Known Risks or Edge Cases
- Process restart resets all counters.
- IP limiting does not trust proxy headers; configure trusted proxy before deployment behind a load balancer.
- Recipe retries/repairs/failovers can multiply provider calls within one scan.
- Optional paid fallback model can increase cost if configured.

## Related Docs
- [FABLE_ROUTING.md](./FABLE_ROUTING.md)
- [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md)
- [SECURITY.md](./SECURITY.md)
- [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)
