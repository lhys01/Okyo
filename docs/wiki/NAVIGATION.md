# Navigation

## Purpose
Explain app navigation and main screen relationships.

## Source Files Inspected
- `apps/mobile/App.tsx`
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/navigation/MainTabs.tsx`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/screens/*.tsx`

## Current Behavior
`App.tsx` renders `NavigationContainer` and `AppNavigator`.

`AppNavigator` has two modes:
- If onboarding is incomplete, it renders a stack with `WelcomeScreen` and `MainTabs`, header hidden.
- If onboarding is complete, it starts at `MainTabs` and includes stack routes for scan, loading, result, share preview, Dupe Challenge, challenge complete, restaurant pack detail, paywall, savings, rankings, settings, recommendation category, and Kitchen Letter.

`MainTabs` includes Home, Discover/restaurant packs, Scan, Plan/library, Profile, Recipe Detail, Recipe Steps, and Grocery List. The visible custom tab order is Home, Grocery, Plan, Profile, with Scan as a central floating action. The tab bar hides on Recipe Steps.

Scan paths commonly move:
- Scan tab -> `AnalysisLoadingScreen` -> `ResultSummaryScreen`
- Result -> recipe detail, grocery list, share preview, save/library, or scan again
- Onboarding first result -> paywall preview -> main tabs/recipe detail

## Important Constraints
- Keep scan as a primary reachable action.
- Do not strand users on loading; the current loading screen has a safety fallback.
- Maintain typed route params in `navigation/types.ts`.
- Avoid adding complex social/navigation surfaces unless requested.

## Known Risks or Edge Cases
- `GoalScreen` remains in stack but the newer onboarding flow mostly uses `WelcomeScreen`.
- Some screens are tab routes but hidden from the custom tab UI.
- Resetting onboarding changes the root navigator key and route tree.

## Related Docs
- [MOBILE_APP.md](./MOBILE_APP.md)
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [ONBOARDING.md](./ONBOARDING.md)
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
