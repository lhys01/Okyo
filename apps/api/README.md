# Okyo API

Mock-first TypeScript API skeleton for Okyo fake-data V1.

This app uses mock data by default. It does not connect a database, auth, payments, maps, comments, a social feed, or permanent file storage.

The scan endpoint is routed through an AI service interface at `src/services/aiService.ts`. OpenRouter can be enabled for testing. The API is intentionally honest about scan failures: real uploaded image failures return `failed`, `rejected`, or `partial` states instead of pretending the default mock pasta result came from that image.

For the full route-by-route spec, see `../../docs/wiki/API_SPEC.md`.

## Run Locally

```bash
cd apps/api
npm install
npm run dev
```

The API runs on port `8081` by default.

Health check:

```bash
curl http://localhost:8081/health
```

## Scripts

- `npm run dev` starts the API with `tsx watch`
- `npm run build` compiles TypeScript to `dist`
- `npm run typecheck` runs `tsc --noEmit`
- `npm start` runs the compiled API

## Endpoints

- `GET /health`
- `GET /debug/ai-config`
- `POST /v1/scans`
- `GET /v1/scans/:scanId`
- `GET /v1/recipes/:recipeId`
- `POST /v1/recipes/:recipeId/save`
- `GET /v1/library`
- `GET /v1/savings`
- `POST /v1/challenges`
- `POST /v1/xp-events`
- `GET /v1/rankings/weekly`
- `GET /v1/restaurant-packs`
- `GET /v1/restaurant-packs/:packId`

`POST /v1/scans` accepts optional image metadata:

```json
{
  "source": "photos",
  "mode": "Restaurant Copy",
  "image": {
    "uri": "file:///local-only-photo.jpg",
    "dataUrl": "data:image/jpeg;base64,...",
    "fileName": "meal.jpg",
    "mimeType": "image/jpeg",
    "width": 1200,
    "height": 900,
    "sizeBytes": 345678,
    "dataUrlSizeBytes": 456789,
    "source": "photos",
    "placeholder": false
  }
}
```

The API validates this payload and does not store files. If a data URL is provided, the raw base64 is removed from the response and replaced with `hasDataUrl: true`.

Scan responses use `data.status`:

- `success`: a scan result is available.
- `partial`: the API recognized enough for a scan-style result, but not enough to safely return a full recipe.
- `rejected`: the photo appears not to be food or is too unclear.
- `failed`: AI scanning or provider-visible image access failed.

## OpenRouter Testing

OpenRouter is disabled by default. Do not commit `.env` or API keys.

```bash
cp ../../.env.example ../../.env
```

Set these values in the local `.env` file:

```bash
AI_ENABLED=true
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_local_key_here
OPENROUTER_VISION_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
OPENROUTER_TEXT_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
AI_TIMEOUT_MS=30000
AI_MAX_OUTPUT_TOKENS=4096
```

This adapter uses OpenRouter's OpenAI-compatible chat completions endpoint. It asks for JSON-only food analysis and recipe output, validates responses with Zod, and logs:

- `openrouter_ai` when provider calls succeed.
- `mock_ai` for demo/mock scans and local mock service behavior.
- `fallback_ai` when provider output fails or a safe fallback path is used.

This is for testing only. Do not upload confidential information or personal data.

## AI Service

Current typed service functions:

- `analyzeFoodImage(input)` analyzes image metadata or provider-visible image data and returns cautious food-analysis fields.
- `generateRecipeFromDish(input)` creates a copycat-style or inspired-by recipe result from the analysis.
- `estimateIngredientCosts(input)` estimates restaurant price, homemade cost, and savings.
- `createAiScan(input)` powers `POST /v1/scans` and combines analysis, recipe generation, costs, and safe scan states.

These functions return validated structured data with confidence scores. Treat all AI-assisted food identification, recipe, cost, and savings details as estimates.

## Persistent provider quotas

Every billable provider attempt reserves capacity through Supabase before the
network request starts. One reservation means one real provider attempt, so
vision/recipe retries, fallback models, Epicure, component repair, and coaching
each reserve separately when they actually call OpenRouter. Cache hits and
validation that finishes before a provider request do not consume capacity.

`reserve_scan_capacity` atomically maintains the per-user UTC-day counter and
creates the corresponding `provider_spend_events` row. After the attempt, the API
updates that same row with a sanitized outcome, reliable provider token counts,
and OpenRouter-reported cost when present. Missing cost remains null; no estimate
is invented. A finalization failure is logged as an operational telemetry error
and never reruns the provider call. Reservation denial fails with a sanitized
429, while quota-infrastructure failure fails closed with a sanitized 503.
The server-generated scan/recipe UUID is included in the controlled request
category for correlation. The current schema has no latency or attempt-key
column, so it cannot guarantee exactly-once finalization across a process crash;
an interrupted attempt safely remains as a reserved event rather than being
silently erased.

The IP sliding-window limiter and the stricter Fable model cap remain as
defense-in-depth abuse/cost controls. They are not authoritative daily quota
storage; persistent Supabase reservation is still required for every provider
attempt.
