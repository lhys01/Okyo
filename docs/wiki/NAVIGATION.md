# Navigation

## Purpose
Explains the navigation tree and main screen relationships.

## Source Files Inspected
`apps/mobile/src/navigation/AppNavigator.tsx`, `apps/mobile/src/navigation/MainTabs.tsx`, `apps/mobile/src/navigation/types.ts`, `App.tsx`.

## Current Behavior
- **Root:** `AppNavigator` (native stack) gates on `hasCompletedOnboarding`:
  - **false** → onboarding stack: `WelcomeScreen` (whole onboarding state machine) + `MainTabs`.
  - **true** → main stack, `initialRouteName: MainTabs`.
- **MainTabs (bottom tabs):** visible tabs Home, Discover (RestaurantPacks), Scan, Plan (Library), Profile. Also registered as tab screens but reached programmatically: RecipeDetail, RecipeSteps (tab bar hidden), GroceryList.
- **Stack screens above tabs:** GoalScreen, ScanScreen (headerless full-screen), AnalysisLoadingScreen, ResultSummaryScreen, ShareCardPreviewScreen (modal), DupeChallengeScreen, ChallengeCompleteScreen, RestaurantPackDetailScreen, PaywallScreen, SavingsDashboardScreen, RankingsScreen, SettingsScreen, RecommendationCategoryScreen, KitchenLetterScreen (modal).
- **Core loop path:** Scan tab → ScanScreen → AnalysisLoadingScreen → ResultSummaryScreen → RecipeDetail / GroceryList / ShareCardPreview → save to Library.
- App open tracked once (`APP_OPEN`); onboarding state changes logged via `uiDebug`.

## Important Constraints
- Screen names are typed in `navigation/types.ts` (`RootStackParamList`) — add routes there first.
- Onboarding gate depends on persisted store state; resetting onboarding in Settings flips the whole tree.
- Headerless screens (Scan, Result, Savings) own their chrome via `ScreenScaffold`.

## Known Risks / Edge Cases
- Some destination screens are registered both patterns (tab screen vs stack) — follow existing usage when linking to RecipeDetail/GroceryList (they are tab screens, not stack screens).

## Related Docs
[MOBILE_APP.md](./MOBILE_APP.md) · [ONBOARDING.md](./ONBOARDING.md) · [SCAN_FLOW.md](./SCAN_FLOW.md)
