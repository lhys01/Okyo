# Environment Setup

## Purpose
Every environment variable for API and mobile, with defaults and safety notes.

## Source Files Inspected
`apps/api/.env.example`, `apps/api/src/config/aiConfig.ts`, `apps/api/src/config/costControlConfig.ts`, `apps/api/src/config/openRouter.ts`, `apps/mobile/.env.example`, `apps/mobile/src/api/config.ts`.

## API (`apps/api/.env` — copy from `.env.example`)

| Variable | Default | Notes |
|---|---|---|
| `AI_ENABLED` | `false` | Master switch for real OpenRouter calls |
| `AI_PROVIDER` | `openrouter` | Only supported value |
| `OPENROUTER_API_KEY` | — | **Secret.** Backend only, never commit |
| `OPENROUTER_VISION_MODEL` | `openai/gpt-4o-mini` | Vision/scan model |
| `OPENROUTER_TEXT_MODEL` | `openai/gpt-4o-mini` | Recipe model (head of failover chain) |
| `AI_TIMEOUT_MS` | `45000` | Per-call timeout |
| `AI_MAX_OUTPUT_TOKENS` | `1024` | Output cap |
| `FABLE_ENABLED` | `false` | **Opt-in only.** Enables the `x-okyo-model: fable` header path |
| `FABLE_MODEL` | `anthropic/claude-fable-5` | Opt-in; used only when Fable active |
| `FABLE_DAILY_REQUEST_CAP` | `10` | Hard-clamped ≤10 in code |
| `EPICURE_ENABLED` | `false` | Additive ingredient enrichment |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Epicure-only model |
| `EPICURE_TIMEOUT_MS` | `12000` | Enrichment timeout before falling back to plain generation |
| `RECIPE_CACHE_TTL_DAYS` | `7` | 0 disables recipe cache |
| `AI_DAILY_REQUEST_CAP` | `200` | Global daily real-scan cap |
| `MAX_SCAN_IMAGE_BYTES` | `10000000` | Image payload cap |
| `SCAN_RATE_LIMIT_WINDOW_MS` / `SCAN_RATE_LIMIT_MAX` | `60000` / `10` | Per-IP limiter |
| `IMAGE_GEN_ENABLED` / `IMAGE_GEN_DAILY_REQUEST_CAP` | `false` / `0` | Future feature kill switch |
| `RECIPE_PAID_FALLBACK_MODEL` | unset | Optional paid tail of the recipe failover chain |
| `PORT` | `8081` | API port |

dotenv loads repo-root `.env` first, then `apps/api/.env` (later wins).

## Mobile (`apps/mobile/.env` — copy from `.env.example`)

| Variable | Default | Notes |
|---|---|---|
| `EXPO_PUBLIC_OKYO_API_URL` | `http://192.168.2.42:8081` fallback | Set to your machine's LAN IP + API port |
| `EXPO_PUBLIC_OKYO_DEV_AI_MODEL` | unset | **Dev-only.** Only `fable` honored, only in `__DEV__` builds — sends the Fable header |

## Important Constraints
- A fresh clone with no `.env` runs fully in mock mode — that's intentional.
- Fable vars are opt-in/dev-only; never set `FABLE_ENABLED=true` in a shared/prod environment without deciding cost exposure ([COST_CONTROLS.md](./COST_CONTROLS.md)).

## Known Risks / Edge Cases
- Restart Expo with `-c` after changing `EXPO_PUBLIC_*` vars (they're inlined at bundle time).
- Root `.env` and app `.env` can disagree — apps/api's own file wins.

## Related Docs
[LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) · [SECURITY.md](./SECURITY.md) · [FABLE_ROUTING.md](./FABLE_ROUTING.md)
