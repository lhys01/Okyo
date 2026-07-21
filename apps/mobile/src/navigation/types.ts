import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ScanImageMetadata } from '../api/types';
import type { Recipe, RecipeMode, ScanResult } from '../mocks';

export type ShareCardType = 'scan_result';

export type ShareScanContext = {
  image?: ScanImageMetadata | null;
  recipe?: Recipe | null;
  scanResult?: ScanResult | null;
};

export type RootStackParamList = {
  WelcomeScreen: undefined;
  FoodIdeaScreen: undefined;
  AnalysisLoadingScreen: { scanSessionId?: string } | undefined;
  ResultSummaryScreen: { scanSessionId?: string } | undefined;
  ShareCardPreviewScreen:
    | { cardType?: ShareCardType; mode?: RecipeMode; scanContext?: ShareScanContext }
    | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type MainTabParamList = {
  HomeScreen: undefined;
  GroceryListScreen: { mode?: RecipeMode } | undefined;
  LibraryScreen: undefined;
  SettingsScreen: undefined;
  RecipeDetailScreen: { mode?: RecipeMode } | undefined;
  RecipeStepsScreen: { mode?: RecipeMode } | undefined;
};
