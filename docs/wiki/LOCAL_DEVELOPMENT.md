# Local Development

## Purpose
Exact commands to run and validate Okyo locally.

## Source Files Inspected
`apps/api/package.json`, `apps/mobile/package.json`, `README.md`, `run`, `docs/wiki/KNOWN_ISSUES.md`.

## Requirements
Node 22, Xcode + iOS Simulator, Expo SDK 55 (Expo Go generally incompatible — use the simulator).

## Commands

### API dev server (port 8081)
```bash
cd apps/api
npm install
npm run dev          # tsx watch src/server.ts
curl http://localhost:8081/health
```

### Mobile Expo server (port 8082)
```bash
cd apps/mobile
npm install
npx expo start -c --tunnel --port 8082   # reliable simulator path; press i for iOS
# or LAN mode:
npm run sim          # expo start -c --host lan --port 8082
# or the repo-root ./run script (starts Expo + boots the iOS Simulator)
```
Tunnel mode is intentional: `localhost`/`127.0.0.1` were unreliable from the simulator in this setup.

### Typecheck (run before every commit)
```bash
cd apps/api && npm run typecheck      # tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

### Env setup
Copy `.env.example` → `.env` in `apps/api` (and optionally `apps/mobile`), see [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md). Without `.env` everything runs in mock mode.

## Dependency Notes
- `apps/api` and `apps/mobile` are separate installs — `npm install` in each.
- Mobile pins exact versions for native-adjacent packages (`@shopify/react-native-skia 2.4.18`, `react-native-view-shot 4.0.3`, AsyncStorage 2.2.0) against React 19.2/RN 0.83 — don't bump these casually; Expo SDK 55 compatibility is the constraint.
- No lockfile-breaking peer conflict is currently documented; if `npm install` hits ERESOLVE after a dependency bump, prefer aligning to Expo SDK 55's expected versions over `--legacy-peer-deps`.
- No test runner is configured in either app ([TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)).

## Known Risks / Edge Cases
- Root `README.md` still references `/Users/rober/Documents/Okyo-1`; the working copy is `/Users/rober/Desktop/Okyo-1`. Trust the relative paths here.
- Port collisions: check `lsof -nP -iTCP:8082 -sTCP:LISTEN`.
- Simulator camera unreliable — QA with Upload From Photos.

## Related Docs
[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) · [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md) · legacy [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
