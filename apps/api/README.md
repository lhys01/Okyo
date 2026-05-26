# Okyo API

Mock TypeScript API skeleton for Okyo fake-data V1.

This app uses mock data only. It does not connect real AI, a database, auth, payments, maps, comments, or a social feed.

The scan endpoint is routed through a mock AI service interface at `src/services/aiService.ts`. That interface is the future replacement point for real dish recognition, recipe generation, and cost estimation.

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

The API validates this payload, returns the same mock scan shape, and does not store files or call AI.

## Mock AI Service

Current typed service functions:

- `analyzeFoodImage(input)`
- `generateRecipeFromDish(input)`
- `estimateIngredientCosts(input)`

These functions return validated mock structured data with confidence scores. `POST /v1/scans` falls back to seeded mock scan data if a mock AI-shaped output is missing or invalid. Future real AI provider calls should replace the internals of this service without changing the mobile response shape.
