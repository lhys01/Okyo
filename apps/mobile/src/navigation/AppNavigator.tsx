import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';

import { analyticsEvents, track } from '../analytics/track';
import { colors } from '../theme/okyoTheme';
import { AnalysisLoadingScreen } from '../screens/AnalysisLoadingScreen';
import { ChallengeCompleteScreen } from '../screens/ChallengeCompleteScreen';
import { DupeChallengeScreen } from '../screens/DupeChallengeScreen';
import { FoodIdeaScreen } from '../screens/FoodIdeaScreen';
import { GoalScreen } from '../screens/GoalScreen';
import { RestaurantPackDetailScreen } from '../screens/RestaurantPackDetailScreen';
import { ResultSummaryScreen } from '../screens/ResultSummaryScreen';
import { KitchenLetterScreen } from '../screens/KitchenLetterScreen';
import { RecommendationCategoryScreen } from '../screens/RecommendationCategoryScreen';
import { SavingsDashboardScreen } from '../screens/SavingsDashboardScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ShareCardPreviewScreen } from '../screens/ShareCardPreviewScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';
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
  const hasCompletedOnboarding = useOkyoStore((state) => state.hasCompletedOnboarding);
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

  useEffect(() => {
    uiLog('AppNavigator', 'onboarding_state', { hasCompletedOnboarding });
  }, [hasCompletedOnboarding]);

  if (!hasCompletedOnboarding) {
    return (
      <Stack.Navigator
        key="onboarding"
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
      </Stack.Navigator>
    );
  }

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
      <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} options={{ title: 'Okyo' }} />
      <Stack.Screen name="GoalScreen" component={GoalScreen} options={{ title: 'Goal' }} />
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
      <Stack.Screen
        name="DupeChallengeScreen"
        component={DupeChallengeScreen}
        options={{ title: 'Dupe Challenge' }}
      />
      <Stack.Screen
        name="ChallengeCompleteScreen"
        component={ChallengeCompleteScreen}
        options={{ title: 'Challenge Complete' }}
      />
      <Stack.Screen
        name="RestaurantPackDetailScreen"
        component={RestaurantPackDetailScreen}
        options={{ title: 'Pack Detail' }}
      />
      <Stack.Screen
        name="SavingsDashboardScreen"
        component={SavingsDashboardScreen}
        options={{ headerShown: false, title: 'Savings' }}
      />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen
        name="RecommendationCategoryScreen"
        component={RecommendationCategoryScreen}
        options={{ headerShown: false, title: 'Food Ideas' }}
      />
      <Stack.Screen
        name="KitchenLetterScreen"
        component={KitchenLetterScreen}
        options={{ headerShown: false, presentation: 'modal', title: 'Kitchen Letter' }}
      />
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
