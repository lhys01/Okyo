import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Book, Cart, HomeSimple, Settings } from 'iconoir-react-native';
import { Platform } from 'react-native';

import { GroceryListScreen } from '../screens/GroceryListScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors, fontFamilies } from '../theme/okyoTheme';
import { PRIMARY_TABS } from './primaryTabs';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeScreen"
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.coralDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarAllowFontScaling: true,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, focused, size }) => {
          const iconSize = Math.max(size, focused ? 27 : 25);
          const iconProps = { color, height: iconSize, strokeWidth: focused ? 2.3 : 1.9, width: iconSize };
          switch (route.name) {
            case 'GroceryListScreen':
              return <Cart {...iconProps} />;
            case 'LibraryScreen':
              return <Book {...iconProps} />;
            case 'SettingsScreen':
              return <Settings {...iconProps} />;
            case 'HomeScreen':
            default:
              return <HomeSimple {...iconProps} />;
          }
        },
        tabBarItemStyle: { minHeight: 56, paddingVertical: 5 },
        tabBarLabelStyle: {
          fontFamily: fontFamilies.bold,
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          paddingTop: 6,
        },
      })}
    >
      <Tab.Screen name={PRIMARY_TABS[0].route} component={HomeScreen} options={{ title: PRIMARY_TABS[0].title }} />
      <Tab.Screen name={PRIMARY_TABS[1].route} component={GroceryListScreen} options={{ title: PRIMARY_TABS[1].title }} />
      <Tab.Screen name={PRIMARY_TABS[2].route} component={LibraryScreen} options={{ title: PRIMARY_TABS[2].title }} />
      <Tab.Screen name={PRIMARY_TABS[3].route} component={SettingsScreen} options={{ title: PRIMARY_TABS[3].title }} />
    </Tab.Navigator>
  );
}
