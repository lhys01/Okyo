# Local Development

## Purpose
Give exact local commands for installing dependencies, running API/mobile, and typechecking.

## Source Files Inspected
- `package.json`
- `apps/api/package.json`
- `apps/mobile/package.json`
- `apps/api/README.md`
- `apps/api/.env.example`
- `apps/mobile/.env.example`
- `run`

## Current Behavior
Dependencies are split by root, API, and mobile package manifests. In this workspace, `node_modules` are not installed; `npm ls --depth=0` reports unmet dependencies until install is run.

Install:
```bash
npm install
cd apps/api && npm install
cd ../mobile && npm install
```

API dev server:
```bash
cd apps/api
npm run dev
```

API typecheck:
```bash
cd apps/api
npm run typecheck
```

Mobile Expo server:
```bash
cd apps/mobile
npm start
```

Mobile iOS/Android/web helpers:
```bash
cd apps/mobile
npm run ios
npm run android
npm run web
```

Mobile typecheck:
```bash
cd apps/mobile
npx tsc --noEmit
```

Repo-local helper:
```bash
./run
```

## Important Constraints
- Start the API separately before testing real scan requests from mobile.
- Set `EXPO_PUBLIC_OKYO_API_URL` to a URL reachable by the simulator/device.
- Do not commit lockfile churn unless dependency changes are intentional.
- Do not edit `.env` examples with real keys.

## Known Risks or Edge Cases
- Current workspace has no installed dependencies, so validation commands fail until install.
- Older README paths refer to a different local directory; use the current workspace path.
- Mobile dependency compatibility should be checked with Expo SDK 55 if dependency versions change.

## Related Docs
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)
- [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md)
