# State Management

## Purpose
Explains client state: the store, scan session lifecycle, saved data, and mock data boundaries.

## Source Files Inspected
`apps/mobile/src/state/useOkyoStore.ts`, `apps/mobile/src/mocks/index.ts`, `apps/mobile/src/screens/SettingsScreen.tsx`, `apps/api/src/store.ts`.

## Current Behavior

### Mobile: `useOkyoStore` (zustand + persist → AsyncStorage)
One store holds everything:
- **Onboarding/user choices:** `hasCompletedOnboarding`, `hasSeenOnboarding`, `onboardingGoal`, `weeklyGoal` (`1_meal`…`7_meals`), `mealRoutinePreference`, `notificationChoice`, `firstOnboardingScanCompleted`, `firstOnboardingResultSeen`, `paywallShown`.
- **Scan session:** `scanSessionId` + `latestScanSession` (`latestScanStatus`, `latestScanResult`, `latestScanFailure`, `latestScanRecipe`, `selectedScanImage`, `latestAiDebugMetadata`, `source`, `updatedAt`). Lifecycle: `beginLatestScanSession()` opens a session before the API call; `writeLatestScanSession()` commits result or failure. Session IDs prevent stale/overlapping scans from contaminating the UI.
- **Selected recipe mode:** `selectedMode` (Restaurant Copy / Budget / Healthy view projection).
- **Saved data:** saved recipes, completed challenges (rating, matchScore, moneySaved, xpEarned), XP/badges progress.

### Server: `apps/api/src/store.ts`
In-memory saved recipes, challenges, XP events (seeded from `mockData.ts`), plus `generatedRecipeStore` (24 h TTL) for deferred coaching. Resets on restart.

### Mock data involvement
Mobile `src/mocks/` supplies types and demo data (recipes, scan results, grocery lists, share cards, XP, restaurant packs) plus `safeData.ts` accessors (`getSafeRecipeForMode`, `getSafeRecipeMode`, …) that guard against malformed data. Real scans populate the store from API responses; mock data is for demo mode, packs, and non-scan UI.

### Reset paths
SettingsScreen: "Reset Onboarding" and "Delete Saved Data" clear persisted state for QA.

## Important Constraints
- Immutable updates only (zustand set with new objects).
- Everything is local — no server account state; don't build features that assume sync.
- Scan session writes must go through the session helpers, not direct field sets.

## Known Risks / Edge Cases
- AsyncStorage state resets on simulator reinstall — QA lists this as expected.
- Persisted shape changes need migration thought (persisted keys survive app updates).

## Related Docs
[SCAN_FLOW.md](./SCAN_FLOW.md) · [DATA_AND_MOCKS.md](./DATA_AND_MOCKS.md) · [ONBOARDING.md](./ONBOARDING.md)
