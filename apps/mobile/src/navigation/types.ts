import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ScanImageMetadata } from '../api/types';
import type { Recipe, RecipeMode, ScanResult } from '../mocks';

export type ShareCardType =
  | 'scan_result'
  | 'challenge_result'
  | 'ranking'
  | 'badge'
  | 'restaurant_pack';

export type ShareScanContext = {
  image?: ScanImageMetadata | null;
  recipe?: Recipe | null;
  scanResult?: ScanResult | null;
};

export type RootStackParamList = {
  WelcomeScreen: undefined;
  GoalScreen: undefined;
  FoodIdeaScreen: undefined;
  ScanScreen: undefined;
  AnalysisLoadingScreen: { scanSessionId?: string } | undefined;
  ResultSummaryScreen: { scanSessionId?: string } | undefined;
  ShareCardPreviewScreen:
    | { cardType?: ShareCardType; mode?: RecipeMode; packId?: string; dishId?: string; scanContext?: ShareScanContext }
    | undefined;
  DupeChallengeScreen: { mode?: RecipeMode } | undefined;
  ChallengeCompleteScreen: { challengeId?: string } | undefined;
  RestaurantPackDetailScreen: { packId?: string } | undefined;
  SavingsDashboardScreen: undefined;
  SettingsScreen: undefined;
  RecommendationCategoryScreen: { category?: string } | undefined;
  KitchenLetterScreen: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type MainTabParamList = {
  HomeScreen: undefined;
  RestaurantPacksScreen: undefined;
  ScanScreen: undefined;
  LibraryScreen: undefined;
  ProfileScreen: undefined;
  RecipeDetailScreen: { mode?: RecipeMode } | undefined;
  RecipeStepsScreen: { mode?: RecipeMode } | undefined;
  GroceryListScreen: { mode?: RecipeMode } | undefined;
};
