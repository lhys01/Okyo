# Cost Controls

## Purpose
Documents every guard between a request and a paid AI call.

## Source Files Inspected
`apps/api/src/middleware/costControls.ts`, `apps/api/src/config/costControlConfig.ts`, `apps/api/src/server.ts:96-143`, `apps/api/.env.example`.

## Current Behavior

| Guard | Default | Failure mode |
|---|---|---|
| Per-IP scan rate limit | 10 req / 60 s sliding window | 429 `rate_limit_exceeded` |
| Image payload size | 10 MB (`MAX_SCAN_IMAGE_BYTES`), plus 12 M-char zod cap and 16 MB JSON body limit | 413 `image_payload_too_large` |
| Global daily AI cap | 200 (`AI_DAILY_REQUEST_CAP`), counts only real uploaded images | 429 `ai_daily_cap_exceeded` |
| Fable daily cap | 10, **hard-clamped in code** (env may lower, never raise) | 429 `fable_daily_cap_exceeded` |
| Fable enable gate | `FABLE_ENABLED=false` | 403 `fable_not_enabled` |
| AI master switch | `AI_ENABLED=false` | real scans fail with `AI_UNAVAILABLE` |
| Image generation | kill switch scaffold, `IMAGE_GEN_ENABLED=false` | blocked before any call |

- Counters are in-memory, reset at midnight UTC or on server restart.
- Every decision emits `logCostEvent('<event>', {...})` as `[cost]` log lines (cap increments/exceeds, rate-limit hits, oversized images); IPs are masked before logging.
- Fable has additional `[fable_route]` / `[fable_cap]` logs.

## Important Constraints
- Fable cap must stay separate from the global cap — Fable never shares headroom with cheap traffic.
- The 10-request Fable hard max is a code constant (`FABLE_DAILY_REQUEST_CAP_HARD_MAX`); do not make it env-controlled.
- Cap checks run at the HTTP layer **before** business logic — keep new AI endpoints behind the same pattern.

## Known Risks / Edge Cases
- Restart resets all counters — an attacker forcing restarts bypasses daily caps; move to DB/Redis before public launch.
- Rate limiter keys on `request.ip`; behind a proxy without `trust proxy`, all traffic shares one IP bucket.
- Caps don't account for token-level cost variance; they bound request count only.

## Related Docs
[FABLE_ROUTING.md](./FABLE_ROUTING.md) · [API_BACKEND.md](./API_BACKEND.md) · [SECURITY.md](./SECURITY.md) · legacy [SECURITY_AND_COST_CONTROLS.md](./SECURITY_AND_COST_CONTROLS.md)
