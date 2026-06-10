# Claude Code Prompts

Use these prompts when working with Claude Code. They are Claude-oriented versions of the original Codex seed prompts.

## Prompt 1: Repo setup

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

## Prompt 2: Mobile shell

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

## Prompt 3: Mock first-scan flow

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
