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
