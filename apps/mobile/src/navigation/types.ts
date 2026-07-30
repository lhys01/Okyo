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
  AnalysisLoadingScreen: { scanSessionId?: string } | undefined;
  ResultSummaryScreen: { recipeId?: string; scanSessionId?: string } | undefined;
  ShareCardPreviewScreen:
    | {
        cardType?: ShareCardType;
        mode?: RecipeMode;
        recipeId?: string;
        packId?: string;
        dishId?: string;
        scanContext?: ShareScanContext;
      }
    | undefined;
  DupeChallengeScreen: { mode?: RecipeMode; recipeId?: string } | undefined;
  ChallengeCompleteScreen: { challengeId?: string } | undefined;
  RestaurantPackDetailScreen: { packId?: string } | undefined;
  PaywallScreen: undefined;
  SavingsDashboardScreen: undefined;
  RankingsScreen: undefined;
  SettingsScreen: undefined;
  RecommendationCategoryScreen: { category?: string } | undefined;
  KitchenLetterScreen: undefined;
  DescribeMealScreen: { initialDescription?: string } | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type MainTabParamList = {
  HomeScreen: undefined;
  RestaurantPacksScreen: undefined;
  LibraryScreen: undefined;
  ProfileScreen: undefined;
  SettingsScreen: undefined;
  RecipeDetailScreen: { recipeId?: string; mode?: RecipeMode } | undefined;
  RecipeStepsScreen: { completion?: boolean; recipeId?: string; mode?: RecipeMode } | undefined;
  GroceryListScreen: { recipeId?: string; mode?: RecipeMode } | undefined;
};
