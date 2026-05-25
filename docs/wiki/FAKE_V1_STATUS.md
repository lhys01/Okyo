# FAKE_V1_STATUS - Okyo Mobile Fake-data V1

Date: 2026-05-25

## Review Result

Fake-data V1 is complete for the current prototype scope. The app has the primary local-only flow from onboarding to scan, result, recipe, grocery list, save, share, Dupe Challenge, rankings, packs, and settings.

No backend, real AI, login, payments, maps, comments, DMs, or social feed were added for this phase.

## Current Paths

```text
Repo root:  /Users/rober/Documents/Okyo-1
Mobile app: /Users/rober/Documents/Okyo-1/apps/mobile
Run file:   /Users/rober/Documents/Okyo-1/run
```

The global terminal `run` shortcut should start from `/Users/rober/Documents/Okyo-1`.

## Current Technical Stack

- React Native with Expo SDK 55
- TypeScript
- React Navigation native stack and bottom tabs
- Zustand for local app state
- AsyncStorage persistence through Zustand middleware
- Expo Clipboard and React Native Share for copy/share flows
- Local mock data in `apps/mobile/src/mocks`
- Typed analytics stub in `apps/mobile/src/analytics/track.ts`
- Quiet UI debug wrapper in `apps/mobile/src/utils/uiDebug.ts`

## How To Run

One-command path:

```bash
run
```

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

Setup notes:

- Node 22, tested with `v22.22.3`
- Installed Xcode, tested with Xcode `26.5`
- Expo SDK 55 (`expo ~55.0.0`)
- Expo dev server port `8082`
- LAN host mode is intentional because simulator connection through `localhost` / `127.0.0.1` was unreliable in this setup

## Completed Features

- Onboarding carousel with a working `Start Scanning` CTA that resets into `MainTabs -> ScanScreen`
- Mock first-scan flow from Scan to Loading to Result Summary
- Result summary with confidence, restaurant estimate, homemade cost, estimated savings, match score, and recipe mode tabs
- Recipe modes for `Restaurant Copy`, `Budget`, and `Healthy`
- Recipe detail with ingredients, instructions, substitutions, pantry note, confidence note, save, grocery, challenge, and share actions
- Grocery list with categorized items, pantry check, item checkoffs, copy, native share, XP, and badge award
- Saved recipe library with empty state, saved cards, recipe open, and remove action
- Savings dashboard with empty state, total savings, weekly/monthly estimates, biggest win, saved count, challenge count, and average savings
- Share card preview for scan result, challenge result, ranking, badge, and restaurant pack cards
- Dupe Challenge with start XP, mark cooked, rating choices, match score, savings, badges, and duplicate-completion guard
- Challenge complete screen with score, savings, XP, badge, share result, and empty state if opened directly
- XP and one-time XP award tracking through `awardXPOnce`
- Badges, recent badge banner, and badge progress hints
- Rankings tab with level, XP progress, mock leaderboards, user row, and share ranking action
- Static Restaurant Packs tab and pack detail screen with pack empty/not-found safeguards
- Settings screen with app version, placeholders, Reset Onboarding, and Delete Saved Data
- Analytics event names and typed `track()` stub, muted by default to avoid console noise
- UI debug logger, muted by default with dedupe logic if enabled
- Loading state on analysis screen
- Error, fallback, and empty states for missing recipe modes, missing share scan result, missing challenge result, empty library, empty savings, empty packs, and missing pack detail

## Known Limitations

- Local-only prototype; no backend API or cloud persistence
- Mock-only scan, dish recognition, recipes, costs, savings, XP, badges, rankings, and packs
- No real image upload or camera integration yet
- No real AI provider or prompt/evaluation harness yet
- No real cost engine or grocery price source yet
- Native share sends text only; real share-card image export is still a placeholder
- Paywall screen exists only as a placeholder; no purchases or subscriptions are connected
- Onboarding goal screen exists in code but is not part of the current primary Start Scanning flow

## Intentional Exclusions

- No backend implementation
- No real AI or remote inference
- No login or account system
- No payments or subscriptions
- No maps
- No comments
- No DMs
- No social feed
- No real restaurant integrations or official restaurant recipes

## Verification

- TypeScript passed with `cd apps/mobile && npx tsc --noEmit`
- Simulator launch passed with `./run` from `/Users/rober/Documents/Okyo-1`
- `run` opened Okyo at `exp://192.168.7.86:8082` during this review
- Main flow reviewed: onboarding -> Start Scanning -> Scan -> Loading -> Result Summary -> Recipe Detail
- Secondary flows reviewed: Grocery List, Save to Library, Savings, Share Preview, Dupe Challenge, Challenge Complete, Rankings, Restaurant Packs, Settings
- Current docs use `/Users/rober/Documents/Okyo-1` as the current local path

## Next Recommended Phase

1. Run a manual simulator UX pass with persisted state reset between runs.
2. Add a minimal smoke-test plan or E2E harness for the fake-data V1 critical path.
3. Add an API skeleton that serves the existing mock scan, recipe, pack, XP, and badge data.
4. Define the AI provider interface and response schema behind a feature flag.
5. Design the first real image-upload flow without storing food images unless the user explicitly saves or opts in.

## Exact Next 5 Backend / AI Prompts To Run Later

1. "Create a minimal TypeScript API skeleton for Okyo that serves the existing mock scan results, recipes, grocery lists, share cards, XP/badges, and restaurant packs with Zod-validated response schemas."
2. "Design an AI provider interface for Okyo vision and recipe generation that can accept an image reference plus user mode and return uncertain, editable fields with confidence scores."
3. "Draft the exact JSON schema for AI recipe outputs, including dish identification, ingredients, steps, substitutions, estimated homemade cost, estimated savings, match score, and confidence notes."
4. "Create an evaluation harness that compares generated recipe outputs against human-written references and scores dish match, ingredient plausibility, cost reasonableness, and safety disclaimers."
5. "Design a privacy-safe image upload plan for Okyo that avoids storing food images unless a user saves a recipe or explicitly opts in, including retention rules and failure states."
