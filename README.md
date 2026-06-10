# Okyo

Okyo is a mobile-first food app prototype that turns restaurant meal photos into homemade inspired-by recipes with estimated cost savings, grocery lists, Dupe Challenge, rankings, and shareable result cards.

The current app is a fake-data V1 prototype. It is useful for product QA and flow testing. It can call the local mock API for scans, but still falls back to local mock data and does not call a real AI provider yet.

## Current Local Paths

Use these paths on this machine:

```text
Repo root:  /Users/rober/Documents/Okyo-1
Mobile app: /Users/rober/Documents/Okyo-1/apps/mobile
```

The global terminal `run` shortcut is expected to point to `/Users/rober/Documents/Okyo-1`.

There is also a repo-level executable file named `run` at:

```text
/Users/rober/Documents/Okyo-1/run
```

That file changes into `apps/mobile`, starts Expo on port `8082` if needed, boots the iOS Simulator, and opens the app. For manual simulator testing, use Expo tunnel mode.

## Source Of Truth

New developers and Claude Code sessions should read these first:

1. `CLAUDE.md`
2. `README.md`
3. `.claude/skills/`
4. `docs/wiki/BUILD_FROM_ZERO_CLAUDE.md`
5. `docs/wiki/FAKE_V1_STATUS.md`
6. `docs/wiki/PRD_SUMMARY.md`
7. `docs/seed/OKYO_MASTER_ONE_NOTE.md`

Codex sessions can still use `AGENTS.md`; it is kept as the Codex-specific version of the repo instructions.

The app name is **Okyo**.

## Current Status

Implemented now:

- Expo React Native mobile app in `apps/mobile`
- Mock TypeScript API skeleton in `apps/api`
- TypeScript
- React Navigation stack + tabs
- Zustand local state with AsyncStorage persistence
- Fake-data onboarding and first-scan flow
- Result summary, recipe detail, grocery list, share preview, saved library, savings dashboard
- Dupe Challenge, challenge complete, XP, badges, rankings
- Static Restaurant Packs and pack detail screens
- Settings with Reset Onboarding and Delete Saved Data
- Analytics wrapper and UI debug wrapper, currently quiet by default
- Safe mobile API client for mock scan calls with local mock fallback
- Image picker plumbing that sends safe image metadata or placeholders to the mock API
- Mock AI service interface in `apps/api/src/services/aiService.ts`
- OpenRouter adapter for testing with mock fallback, disabled by default

Not built yet:

- Real image upload/storage
- Production AI dish recognition or recipe generation
- Real cost engine
- Login/accounts
- Payments/subscriptions
- Maps
- Comments, DMs, or social feed
- Real share-card image export to Photos
- App Store/TestFlight setup

## Requirements

Use this setup:

- Node 22, tested with Node `v22.22.3`
- Installed Xcode, tested with Xcode `26.5`
- Expo SDK 55, app dependency is `expo ~55.0.0`
- iOS Simulator available through Xcode

The mobile app uses:

- Port `8082`
- Expo tunnel mode: `npx expo start -c --tunnel --port 8082`

Tunnel mode is intentional. In this local setup, simulator connections through `localhost` or `127.0.0.1` were unreliable.

The API uses:

- Port `8081`
- Mock fallback by default
- Optional OpenRouter test adapter when `AI_ENABLED=true` and an API key is provided
- No database, auth, payments, permanent file storage, or production AI workflow

## Run The Mobile App

Beginner path:

1. Open a terminal.
2. Run:

```bash
run
```

That global shortcut should start Okyo from `/Users/rober/Documents/Okyo-1`.

Repo-local path:

```bash
cd /Users/rober/Documents/Okyo-1
./run
```

Manual simulator path:

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npx expo start -c --tunnel --port 8082
```

Then press `i` to open the iOS Simulator.

## Run The API

From the API app:

```bash
cd /Users/rober/Documents/Okyo-1/apps/api
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:8081/health
```

TypeScript check:

```bash
cd /Users/rober/Documents/Okyo-1/apps/api
npm run typecheck
```

The API uses mock data by default. It includes an AI service interface for future dish recognition, recipe generation, and cost estimation. OpenRouter can be enabled for testing, but missing keys, disabled AI, timeouts, invalid JSON, or provider failures all fall back to mock data.

The mobile API base URL is configured in:

```text
apps/mobile/src/api/config.ts
```

For current simulator testing, run the API separately on `localhost:8081` and start the mobile app with Expo tunnel mode.

## Enable OpenRouter Testing

OpenRouter is optional and disabled by default. Do not commit `.env` or API keys.

1. Copy `.env.example` to `.env`.
2. Set:

```bash
AI_ENABLED=true
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_local_key_here
OPENROUTER_VISION_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
OPENROUTER_TEXT_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
AI_TIMEOUT_MS=30000
```

This is for testing only. Do not upload confidential information or personal data. Local simulator file URIs are not permanently stored by the API.

## Useful Commands

Mobile TypeScript check:

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npx tsc --noEmit
```

Start Expo without opening the simulator:

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npm start
```

Check which process is using port `8082`:

```bash
lsof -nP -iTCP:8082 -sTCP:LISTEN
```

## Current Fake-data Features

- Onboarding flow with Start Scanning reset into the Scan tab
- Mock scan from Take Photo or Upload From Photos, including optional local photo metadata
- Loading/analyzing screen
- Result summary with confidence, restaurant estimate, homemade cost, savings, and mode tabs
- Mode-specific recipe detail for Restaurant Copy, Budget, and Healthy
- Grocery list with pantry check, checkbox items, copy, and native share
- Save recipe to local library and remove saved recipes
- Savings dashboard based on saved recipes and completed challenges
- Share card preview with native share and copy caption
- Dupe Challenge with Mark Cooked, rating, XP, badges, and challenge complete screen
- Rankings screen with mock leaderboards and badge progress
- Static Restaurant Packs with save, challenge, and share actions
- Settings with Reset Onboarding and Delete Saved Data

All food identification, costs, savings, and recipes are mock estimates. Do not present them as exact.

## Current Mock API Endpoints

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

`POST /v1/scans` accepts optional image metadata or a placeholder image payload. The API does not store files and still returns mock scan data only.

Internally, `POST /v1/scans` calls the AI service interface in `apps/api/src/services/aiService.ts`. That service can use mock AI or the OpenRouter adapter, validates AI-shaped outputs, handles confidence scores, and falls back to seeded mock scan data if output is invalid.

## Troubleshooting

### Expo Go incompatible

The app uses Expo SDK 55. If Expo Go says the project is incompatible, use the iOS Simulator flow through `run` or install an Expo Go/client version that supports SDK 55.

### No devices are booted

Run:

```bash
open -a Simulator
```

Then run:

```bash
run
```

The repo-level `run` file looks for an `iPhone 17 Pro` simulator. If that simulator does not exist, it prints the available iPhone simulators so you can install or choose one.

### Could not connect to server

Make sure Expo is running on port `8082`:

```bash
lsof -nP -iTCP:8082 -sTCP:LISTEN
```

Then restart from the current repo:

```bash
cd /Users/rober/Documents/Okyo-1
./run
```

Use LAN host mode. Avoid switching this setup back to `localhost` or `127.0.0.1` unless you are intentionally debugging simulator networking.

### Wrong folder / package.json does not exist

You are probably not in the repo root or mobile app folder.

Use:

```bash
cd /Users/rober/Documents/Okyo-1
ls apps/mobile/package.json
```

If that file exists, run:

```bash
./run
```

### `run` points to old folder

The global terminal `run` shortcut should point to:

```text
/Users/rober/Documents/Okyo-1
```

If it tries to start from another folder, update the shortcut or run the repo-local file directly:

```bash
cd /Users/rober/Documents/Okyo-1
./run
```

### `/Users/rober/Documents/GitHub/Okyo-1` missing

That old folder is not the current working copy. Do not recreate it just to make Okyo run.

Use the current folder instead:

```text
/Users/rober/Documents/Okyo-1
```

## Development Rules

- Prioritize V1 MVP stability over new scope.
- Keep the first session fast: open app, scan meal, see result.
- Do not add backend, real AI, login, payments, maps, comments, DMs, or social feed unless explicitly requested.
- Treat all AI-like outputs as uncertain and editable.
- Keep TypeScript simple and readable.
- Do not store user food images unless the user saves a recipe or explicitly opts in.
