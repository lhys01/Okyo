import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AnalysisLoadingScreen } from '../screens/AnalysisLoadingScreen';
import { ChallengeCompleteScreen } from '../screens/ChallengeCompleteScreen';
import { DupeChallengeScreen } from '../screens/DupeChallengeScreen';
import { GoalScreen } from '../screens/GoalScreen';
import { GroceryListScreen } from '../screens/GroceryListScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { RestaurantPackDetailScreen } from '../screens/RestaurantPackDetailScreen';
import { ResultSummaryScreen } from '../screens/ResultSummaryScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { ShareCardPreviewScreen } from '../screens/ShareCardPreviewScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="WelcomeScreen"
      screenOptions={{
        contentStyle: { backgroundColor: '#fffaf3' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fffaf3' },
        headerTintColor: '#1d1b16',
      }}
    >
      <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} options={{ title: 'Okyo' }} />
      <Stack.Screen name="GoalScreen" component={GoalScreen} options={{ title: 'Goal' }} />
      <Stack.Screen name="ScanScreen" component={ScanScreen} options={{ title: 'Scan' }} />
      <Stack.Screen
        name="AnalysisLoadingScreen"
        component={AnalysisLoadingScreen}
        options={{ title: 'Analyzing' }}
      />
      <Stack.Screen
        name="ResultSummaryScreen"
        component={ResultSummaryScreen}
        options={{ title: 'Result' }}
      />
      <Stack.Screen
        name="RecipeDetailScreen"
        component={RecipeDetailScreen}
        options={{ title: 'Recipe' }}
      />
      <Stack.Screen
        name="GroceryListScreen"
        component={GroceryListScreen}
        options={{ title: 'Grocery List' }}
      />
      <Stack.Screen
        name="ShareCardPreviewScreen"
        component={ShareCardPreviewScreen}
        options={{ title: 'Share Preview' }}
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
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
