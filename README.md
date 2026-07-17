# Okyo

Okyo is a mobile AI food companion. A user photographs a restaurant meal, gets an honest inspired-by recipe, can edit the dish name or recipe, saves it locally, builds a grocery list, cooks with guided steps, and shares the result.

The intentionally small product scope is:

- fast first scan
- clear food / unclear food / non-food handling
- inspired-by recipe generation through OpenRouter
- Recipe Check and Make It Mine adaptations
- saved recipes and food ideas
- grocery lists and guided cooking
- scan-result share cards
- lightweight, pressure-free XP rewards

Okyo is not a calorie tracker, generic recipe catalog, social network, restaurant-pack browser, leaderboard, or subscription product today. Costs, savings, food identification, and recipes are estimates. Real scan failures never fall back to demo food.

## Repository

```text
apps/mobile/   Expo + React Native application
apps/api/      Express API, AI orchestration, auth, and persistence
supabase/      Versioned development database migrations
docs/          Architecture, design, AI-quality, and testing references
PRODUCT.md     Product and design contract
AGENTS.md      Repository rules for coding agents
```

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), then use
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md),
[docs/AI_AND_RECIPE_QUALITY.md](docs/AI_AND_RECIPE_QUALITY.md), or
[docs/TESTING.md](docs/TESTING.md) for the task at hand.

## Requirements

- Node.js 22
- npm
- Xcode and an iOS Simulator for iOS development
- Expo SDK 55-compatible tooling
- a Supabase project for authentication and recipe persistence
- an OpenRouter key when real AI is enabled

## Install

Each app owns its dependencies; there is no root package workspace.

```bash
cd apps/api && npm install
cd ../mobile && npm install
```

Copy only the app-specific examples you need. Never commit `.env` files.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

`.mcp/config.json` and `opencode.json` are optional developer-tool
configuration. They are not required to install, build, test, or run either
app, and they do not create a root JavaScript workspace.

For a physical phone, replace the mobile example's `localhost` API URL with the development machine's LAN address. Production mobile builds require an HTTPS API URL.

## Run

API:

```bash
cd apps/api
npm run dev
```

Mobile:

```bash
cd apps/mobile
npm run sim
```

The repo-local `./run` helper starts the mobile app on port 8082 and opens an available iPhone Simulator. It resolves the checkout dynamically and does not depend on a hardcoded machine path.

## Validate

```bash
cd apps/api
npm run typecheck
npm test
npm run build

cd ../mobile
npm run typecheck
npm test
npx expo export --platform ios --output-dir /tmp/okyo-ios-export
```

There is no configured linter or CI workflow at present; typecheck, tests, and an Expo export are the required local gates.

## API surface

Public:

- `GET /health`
- `GET /debug/ai-config` in non-production environments only

Authenticated (`Authorization: Bearer <Supabase access token>`):

- `POST /v1/scans`
- `POST /v1/recipes/check`
- `POST /v1/recipes/adapt`
- `POST /v1/recipes/:recipeId/coaching`

The API validates Supabase JWTs for every `/v1` route. Generated recipes are scoped to the verified user and persisted in Supabase. Uploaded image data is used for the request and is not written to the database. The mobile app keeps a local photo copy only when a recipe is saved.

OpenRouter is the normal provider path. Fable remains private and opt-in: both `FABLE_ENABLED=true` and the per-request `x-okyo-model: fable` header are required. It fails closed and its code-level daily cap cannot exceed 10.

## Configuration notes

- OpenRouter defaults to `openai/gpt-4o-mini` unless explicitly configured.
- `AI_ENABLED=false` disables provider calls.
- Recipe/provider failures surface as friendly failures; they do not silently become mock recipes.
- Demo/mock recipes are limited to explicit development/demo flows.
- Subscription and paywall code is intentionally absent until a real purchase provider and entitlement model are implemented. The product intent remains documented in `PRODUCT.md`.

## Manual smoke path

1. Launch a fresh install and confirm hero → scan is the first-session path.
2. Upload a clear food photo and confirm result → recipe → save → grocery → guided cooking → share.
3. Upload a non-food and an unclear image; confirm both show honest retry states.
4. Enter a restaurant price and confirm savings appears only after that input.
5. Save and remove a recipe; confirm its local photo copy follows the recipe lifecycle.
6. Disable the API or AI and confirm no seeded pasta result appears for a real photo.
