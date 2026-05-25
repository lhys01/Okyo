export type RootStackParamList = {
  WelcomeScreen: undefined;
  GoalScreen: undefined;
  ScanScreen: undefined;
  AnalysisLoadingScreen: undefined;
  ResultSummaryScreen: undefined;
  RecipeDetailScreen: { mode?: RecipeMode } | undefined;
  GroceryListScreen: undefined;
  ShareCardPreviewScreen: undefined;
  DupeChallengeScreen: undefined;
  ChallengeCompleteScreen: undefined;
  RestaurantPackDetailScreen: undefined;
  PaywallScreen: undefined;
  MainTabs: undefined;
};

type RecipeMode = 'Restaurant Copy' | 'Budget' | 'Healthy';

export type MainTabParamList = {
  ScanScreen: undefined;
  LibraryScreen: undefined;
  SavingsDashboardScreen: undefined;
  RankingsScreen: undefined;
  RestaurantPacksScreen: undefined;
  SettingsScreen: undefined;
};
