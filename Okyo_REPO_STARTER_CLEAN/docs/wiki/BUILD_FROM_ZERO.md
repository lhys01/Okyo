# BUILD_FROM_ZERO.md — Step-by-Step Build Guide

This file is the build path for creating Okyo from zero with Codex.

## Phase 1 — Repo setup

Ask Codex:

```text
Read README.md, AGENTS.md, docs/wiki/BUILD_FROM_ZERO.md, docs/wiki/PRD_SUMMARY.md, and docs/seed/OKYO_MASTER_ONE_NOTE.md.

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
Do not add map.
Do not add social feed.
```

Commit after this works.

## Phase 2 — Initialize mobile app

Ask Codex:

```text
Read AGENTS.md, docs/wiki/FRONTEND_ARCHITECTURE.md, and docs/wiki/USER_FLOWS.md.

Initialize the Expo React Native mobile app in apps/mobile using TypeScript.

Build only the starter app shell.

Requirements:
- app name should be Okyo
- it should run in Expo Go
- no backend
- no real AI
- no login
- no payments
- no map
- no social feed
```

Run:

```bash
cd apps/mobile
npm start
```

Scan QR code with Expo Go.

Commit after it runs.

## Phase 3 — Mock first-scan flow

Ask Codex:

```text
Read:
- AGENTS.md
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
Welcome → Goal → Scan → Loading → Result Summary → Recipe Detail

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
Do not add map.
Do not add comments.
```

## Phase 4 — Build utility screens

Build in this order:

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

## Phase 5 — Backend

Build API skeleton with mock data first.

## Phase 6 — Real AI

Only add real AI after the mock app feels good.
