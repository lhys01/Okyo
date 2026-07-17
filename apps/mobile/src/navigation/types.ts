import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ScanImageMetadata } from '../api/types';
import type { Recipe, RecipeMode, ScanResult } from '../mocks';

export type ShareScanContext = {
  image?: ScanImageMetadata | null;
  recipe?: Recipe | null;
  scanResult?: ScanResult | null;
};

export type RootStackParamList = {
  FoodIdeaScreen: undefined;
  ScanScreen: { intent?: 'camera' | 'photos' } | undefined;
  AnalysisLoadingScreen: { scanSessionId?: string } | undefined;
  ResultSummaryScreen: { scanSessionId?: string } | undefined;
  ShareCardPreviewScreen: { mode?: RecipeMode; scanContext?: ShareScanContext } | undefined;
  RecipeDetailScreen: { mode?: RecipeMode; startCooking?: boolean } | undefined;
  RecipeStepsScreen: { mode?: RecipeMode } | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type MainTabParamList = {
  HomeScreen: undefined;
  GroceryListScreen: undefined;
  LibraryScreen: undefined;
  SettingsScreen: undefined;
};
