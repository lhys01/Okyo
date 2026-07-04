# State Management

## Purpose
Explain store/state files, scan state, saved recipes, user choices, and mock data involved.

## Source Files Inspected
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/mocks/*.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/api/src/store.ts`
- `apps/api/src/mockData.ts`

## Current Behavior
Mobile state uses Zustand with AsyncStorage persistence. The store tracks onboarding completion, weekly goal, routine/notification choices, first scan flags, paywall shown, latest scan session, selected mode, saved recipes, completed challenges, money saved, weekly scan count, premium flag, XP, badges, awarded XP events, and leaderboard entries.

The scan session model stores:
- `scanSessionId`
- `latestScanStatus`
- `latestScanResult`
- `latestScanFailure`
- `latestScanRecipe`
- `selectedScanImage`
- `latestAiDebugMetadata`
- `source`
- `updatedAt`

Writes are guarded so stale scan responses do not overwrite the active session. Clearing a latest scan can delete unused local scan images if they are not attached to saved recipes.

API state is in memory: saved recipes, completed challenges, XP events, and generated recipes with a 24-hour TTL for deferred coaching.

## Important Constraints
- Preserve active scan-session guards when changing async scan behavior.
- Keep saved recipe image attachment explicit and user-driven.
- Mock data should support demos but not masquerade as real scan output.
- Persisted mobile state may need migrations before production.

## Known Risks or Edge Cases
- No Zustand migration/versioning is configured.
- API memory state resets on restart.
- AsyncStorage can grow if users save many recipes/images.

## Related Docs
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md)
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
- [MOBILE_APP.md](./MOBILE_APP.md)
