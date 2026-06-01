import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Bag,
  Book,
  Camera,
  Dollar,
  Settings as SettingsIcon,
  Trophy,
} from 'iconoir-react-native';

import { colors } from '../components/OkyoUI';
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
      screenOptions={({ route }) => ({
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.charcoal,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.coral,
        tabBarAllowFontScaling: false,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, size }) => {
          const iconSize = Math.min(size, 23);

          switch (route.name) {
            case 'LibraryScreen':
              return <Book color={color} height={iconSize} strokeWidth={2.15} width={iconSize} />;
            case 'SavingsDashboardScreen':
              return <Dollar color={color} height={iconSize} strokeWidth={2.15} width={iconSize} />;
            case 'RankingsScreen':
              return <Trophy color={color} height={iconSize} strokeWidth={2.15} width={iconSize} />;
            case 'RestaurantPacksScreen':
              return <Bag color={color} height={iconSize} strokeWidth={2.15} width={iconSize} />;
            case 'SettingsScreen':
              return <SettingsIcon color={color} height={iconSize} strokeWidth={2.15} width={iconSize} />;
            case 'ScanScreen':
            default:
              return <Camera color={color} height={iconSize + 1} strokeWidth={2.2} width={iconSize + 1} />;
          }
        },
        tabBarIconStyle: {
          marginBottom: -1,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          includeFontPadding: false,
          lineHeight: 13,
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 74,
          paddingBottom: 10,
          paddingTop: 7,
        },
      })}
    >
      <Tab.Screen name="ScanScreen" component={ScanScreen} options={{ title: 'Scan', headerShown: false }} />
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
