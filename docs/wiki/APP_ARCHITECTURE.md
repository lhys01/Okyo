# App Architecture

## Purpose
Map of the repo and how the systems connect.

## Source Files Inspected
Repo root listing, `apps/api/src/*`, `apps/mobile/src/*`, `apps/*/package.json`, `docs/`, `scripts/`, `run`.

## Current Behavior

```
Okyo-1/
├── CLAUDE.md            # short routing file for AI agents (points here)
├── AGENTS.md            # Codex-flavored repo instructions
├── README.md            # human quickstart (some paths stale — see KNOWN_RISKS)
├── run                  # shell script: starts Expo on :8082 + iOS Simulator
├── apps/
│   ├── api/             # Express + TypeScript mock/AI API (port 8081)
│   │   └── src/
│   │       ├── server.ts            # all HTTP routes, zod validation, error envelope
│   │       ├── store.ts             # in-memory library/challenges/XP + generated-recipe TTL store
│   │       ├── mockData.ts          # seeded mock recipes/scans/packs
│   │       ├── types.ts             # shared API types
│   │       ├── config/              # aiConfig, costControlConfig, openRouter (Epicure)
│   │       ├── middleware/          # costControls (rate limit, daily caps)
│   │       └── services/            # aiService, openRouterProvider, epicureService,
│   │                                #   recipeIngredientValidation, analytics/eval loggers
│   └── mobile/          # Expo SDK 55 / React Native 0.83 app
│       └── src/
│           ├── api/                 # fetch client, base URL config, types
│           ├── navigation/          # AppNavigator (root stack) + MainTabs
│           ├── screens/             # ~20 screens incl. onboarding (WelcomeScreen)
│           ├── components/          # OkyoUI, KikoMascot, FoodImage, onboarding/
│           ├── state/useOkyoStore.ts# zustand + AsyncStorage persistence
│           ├── theme/               # okyoTheme design tokens
│           ├── mocks/ data/ utils/ analytics/
│           └── assets/ (../assets)  # food images, mascot, animations (~51 MB)
├── docs/
│   ├── wiki/            # THIS wiki (source of truth)
│   ├── audits/          # audit + regression reports, FABLE5_PROVIDER_DESIGN.md
│   ├── seed/            # product vision, viral hooks, seed datasets
│   ├── design/          # design artifacts
│   └── generated/       # generated screen images (do not edit)
└── scripts/download-food-images.sh  # swaps placeholder PNGs for Pexels photos
```

**How they connect:** mobile app calls the API over HTTP (`EXPO_PUBLIC_OKYO_API_URL`, default LAN IP, port 8081). API is stateless apart from in-memory stores and caches; there is **no database, auth, or file storage**. AI calls go API → OpenRouter only — the mobile app never holds AI keys.

## Important Constraints
- Two independent npm workspaces (`apps/api`, `apps/mobile`) — no root-level build orchestration.
- API responses use the envelope `{ ok: true, data }` / `{ ok: false, error: { code, message, details? } }`.
- Never touch `.swarm/`, `ruvector.db`, `node_modules`, `__pycache__`, generated skill mirrors (`.agent/`, `.claude/skills` mirrors, `.codebuddy/`, `.continue/`), `docs/generated/`.

## Known Risks / Edge Cases
- All server state is in-memory: caps, caches, saved library reset on restart ([COST_CONTROLS.md](./COST_CONTROLS.md)).
- Root `README.md` references an older path (`/Users/rober/Documents/Okyo-1`) and understates AI integration.

## Related Docs
[MOBILE_APP.md](./MOBILE_APP.md) · [API_BACKEND.md](./API_BACKEND.md) · [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) · [KNOWN_RISKS.md](./KNOWN_RISKS.md)
