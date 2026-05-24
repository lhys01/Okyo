# Frontend Architecture

## Stack

- React Native + Expo
- TypeScript
- React Navigation
- Zustand for local state
- TanStack Query for API state later
- Expo Image Picker / Camera
- Expo Sharing

## Suggested mobile structure

```text
apps/mobile/src/
  app/
    navigation/
    providers/
  screens/
    WelcomeScreen.tsx
    GoalScreen.tsx
    ScanScreen.tsx
    AnalysisLoadingScreen.tsx
    ResultSummaryScreen.tsx
    RecipeDetailScreen.tsx
    GroceryListScreen.tsx
    ShareCardPreviewScreen.tsx
    LibraryScreen.tsx
    SavingsDashboardScreen.tsx
    DupeChallengeScreen.tsx
    ChallengeCompleteScreen.tsx
    RankingsScreen.tsx
    RestaurantPacksScreen.tsx
    RestaurantPackDetailScreen.tsx
    SettingsScreen.tsx
    PaywallScreen.tsx
  components/
    RecipeCard.tsx
    CostComparisonCard.tsx
    ConfidenceBadge.tsx
    ModeTabs.tsx
    ShareCardPreview.tsx
    BadgeCard.tsx
    LeaderboardCard.tsx
  state/
    useOkyoStore.ts
  mocks/
    mockScanResults.ts
    mockRestaurantPacks.ts
  analytics/
    track.ts
```

## V1 tabs

After onboarding / first result:

- Scan
- Library
- Savings
- Rankings
- Packs
- Settings
