import type { NavigatorScreenParams } from '@react-navigation/native';
import type { RecipeMode } from '../mocks';

export type ShareCardType =
  | 'scan_result'
  | 'challenge_result'
  | 'ranking'
  | 'badge'
  | 'restaurant_pack';

export type RootStackParamList = {
  WelcomeScreen: undefined;
  GoalScreen: undefined;
  ScanScreen: undefined;
  AnalysisLoadingScreen: undefined;
  ResultSummaryScreen: undefined;
  RecipeDetailScreen: { mode?: RecipeMode } | undefined;
  GroceryListScreen: { mode?: RecipeMode } | undefined;
  ShareCardPreviewScreen:
    | { cardType?: ShareCardType; mode?: RecipeMode; packId?: string; dishId?: string }
    | undefined;
  DupeChallengeScreen: { mode?: RecipeMode } | undefined;
  ChallengeCompleteScreen: { challengeId?: string } | undefined;
  RestaurantPackDetailScreen: { packId?: string } | undefined;
  PaywallScreen: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type MainTabParamList = {
  ScanScreen: undefined;
  LibraryScreen: undefined;
  SavingsDashboardScreen: undefined;
  RankingsScreen: undefined;
  RestaurantPacksScreen: undefined;
  SettingsScreen: undefined;
};
