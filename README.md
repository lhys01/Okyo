# Okyo

Okyo is a mobile-first food app prototype that turns restaurant meal photos into homemade copycat recipes with estimated cost savings, grocery lists, Dupe Challenge, rankings, and shareable result cards.

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

That file changes into `apps/mobile`, starts Expo on port `8082` if needed, boots the iOS Simulator, and opens the app using the machine LAN IP.

## Source Of Truth

New developers and Codex sessions should read these first:

1. `AGENTS.md`
2. `README.md`
3. `docs/wiki/BUILD_FROM_ZERO.md`
4. `docs/wiki/FAKE_V1_STATUS.md`
5. `docs/wiki/PRD_SUMMARY.md`
6. `docs/seed/OKYO_MASTER_ONE_NOTE.md`

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

Not built yet:

- Real image upload
- Real AI dish recognition or recipe generation
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
- Expo LAN host mode: `expo start -c --host lan --port 8082`

LAN mode is intentional. In this local setup, simulator connections through `localhost` or `127.0.0.1` were unreliable.

The API uses:

- Port `8081`
- Mock data only
- No database, auth, real AI, or payments

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

Mobile-only path:

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npm run sim
```

The `sim` script runs:

```bash
expo start -c --host lan --port 8082
```

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

The API currently serves mock data only. It is a skeleton for future mobile/API integration and does not call real AI or persist to a database.

The mobile API base URL is configured in:

```text
apps/mobile/src/api/config.ts
```

For the iOS Simulator, this currently points at the Mac LAN IP on port `8081` because `localhost` can refer to the simulator itself.

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
- Mock scan from Take Photo or Upload From Photos
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
