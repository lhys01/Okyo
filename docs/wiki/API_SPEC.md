# Okyo API Spec

This document describes the API routes that are currently implemented in `apps/api/src/server.ts`.

The API is still a mock-first MVP backend. It uses seeded in-memory data for saved recipes, savings, rankings, restaurant packs, and most local testing flows. There is no database, auth, account system, payments, permanent image storage, or production persistence yet.

## Base URL

Local development default:

```text
http://localhost:8081
```

## Response wrapper

Every successful response is wrapped like this:

```json
{
  "ok": true,
  "data": {}
}
```

Every error response is wrapped like this:

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": {}
  }
}
```

Common current errors:

- `400 validation_error` when the request body does not match the expected shape.
- `404 scan_not_found` when a scan ID is not in mock data.
- `404 recipe_not_found` when a recipe ID is not in mock data.
- `404 pack_not_found` when a restaurant pack ID is not in mock data.
- `500 internal_error` for unexpected server errors.

## Implemented endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Basic API health and feature status. |
| `GET` | `/debug/ai-config` | Dev/debug view of public AI config. Does not return secrets. |
| `POST` | `/v1/scans` | Create a scan result from mock mode or image metadata. |
| `GET` | `/v1/scans/:scanId` | Read one seeded mock scan by scan ID. |
| `GET` | `/v1/recipes/:recipeId` | Read one seeded mock recipe by recipe ID. |
| `POST` | `/v1/recipes/:recipeId/save` | Save a recipe into the in-memory library. |
| `GET` | `/v1/library` | List recipes saved during this server process. |
| `GET` | `/v1/savings` | Get in-memory savings totals. |
| `POST` | `/v1/challenges` | Record a completed Dupe Challenge. |
| `POST` | `/v1/xp-events` | Award XP for an event type. |
| `GET` | `/v1/rankings/weekly` | Get mock weekly rankings, badges, XP events, and completed challenges. |
| `GET` | `/v1/restaurant-packs` | List seeded restaurant packs. |
| `GET` | `/v1/restaurant-packs/:packId` | Read one seeded restaurant pack by pack ID. |

Not implemented right now:

- `POST /v1/sessions`
- user accounts or auth endpoints
- grocery-list create/update endpoints
- share-card create/update endpoints
- payments or subscription endpoints
- upload storage endpoints

## `GET /health`

Returns basic server status.

Example response:

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "service": "okyo-api",
    "mode": "mock",
    "realAiEnabled": false,
    "databaseEnabled": false,
    "timestamp": "2026-05-29T00:00:00.000Z"
  }
}
```

Notes:

- `realAiEnabled` mirrors whether AI is enabled in config.
- `databaseEnabled` is currently always `false`.
- `mode` is currently `mock` because the API is still mock-first.

## `GET /debug/ai-config`

Returns public AI configuration for local debugging.

Example response:

```json
{
  "ok": true,
  "data": {
    "aiEnabled": false,
    "provider": "openrouter",
    "hasOpenRouterKey": false,
    "visionModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "textModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "timeoutMs": 30000,
    "maxOutputTokens": 4096
  }
}
```

This endpoint is for development only. It intentionally reports whether a key exists, but it does not return the API key.

## `POST /v1/scans`

Creates a scan response. This is the main endpoint used by the scan flow.

### Request body

All fields are optional. If no body fields are provided, the endpoint defaults to a demo mock scan.

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
    "placeholder": false,
    "conversionError": "optional short error"
  }
}
```

Allowed values:

- `source`: `camera`, `photos`, or `mock`. Default: `mock`.
- `mode`: `Restaurant Copy`, `Budget`, or `Healthy`. Default: `Restaurant Copy`.
- `image.mimeType`: `image/jpeg`, `image/jpg`, `image/png`, or `image/webp`.
- `image.dataUrl`: optional base64 image data URL for jpeg, png, or webp. The request JSON limit is `4mb`, and the data URL itself is capped at 2,750,000 characters.

### Image privacy behavior

The API does not permanently store uploaded image files. If `image.dataUrl` is sent, the response removes the raw base64 data and returns `hasDataUrl: true` instead.

Example safe image metadata in the response:

```json
{
  "uri": "file:///local-only-photo.jpg",
  "fileName": "meal.jpg",
  "mimeType": "image/jpeg",
  "width": 1200,
  "height": 900,
  "sizeBytes": 345678,
  "source": "photos",
  "placeholder": false,
  "hasDataUrl": true
}
```

### Successful scan response shape

A successful scan returns `status: "success"` and may include a scan, recipe, grocery list, and share card.

```json
{
  "ok": true,
  "data": {
    "status": "success",
    "scan": {
      "id": "001",
      "dishName": "Spicy Rigatoni Vodka",
      "restaurantStyle": "Italian-American",
      "restaurantPrice": 24,
      "homemadeCost": 7.5,
      "estimatedSavings": 16.5,
      "confidence": 0.82,
      "matchScore": 8.7,
      "difficulty": "Medium",
      "modes": ["Restaurant Copy", "Budget", "Healthy"],
      "recipeId": "recipe-spicy-vodka-rigatoni-restaurant-copy",
      "groceryListId": "grocery-spicy-vodka-rigatoni",
      "shareCardId": "share-spicy-vodka-rigatoni"
    },
    "recipe": {},
    "groceryList": {},
    "shareCard": {},
    "note": "AI provider output is for testing only. No image was stored; verify all food, cost, and recipe details.",
    "aiSource": "openrouter_ai",
    "aiProvider": "openrouter",
    "visionModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "recipeModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "confidence": 0.75,
    "uploadedImage": true,
    "image": { "hasDataUrl": true },
    "source": "photos"
  }
}
```

Important: cost, confidence, dish identification, ingredients, and recipe details are estimates for an MVP. The app should show them as editable/retry-friendly, not exact.

### Partial scan response shape

A partial scan returns `status: "partial"`. This means Okyo recognized enough to create a scan-style result, but not enough to safely return a full recipe result.

```json
{
  "ok": true,
  "data": {
    "status": "partial",
    "scan": {},
    "note": "Okyo recognized this as Possible Pasta, but could not safely generate the recipe yet. Try again.",
    "aiSource": "fallback_ai",
    "aiProvider": "openrouter",
    "visionModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "recipeModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "fallbackReason": "openrouter_invalid_json",
    "confidence": 0.42,
    "uploadedImage": true,
    "partialReason": "Okyo recognized this as Possible Pasta, but could not safely generate the recipe yet. Try again.",
    "image": { "hasDataUrl": true },
    "source": "photos"
  }
}
```

### Rejected or failed scan response shape

A rejected/failed scan still returns `ok: true` because the API handled the scan request. The client should look at `data.status`.

```json
{
  "ok": true,
  "data": {
    "status": "failed",
    "scanId": "scan-failed-1770000000000",
    "note": "Okyo could not analyze this photo. Try uploading a clearer food photo.",
    "aiSource": "fallback_ai",
    "aiProvider": "openrouter",
    "visionModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "recipeModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "fallbackReason": "ai_scan_failed",
    "confidence": 0,
    "uploadedImage": true,
    "rejectionType": "ai_failed",
    "rejectionReason": "Okyo could not analyze this photo. Try uploading a clearer food photo.",
    "image": { "hasDataUrl": true },
    "source": "photos"
  }
}
```

Possible `status` values:

- `success`: a normal scan result is available.
- `partial`: scan-style result is available, but a full recipe could not be safely generated.
- `rejected`: the image appears not to be food or is too unclear.
- `failed`: AI scanning or image access failed.

Possible `rejectionType` values:

- `not_food`
- `unclear_image`
- `ai_failed`

### Mock, fallback, and AI behavior

Current scan behavior is intentionally honest:

- Demo/mock scan: if `source` is `mock`, no real uploaded image is included, or the image is marked `placeholder: true`, the endpoint returns seeded mock data with `aiSource: "mock_ai"`.
- Real uploaded image with AI unavailable: if image data is present but `AI_ENABLED` is not `true` or there is no OpenRouter key, the endpoint returns `status: "failed"`. It does not pretend the mock pasta result came from the real image.
- Real uploaded image without provider-visible image data: if the client only sends local metadata that the provider cannot see, the endpoint returns `status: "failed"` with `fallbackReason: "image_not_available_to_ai"`.
- OpenRouter success: the endpoint can return AI-assisted testing output with `aiSource: "openrouter_ai"`.
- OpenRouter failure or invalid AI output: the endpoint uses safe failure, partial, or fallback behavior depending on where the failure happened. For real uploaded images, the API should not silently show the default mock pasta result as if it analyzed the image.
- Non-food or unclear images: the API can return `rejected` with `not_food` or `unclear_image`. If the model is unsure but the photo may be food, the expected behavior is to be cautious rather than overconfident.

## `GET /v1/scans/:scanId`

Reads a scan from seeded mock data.

Example:

```bash
curl http://localhost:8081/v1/scans/001
```

Response data:

```json
{
  "scan": {}
}
```

## `GET /v1/recipes/:recipeId`

Reads a recipe from seeded mock data.

Example:

```bash
curl http://localhost:8081/v1/recipes/recipe-spicy-vodka-rigatoni-restaurant-copy
```

Response data:

```json
{
  "recipe": {}
}
```

## `POST /v1/recipes/:recipeId/save`

Saves a seeded recipe into the in-memory library.

Example:

```bash
curl -X POST http://localhost:8081/v1/recipes/recipe-spicy-vodka-rigatoni-restaurant-copy/save
```

Response data:

```json
{
  "saved": true,
  "recipe": {},
  "library": []
}
```

Limitations:

- Saved recipes live only in memory.
- Restarting the API clears the library.
- There is no user-specific library yet.

## `GET /v1/library`

Lists recipes saved during the current server process.

Response data:

```json
{
  "recipes": []
}
```

## `GET /v1/savings`

Returns estimated savings totals from saved recipes and completed challenges.

Response data:

```json
{
  "totalEstimatedSaved": 16.5,
  "savedRecipeSavings": 16.5,
  "challengeSavings": 0,
  "savedRecipeCount": 1,
  "completedChallengeCount": 0,
  "averageSavingsPerDupe": 16.5
}
```

These are MVP estimates, not exact financial records.

## `POST /v1/challenges`

Records a completed Dupe Challenge in memory.

Request body:

```json
{
  "recipeId": "recipe-spicy-vodka-rigatoni-restaurant-copy",
  "mode": "Restaurant Copy",
  "rating": "Pretty close",
  "matchScore": 8.1
}
```

Required fields:

- `recipeId`
- `rating`: `Nailed it`, `Pretty close`, `Needs work`, or `Not close`

Optional fields:

- `mode`: defaults to `Restaurant Copy`.
- `matchScore`: must be between `0` and `10`. If omitted, the API estimates one from the rating.

Response data:

```json
{
  "challenge": {
    "id": "challenge-recipe-spicy-vodka-rigatoni-restaurant-copy-1770000000000",
    "recipeId": "recipe-spicy-vodka-rigatoni-restaurant-copy",
    "recipeTitle": "Spicy Rigatoni Copycat-Style Pasta",
    "mode": "Restaurant Copy",
    "rating": "Pretty close",
    "completedAt": "2026-05-29T00:00:00.000Z",
    "matchScore": 8.1,
    "moneySaved": 16.5,
    "xpEarned": 65,
    "badgeUnlocked": "budget-beast"
  }
}
```

Limitations:

- Completed challenges live only in memory.
- Restarting the API clears completed challenges.

## `POST /v1/xp-events`

Awards XP for an event type.

Request body:

```json
{
  "eventType": "first-scan",
  "sourceId": "001"
}
```

Required fields:

- `eventType`

Optional fields:

- `sourceId`

Response data:

```json
{
  "event": {
    "id": "xp-first-scan-001-1770000000000",
    "eventType": "first-scan",
    "points": 10,
    "awardedAt": "2026-05-29T00:00:00.000Z",
    "sourceId": "001"
  },
  "definitions": []
}
```

If the event type is unknown, the API currently records the event with `points: 0`.

## `GET /v1/rankings/weekly`

Returns mock ranking content plus in-memory XP and challenge activity.

Response data:

```json
{
  "xp": 25,
  "leaderboardEntries": [],
  "badges": [],
  "awardedXpEvents": [],
  "completedChallenges": []
}
```

## `GET /v1/restaurant-packs`

Lists seeded restaurant packs.

Response data:

```json
{
  "packs": []
}
```

## `GET /v1/restaurant-packs/:packId`

Reads one seeded restaurant pack.

Example:

```bash
curl http://localhost:8081/v1/restaurant-packs/red-lobster-inspired
```

Response data:

```json
{
  "pack": {
    "id": "red-lobster-inspired",
    "name": "Red Lobster Inspired",
    "dishes": []
  }
}
```

## Current limitations

- Data is seeded and in memory; most state resets when the API process restarts.
- There is no authentication or per-user data separation yet.
- There is no production database yet.
- There is no permanent image upload/storage service yet.
- AI output is for local testing and should be treated as uncertain.
- Recipe results are copycat-style or inspired-by only. They are not official restaurant recipes.
- Nutrition, ingredient, cost, and savings data are estimates and should not be presented as exact.
