import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ScanImageMetadata } from '../api/types';
import type { Recipe, RecipeMode, ScanResult } from '../mocks';

export type ShareScanContext = {
  image?: ScanImageMetadata | null;
  recipe?: Recipe | null;
  scanResult?: ScanResult | null;
};

export type RootStackParamList = {
  WelcomeScreen: undefined;
  FoodIdeaScreen: undefined;
  ScanScreen: undefined;
  AnalysisLoadingScreen: { scanSessionId?: string } | undefined;
  ResultSummaryScreen: { scanSessionId?: string } | undefined;
  ShareCardPreviewScreen: { mode?: RecipeMode; scanContext?: ShareScanContext } | undefined;
  SettingsScreen: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type MainTabParamList = {
  HomeScreen: undefined;
  ScanScreen: undefined;
  LibraryScreen: undefined;
  ProfileScreen: undefined;
  RecipeDetailScreen: { mode?: RecipeMode } | undefined;
  RecipeStepsScreen: { mode?: RecipeMode } | undefined;
  GroceryListScreen: { mode?: RecipeMode } | undefined;
};
