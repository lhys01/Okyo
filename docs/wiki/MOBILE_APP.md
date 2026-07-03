# Mobile App

## Purpose
Overview of the Expo/React Native app in `apps/mobile`.

## Source Files Inspected
`apps/mobile/package.json`, `App.tsx`, `src/api/config.ts`, `src/api/client.ts`, `src/navigation/AppNavigator.tsx`, `src/navigation/MainTabs.tsx`, `src/state/useOkyoStore.ts`, `src/screens/*`, `src/theme/okyoTheme.ts`, `assets/food/index.ts`, `.env.example`.

## Current Behavior
- **Stack:** Expo SDK ~55, React Native 0.83.6, React 19.2, TypeScript, React Navigation (native-stack + bottom-tabs), Zustand 5 with AsyncStorage persistence, Reanimated 4, Skia, expo-image-picker/manipulator/file-system/notifications/sharing.
- **Entry:** `App.tsx` loads Baloo 2 + Nunito fonts and renders `AppNavigator` inside `NavigationContainer`.
- **Main screens:** Home, RestaurantPacks (Discover), Scan, Library (Plan), Profile tabs; stack screens for AnalysisLoading, ResultSummary, RecipeDetail, RecipeSteps, GroceryList, ShareCardPreview, DupeChallenge, ChallengeComplete, SavingsDashboard, Rankings, Settings, Paywall, KitchenLetter, RecommendationCategory, RestaurantPackDetail, Welcome (onboarding).
- **API client** (`src/api/client.ts`): plain `fetch` POST helper with 60 s AbortController timeout, dev-only request/response logging, and the `x-okyo-model: fable` header **only** when the dev override is active and the path is `/v1/scans`.
- **Env config** (`src/api/config.ts`): `EXPO_PUBLIC_OKYO_API_URL` (falls back to a LAN IP with a dev warning) and `EXPO_PUBLIC_OKYO_DEV_AI_MODEL` — honored only in `__DEV__` builds and only for the value `fable`.
- **State:** single `useOkyoStore` zustand store ([STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)).
- **Assets:** bundled food/mascot/animation assets under `apps/mobile/assets/` ([IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)).
- **Scan UI flow:** ScanScreen (or the onboarding scan step in WelcomeScreen) → image pick/capture → resize via expo-image-manipulator (max width 1400, ≤12 MB data URL) → copy to permanent Documents dir → POST `/v1/scans` → AnalysisLoadingScreen → ResultSummaryScreen ([SCAN_FLOW.md](./SCAN_FLOW.md)).

## Important Constraints
- No AI keys or provider calls in the mobile app — everything goes through the API.
- Production builds must never send the Fable header (dev override is `__DEV__`-gated).
- Expo Go does not support SDK 55 in this setup — use the iOS Simulator flow (`run` script or tunnel mode).

## Known Risks / Edge Cases
- Base URL fallback is a hardcoded LAN IP (`192.168.2.42`) — wrong on other machines; set `EXPO_PUBLIC_OKYO_API_URL`.
- Heavy dev logging in the API client is `__DEV__`-gated but verbose.
- Local state resets on simulator reinstall/data deletion.

## Related Docs
[NAVIGATION.md](./NAVIGATION.md) · [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [SCAN_FLOW.md](./SCAN_FLOW.md) · [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
