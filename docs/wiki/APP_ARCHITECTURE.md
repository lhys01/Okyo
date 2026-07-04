# App Architecture

## Purpose
Map the repository structure and how the mobile app, API, docs, scripts, and config files connect.

## Source Files Inspected
- `package.json`
- `.gitignore`
- `apps/api/package.json`
- `apps/api/src/server.ts`
- `apps/api/src/store.ts`
- `apps/mobile/package.json`
- `apps/mobile/App.tsx`
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/api/client.ts`
- `docs/**`
- `scripts/download-food-images.sh`

## Current Behavior
The repo has two main apps:
- `apps/mobile`: Expo React Native app using TypeScript, React Navigation, Zustand, Expo Image Picker, Expo FileSystem, Expo Sharing, Expo Notifications, and local assets.
- `apps/api`: Express TypeScript API using Zod validation, dotenv config, OpenRouter-backed AI services, in-memory stores, and mock data.

Supporting areas:
- `docs/wiki`: contributor-facing source of truth for current behavior.
- `docs/audits`, `docs/design`, `docs/seed`: prior audits, design notes, generated onboarding previews, seed content, and product references.
- `docs/generated`: generated screen image batches; do not churn casually.
- `scripts/download-food-images.sh`: fills local recipe image placeholders.
- Root config files include `.gitignore`, `.env.example`, `package.json`, `opencode.json`, `manifest.json`, and `run`.

Mobile sends scan requests to the API through `apps/mobile/src/api/client.ts`. The API validates input, checks cost gates, runs AI scan/recipe logic, then returns a typed response consumed by mobile state and screens.

## Important Constraints
- Keep mobile and API contracts aligned through `apps/mobile/src/api/types.ts` and `apps/api/src/types.ts`.
- Avoid changing repository structure unless required by the task.
- Runtime/generated folders are not source: `.swarm/`, `ruvector.db`, `node_modules/`, `dist/`, `.expo/`, generated native folders, and logs should stay out of commits.

## Known Risks or Edge Cases
- Current API state is in memory, so saved recipes and caps reset on restart.
- Existing top-level README has some stale setup paths and older fallback wording.
- `node_modules` are absent in this workspace, so commands fail until dependencies are installed.

## Related Docs
- [MOBILE_APP.md](./MOBILE_APP.md)
- [API_BACKEND.md](./API_BACKEND.md)
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)
