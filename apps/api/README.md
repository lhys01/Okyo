# Okyo API

Mock-first TypeScript API skeleton for Okyo fake-data V1.

This app uses mock data by default. It does not connect a database, auth, payments, maps, comments, a social feed, or permanent file storage.

The scan endpoint is routed through an AI service interface at `src/services/aiService.ts`. OpenRouter can be enabled for testing, but disabled AI, missing keys, timeouts, invalid JSON, and provider failures all fall back to seeded mock data.

## Run Locally

```bash
cd /Users/rober/Documents/Okyo-1/apps/api
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
    "fileName": "meal.jpg",
    "mimeType": "image/jpeg",
    "width": 1200,
    "height": 900,
    "sizeBytes": 345678,
    "source": "photos",
    "placeholder": false
  }
}
```

The API validates this payload, returns the same scan shape, and does not store files. It calls AI only when `AI_ENABLED=true` and `OPENROUTER_API_KEY` is present.

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
```

This adapter uses OpenRouter's OpenAI-compatible chat completions endpoint. It asks for JSON-only food analysis and recipe output, validates responses with Zod, and logs `openrouter_ai` only when provider calls succeed. It logs `mock_ai` when mock mode is selected and `fallback_ai` when provider output fails.

This is for testing only. Do not upload confidential information or personal data.

## AI Service

Current typed service functions:

- `analyzeFoodImage(input)`
- `generateRecipeFromDish(input)`
- `estimateIngredientCosts(input)`

These functions return validated structured data with confidence scores. `POST /v1/scans` keeps the same mobile response shape and falls back to seeded mock scan data if AI-shaped output is missing or invalid.
