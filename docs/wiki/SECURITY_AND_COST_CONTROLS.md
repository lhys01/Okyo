# Okyo Security and Cost Controls

## Current Protections (as of June 2026)

### Secrets
- All private API keys live in `apps/api/.env` — never in mobile code and never committed to git.
- `.gitignore` excludes `.env` and `.env.*` at the repo root and in every app.
- The mobile app (`apps/mobile/src/api/config.ts`) contains only the local API base URL — no private keys.
- Public keys (Supabase anon key, RevenueCat public key, Expo public API URL) are labeled `EXPO_PUBLIC_` and are safe to ship in the app bundle.

### Input Validation
- Every API endpoint uses Zod schemas. No raw unvalidated input reaches business logic.
- `POST /v1/scans` validates: image MIME type (`image/jpeg|jpg|png|webp`), base64 format, image size, field string lengths, and enum values.
- Image data URLs are validated against a regex before being forwarded to the AI provider.
- Express body parser enforces a 16 MB hard limit (`jsonBodyLimit`). A 413 error is returned on oversize bodies.

### AI Safety
- System prompts are server-side only. The mobile client never constructs or overrides prompts.
- User-controlled text fields (file name, conversion error reason) are short-capped by Zod and passed through `JSON.stringify` before being included in prompts — this mitigates raw prompt injection.
- AI output is validated against Zod schemas before being used in responses.
- OpenRouter error messages are sanitized to remove any embedded base64 data before logging.

### Logging
- Debug logs skip full base64 image data — only the length and a 30-character prefix are logged.
- Scan eval logs (`logs/scan-evals.jsonl`) contain no image data, no API keys, and no PII.
- Stack traces are never returned to clients. Errors return safe generic messages only.
- All verbose debug logging is skipped when `NODE_ENV=production`.

### New Protections Added in This Audit

#### Per-IP Rate Limiting (`apps/api/src/middleware/costControls.ts`)
- `POST /v1/scans` is rate-limited per client IP using a sliding window.
- Defaults: 10 requests per 60-second window.
- Configurable via `SCAN_RATE_LIMIT_WINDOW_MS` and `SCAN_RATE_LIMIT_MAX`.
- Returns HTTP 429 with a user-friendly message when the limit is hit.

#### Global Daily AI Request Cap
- A daily in-memory counter tracks real AI scan calls (excludes mock/demo scans).
- When the cap is reached, `/v1/scans` returns HTTP 429.
- Defaults: 200 real AI scans per day.
- Configurable via `AI_DAILY_REQUEST_CAP`.
- **Note:** Counter resets on server restart. Use a persistent store (Redis/DB) before public launch.

#### Image Generation Kill Switch (scaffold)
- `IMAGE_GEN_ENABLED=false` (default) blocks all future image generation calls.
- `isImageGenAllowed()` in `costControls.ts` must be called at the top of any image gen service before it is enabled.
- `IMAGE_GEN_DAILY_REQUEST_CAP=0` sets the per-day limit when enabled.

#### Configurable Image Size Limit
- `MAX_SCAN_IMAGE_BYTES` sets the maximum allowed image payload (default 10 MB).
- Enforced as a secondary check in `/v1/scans` (Zod schema is the primary check).

#### `/debug/ai-config` Endpoint Guarded
- This endpoint now returns 404 in production (`NODE_ENV=production`).
- In development it remains accessible for debugging.

---

## Environment Variables

All cost control vars live in `apps/api/.env`. Copy from `apps/api/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `AI_ENABLED` | `false` | Master AI kill switch — set to `false` to stop all AI calls immediately |
| `AI_DAILY_REQUEST_CAP` | `200` | Max real AI scan calls per day (in-memory) |
| `AI_TIMEOUT_MS` | `30000` | Per-request AI call timeout in milliseconds |
| `AI_MAX_OUTPUT_TOKENS` | `4096` | Max tokens per AI model response |
| `SCAN_RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window duration (ms) |
| `SCAN_RATE_LIMIT_MAX` | `10` | Max scan requests per IP per window |
| `MAX_SCAN_IMAGE_BYTES` | `10000000` | Max image payload size (bytes) |
| `IMAGE_GEN_ENABLED` | `false` | Image generation kill switch (feature not yet active) |
| `IMAGE_GEN_DAILY_REQUEST_CAP` | `0` | Max image generations per day when enabled |

---

## How to Turn AI Off Immediately

Set in `apps/api/.env`:

```
AI_ENABLED=false
```

Then restart the API server. No AI calls will be made. Scans fall back to mock data.

---

## How to Turn Image Generation Off Immediately

Image generation is not yet active. When it is:

Set in `apps/api/.env`:

```
IMAGE_GEN_ENABLED=false
```

Then restart the API server. Every image generation call will be blocked at the `isImageGenAllowed()` check.

---

## Safe Default Limits

These defaults are conservative and appropriate for a closed beta:

- Rate limit: 10 scans per IP per minute
- Daily AI cap: 200 real AI scans (in-memory, resets at midnight UTC or on restart)
- Image size: 10 MB max
- AI timeout: 30 seconds
- Max output tokens: 4096

Adjust upward only when you have monitoring in place.

---

## What Remains Before TestFlight / Public Beta

| Item | Status | Notes |
|---|---|---|
| Persistent rate limit counters | Missing | In-memory counters reset on restart. Use Redis or Supabase before public launch. |
| Per-user daily scan quota | Missing | Requires user authentication. Currently no auth system exists. |
| Monthly spend cap enforcement | Missing | `AI_MONTHLY_SPEND_CAP_CENTS` is documented but not enforced — requires spend tracking via OpenRouter billing API or webhook. |
| CORS origin restriction | Open | `app.use(cors())` is unrestricted. Restrict to your production domain before public launch. |
| Auth / session system | Missing | All endpoints are currently public. Add user tokens before public launch. |
| API key rotation | Recommended | The live OpenRouter key in `apps/api/.env` should be rotated before TestFlight if it was ever exposed or shared. |
| Supabase service role key | Not wired | Must remain backend-only. Never pass to mobile. |
| Logging to external service | Missing | Structured logs (`[cost]` events) go to stdout only. Wire to Datadog/Sentry/LogTail before launch. |
| Request ID tracing | Missing | Add a request ID header (`X-Request-ID`) for correlating logs per scan. |
| Input sanitization for user-generated recipe edits | Not applicable | Users cannot currently edit AI outputs via API. |

---

## Manual Security Test Checklist

Run these manually before each beta release:

- [ ] `curl -s http://localhost:8081/v1/scans -X POST -H "Content-Type: application/json" -d '{}'` → should return 201 with mock result (no image = mock scan)
- [ ] Send a scan with `source: "mock"` → verify `aiSource` is `mock_ai`, no AI call made
- [ ] Send a scan with a base64 image where `dataUrl` is not prefixed with `data:image/` → verify 400 validation error
- [ ] Send a POST body > 16 MB → verify 413 response
- [ ] Set `AI_ENABLED=false`, send a scan with a real image → verify `status: failed` or `mock_ai`, no OpenRouter call
- [ ] Hit `/v1/scans` 11 times within 60s from same IP → verify 11th request returns 429
- [ ] Set `AI_DAILY_REQUEST_CAP=1`, send two real image scans → second returns 429
- [ ] Confirm `/debug/ai-config` returns 404 when `NODE_ENV=production`
- [ ] Check `apps/api/logs/scan-evals.jsonl` — verify no base64 data, no API keys in entries
- [ ] Grep source: `grep -r "sk-or-v1\|sk-proj" apps/mobile/` → should return nothing
- [ ] Grep source: `grep -r "OPENROUTER_API_KEY" apps/mobile/` → should return nothing

---

## What Not to Commit

- `apps/api/.env` — contains live API keys
- Any `.env.local`, `.env.production`, `.env.*.local` file
- `apps/api/logs/scan-evals.jsonl` — contains scan metadata
- Any file containing a real `sk-or-v1-*`, `sk-proj-*`, `sk-ant-*`, `sbp_*`, or JWT service-role key
