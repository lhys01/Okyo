# BUILD_FROM_ZERO_CLAUDE.md - Step-by-Step Build Guide

This file is the build path for creating Okyo from zero with Claude Code.

## Current Local Setup

The active local repo on this machine is:

```text
/Users/rober/Documents/Okyo-1
```

The mobile app lives at:

```text
/Users/rober/Documents/Okyo-1/apps/mobile
```

The repo has a root-level executable named `run`. The global terminal `run` shortcut should point to this repo and start the mobile app from this path.

Current mobile setup:

- Node 22, tested with `v22.22.3`
- Installed Xcode, tested with Xcode `26.5`
- Expo SDK 55 (`expo ~55.0.0`)
- Expo dev server on port `8082`
- Expo tunnel mode for simulator reliability

Run the current fake-data V1 app with:

```bash
run
```

Or from the repo root:

```bash
cd /Users/rober/Documents/Okyo-1
./run
```

Or from the mobile app:

```bash
cd /Users/rober/Documents/Okyo-1/apps/mobile
npm run sim
```

## Phase 1 - Repo Setup

Ask Claude Code:

```text
Read CLAUDE.md, README.md, docs/wiki/BUILD_FROM_ZERO_CLAUDE.md, docs/wiki/PRD_SUMMARY.md, and docs/seed/OKYO_MASTER_ONE_NOTE.md.

Set up the Okyo monorepo structure.

Create:
- apps/mobile
- apps/api
- packages/shared
- packages/config

Do not build app features yet.
Do not add backend logic yet.
Do not add real AI.
Do not add login.
Do not add payments.
Do not add maps.
Do not add social feed.
```

Commit after this works if the user asks for a commit.

## Phase 2 - Initialize Mobile App

Ask Claude Code:

```text
Read CLAUDE.md, docs/wiki/FRONTEND_ARCHITECTURE.md, and docs/wiki/USER_FLOWS.md.

Initialize the Expo React Native mobile app in apps/mobile using TypeScript.

Build only the starter app shell.

Requirements:
- app name should be Okyo
- it should run in the iOS Simulator with Expo SDK 55
- no backend
- no real AI
- no login
- no payments
- no maps
- no social feed
```

Run:

```bash
cd apps/mobile
npm run sim
```

Use the iOS Simulator. Expo Go can be incompatible if the installed client does not support Expo SDK 55.

Commit after it runs if the user asks for a commit.

## Phase 3 - Mock First-Scan Flow

Ask Claude Code:

```text
Read:
- CLAUDE.md
- docs/wiki/USER_FLOWS.md
- docs/wiki/UX_COPY.md
- docs/wiki/FRONTEND_ARCHITECTURE.md
- docs/seed/OKYO_MASTER_ONE_NOTE.md
- docs/seed/MOCK_SCAN_RESULTS.json
- docs/seed/SHARE_CARD_EXAMPLES.md

Build the Okyo mock first-scan flow with fake data only.

Screens:
- WelcomeScreen
- GoalScreen
- ScanScreen
- AnalysisLoadingScreen
- ResultSummaryScreen
- RecipeDetailScreen

Flow:
Welcome -> Goal -> Scan -> Loading -> Result Summary -> Recipe Detail

Requirements:
- Use mock data only
- Show dish name
- Show confidence score
- Show restaurant price
- Show homemade cost
- Show estimated savings
- Show mode tabs: Restaurant Copy, Budget, Healthy
- Add buttons: View Recipe, Share Dupe, Save Recipe, Grocery List

Do not add backend.
Do not add real AI.
Do not add login.
Do not add payments.
Do not add maps.
Do not add comments.
```

## Phase 4 - Build Utility Screens

Completed for fake-data V1:

1. Recipe detail + dupe modes
2. Grocery list
3. Saved recipe library
4. Savings dashboard
5. Share card preview
6. Dupe Challenge
7. XP / badges / rankings
8. Static Restaurant Packs
9. Onboarding/settings/privacy links
10. Analytics stubs

## Phase 5 - Backend

Build API skeleton with mock data first.

## Phase 6 - Real AI

Only add real AI after the mock app feels good.
