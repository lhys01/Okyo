# Mobile App

## Purpose
Document the Expo app, screens, API client, environment config, navigation, state, assets, and scan UI flow.

## Source Files Inspected
- `apps/mobile/App.tsx`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/api/config.ts`
- `apps/mobile/src/api/types.ts`
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/navigation/MainTabs.tsx`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/screens/WelcomeScreen.tsx`
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/theme/okyoTheme.ts`

## Current Behavior
The app is an Expo SDK 55 React Native app named Okyo. `App.tsx` loads Baloo 2 and Nunito fonts, wraps the app in `NavigationContainer`, and renders `AppNavigator`.

Main surfaces include onboarding, home, scan, analysis loading, result summary, recipe detail/steps, grocery list, saved library, profile, settings, savings dashboard, recommendations, restaurant packs, share preview, rankings, and Dupe Challenge.

The mobile API client posts to `/v1/scans` with JSON. `OKYO_API_BASE_URL` comes from `EXPO_PUBLIC_OKYO_API_URL`, falling back to a local LAN URL in dev. `EXPO_PUBLIC_OKYO_DEV_AI_MODEL=fable` is honored only in `__DEV__` and only adds `x-okyo-model: fable` for scan requests.

Scan UI compresses picked images, builds a JPEG data URL when under size limits, persists a preview copy to Documents, starts a scan session in Zustand, navigates to loading, then writes success/failure state for the result screen.

## Important Constraints
- Production mobile builds must not send `x-okyo-model: fable`.
- Real uploaded image failures must show a clear failure state, not unrelated mock pasta.
- User scan photos are copied to app Documents for result/save continuity; do not introduce broader image storage without explicit consent.
- Keep screens mobile-first and aligned with Okyo’s warm, simple visual style.

## Known Risks or Edge Cases
- If `EXPO_PUBLIC_OKYO_API_URL` is missing, dev uses a hardcoded LAN fallback that may be wrong on another network.
- Image conversion can fail or exceed 12 MB; mobile sends conversion metadata and the API should fail honestly.
- `npm ls` currently reports unmet dependencies because packages are not installed.

## Related Docs
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [ONBOARDING.md](./ONBOARDING.md)
- [NAVIGATION.md](./NAVIGATION.md)
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
