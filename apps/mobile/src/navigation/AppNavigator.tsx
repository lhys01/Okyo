import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';

import { analyticsEvents, track } from '../analytics/track';
import { colors } from '../theme/okyoTheme';
import { AnalysisLoadingScreen } from '../screens/AnalysisLoadingScreen';
import { ChallengeCompleteScreen } from '../screens/ChallengeCompleteScreen';
import { DupeChallengeScreen } from '../screens/DupeChallengeScreen';
import { FoodIdeaScreen } from '../screens/FoodIdeaScreen';
import { GoalScreen } from '../screens/GoalScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { RestaurantPackDetailScreen } from '../screens/RestaurantPackDetailScreen';
import { ResultSummaryScreen } from '../screens/ResultSummaryScreen';
import { KitchenLetterScreen } from '../screens/KitchenLetterScreen';
import { RankingsScreen } from '../screens/RankingsScreen';
import { RecommendationCategoryScreen } from '../screens/RecommendationCategoryScreen';
import { SavingsDashboardScreen } from '../screens/SavingsDashboardScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ShareCardPreviewScreen } from '../screens/ShareCardPreviewScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const hasCompletedOnboarding = useOkyoStore((state) => state.hasCompletedOnboarding);
  const didTrackAppOpen = useRef(false);

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
      initialRouteName="MainTabs"
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
      <Stack.Screen name="PaywallScreen" component={PaywallScreen} options={{ title: 'Okyo Plus' }} />
      <Stack.Screen
        name="SavingsDashboardScreen"
        component={SavingsDashboardScreen}
        options={{ headerShown: false, title: 'Savings' }}
      />
      <Stack.Screen name="RankingsScreen" component={RankingsScreen} options={{ title: 'Rankings' }} />
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
