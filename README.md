# Okyo

Okyo is a mobile-first AI food app that turns restaurant meal photos into homemade copycat recipes with estimated cost savings, grocery lists, Dupe Challenge, rankings, and shareable result cards.

## Source of Truth

Codex should read these files first:

1. `AGENTS.md`
2. `docs/wiki/BUILD_FROM_ZERO.md`
3. `docs/wiki/PRD_SUMMARY.md`
4. `docs/seed/OKYO_MASTER_ONE_NOTE.md`
5. `docs/wiki/V1_BUILD_TASKS.md`

The app name is **Okyo**.

## V1 Scope

Build:
- mock first-scan flow
- photo upload
- AI dish recognition
- recipe generation
- cost comparison
- grocery list
- saved recipe library
- share cards
- Dupe Challenge
- XP, badges, weekly rankings
- static Restaurant Packs
- freemium scan limits
- basic premium paywall
- analytics
- onboarding, settings, privacy/support screens

Do not build yet:
- full map
- full social feed
- comments
- DMs
- restaurant reviews

## Running Locally (mobile)

Quick one-command start (from repo root):

```bash
run
```

Mobile-specific (inside the mobile app):

```bash
cd apps/mobile
npm run sim
```

Notes:
- Use Node 22 (tested with Node v22.22.3).
- Xcode: 26.5 or newer to run the iOS Simulator.
- Expo SDK: ~55 (app uses expo ~55.0.0).
- The dev server uses port `8082` and the `--host lan` flag by default to avoid simulator connectivity issues with `localhost`/`127.0.0.1`.

## Current Fake-data Features (what's implemented)

- Onboarding flow
- Mock first-scan flow (photo + upload flows use typed mock data)
- Result summary with confidence, savings, and mode tabs
- Recipe detail with mode-specific recipes and ingredients
- Grocery list generation, copy/share, pantry checks
- Save to Library + Library screen
- Savings dashboard (weekly/total stats)
- Share card preview and native share/copy
- Dupe Challenge flow (start, mark cooked, rate, complete)
- Challenge complete screen with XP/badges
- XP, badges, and weekly rankings (mock data)
- Static Restaurant Packs and pack details
- Settings + onboarding reset + AsyncStorage persistence
- Analytics stubs (console logging only)

## Intentionally Not Built

- No backend or persistent cloud storage
- No real AI model or remote inference
- No payments or user accounts
- No social feed, comments, or maps

## Troubleshooting

- Expo Go incompatible: use the iOS Simulator or a supported Expo client version matching SDK 55.
- No devices booted: open Simulator from Xcode or run `open -a Simulator`.
- Could not connect to server: ensure the machine IP is reachable by the simulator and use `--host lan --port 8082`.
- Wrong folder / package.json does not exist: ensure you are in the repo root and `apps/mobile/package.json` exists.


## Clean Repo Structure

```text
okyo/
  README.md
  AGENTS.md
  .gitignore
  .env.example
  docs/
    wiki/
    seed/
```

## First Codex Prompt

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

After setup, tell me exactly what files you created and how to run the project.
```
