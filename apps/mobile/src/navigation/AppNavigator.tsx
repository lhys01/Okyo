import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';

import { analyticsEvents, track } from '../analytics/track';
import { colors } from '../theme/okyoTheme';
import { AnalysisLoadingScreen } from '../screens/AnalysisLoadingScreen';
import { FoodIdeaScreen } from '../screens/FoodIdeaScreen';
import { ResultSummaryScreen } from '../screens/ResultSummaryScreen';
import { RecipeDetailScreen, RecipeStepsScreen } from '../screens/RecipeDetailScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { ShareCardPreviewScreen } from '../screens/ShareCardPreviewScreen';
import { useOkyoStore } from '../state/useOkyoStore';
import { defaultScanResult, getSafeRecipeForMode, getSafeRecipeMode } from '../mocks';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const devResultSummaryQaScanSessionId = 'dev-result-summary-qa';
const shouldOpenDevResultSummaryQa =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_OKYO_RESULT_SUMMARY_QA === '1';

export function AppNavigator() {
  const didTrackAppOpen = useRef(false);
  const didSeedDevResultSummaryQa = useRef(false);

  if (shouldOpenDevResultSummaryQa && !didSeedDevResultSummaryQa.current) {
    didSeedDevResultSummaryQa.current = true;
    seedDevResultSummaryQa();
  }

  useEffect(() => {
    if (didTrackAppOpen.current) {
      return;
    }

    didTrackAppOpen.current = true;
    track(analyticsEvents.APP_OPEN);
  }, []);

  return (
    <Stack.Navigator
      key="main"
      initialRouteName={shouldOpenDevResultSummaryQa ? 'ResultSummaryScreen' : 'MainTabs'}
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'generic',
        headerBackTitle: 'Back',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.charcoal,
      }}
    >
      <Stack.Screen name="FoodIdeaScreen" component={FoodIdeaScreen} options={{ headerShown: false, title: 'Food Idea' }} />
      <Stack.Screen name="ScanScreen" component={ScanScreen} options={{ headerShown: false, title: 'Scan' }} />
      <Stack.Screen
        name="AnalysisLoadingScreen"
        component={AnalysisLoadingScreen}
        options={{ headerShown: false, title: 'Analyzing' }}
      />
      <Stack.Screen
        name="ResultSummaryScreen"
        component={ResultSummaryScreen}
        options={{ headerShown: false, title: 'Result' }}
      />
      <Stack.Screen
        name="ShareCardPreviewScreen"
        component={ShareCardPreviewScreen}
        options={{ headerShown: false, presentation: 'modal', title: 'Share Preview' }}
      />
      <Stack.Screen name="RecipeDetailScreen" component={RecipeDetailScreen} options={{ headerShown: false, title: 'Recipe' }} />
      <Stack.Screen name="RecipeStepsScreen" component={RecipeStepsScreen} options={{ headerShown: false, title: 'Cooking' }} />
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false, title: 'Okyo' }} />
    </Stack.Navigator>
  );
}

function seedDevResultSummaryQa() {
  const state = useOkyoStore.getState();
  const mode = getSafeRecipeMode(state.selectedMode);

  if (
    state.scanSessionId === devResultSummaryQaScanSessionId &&
    state.latestScanStatus === 'success' &&
    state.latestScanResult?.id === defaultScanResult.id
  ) {
    return;
  }

  state.setSelectedMode(mode);
  state.beginLatestScanSession({
    scanSessionId: devResultSummaryQaScanSessionId,
    latestScanStatus: 'success',
    latestScanFailure: null,
    latestScanResult: defaultScanResult,
    latestScanRecipe: getSafeRecipeForMode(mode),
    selectedScanImage: { source: 'mock', placeholder: true },
    latestAiDebugMetadata: {
      aiSource: 'mock_ai',
      confidence: defaultScanResult.confidence,
      fallbackReason: 'dev_result_summary_qa',
    },
    source: 'mock',
    reason: 'AppNavigator.devResultSummaryQa',
  });
}
