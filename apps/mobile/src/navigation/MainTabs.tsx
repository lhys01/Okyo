import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { LibraryScreen } from '../screens/LibraryScreen';
import { RankingsScreen } from '../screens/RankingsScreen';
import { RestaurantPacksScreen } from '../screens/RestaurantPacksScreen';
import { SavingsDashboardScreen } from '../screens/SavingsDashboardScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="ScanScreen"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fffaf3' },
        headerTintColor: '#1d1b16',
        sceneStyle: { backgroundColor: '#fffaf3' },
        tabBarActiveTintColor: '#1d1b16',
        tabBarInactiveTintColor: '#837b6f',
        tabBarStyle: { backgroundColor: '#fffaf3', borderTopColor: '#eadfce' },
      }}
    >
      <Tab.Screen name="ScanScreen" component={ScanScreen} options={{ title: 'Scan' }} />
      <Tab.Screen name="LibraryScreen" component={LibraryScreen} options={{ title: 'Library' }} />
      <Tab.Screen
        name="SavingsDashboardScreen"
        component={SavingsDashboardScreen}
        options={{ title: 'Savings', tabBarLabel: 'Savings' }}
      />
      <Tab.Screen name="RankingsScreen" component={RankingsScreen} options={{ title: 'Rankings' }} />
      <Tab.Screen
        name="RestaurantPacksScreen"
        component={RestaurantPacksScreen}
        options={{ title: 'Packs', tabBarLabel: 'Packs' }}
      />
      <Tab.Screen name="SettingsScreen" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
