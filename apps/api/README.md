# Okyo API

Express API for authenticated food scans, inspired-by recipe generation, Recipe Check, Make It Mine, and guided-cooking enrichment.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Required for a real scan environment:

- `AI_ENABLED=true`
- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The Supabase URL also determines the JWT issuer and JWKS endpoint. Never expose the service-role key to the mobile app.

## Commands

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

## Routes

Public:

- `GET /health`
- `GET /debug/ai-config` outside production only

All `/v1` routes require a verified Supabase bearer token:

- `POST /v1/scans`
- `POST /v1/recipes/check`
- `POST /v1/recipes/adapt`
- `POST /v1/recipes/:recipeId/coaching`

The scan route persists the generated recipe under the authenticated user. Coaching only reads a non-expired recipe owned by that same user.

Provider failures, invalid output, quota exhaustion, timeout, unclear images, and non-food images fail honestly. Real uploaded images never receive a seeded demo recipe.
