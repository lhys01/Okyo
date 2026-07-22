import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import {
  Book,
  Camera,
  Cart,
  Compass,
  HomeSimple,
  Settings,
  User,
} from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamilies } from '../components/OkyoUI';
import { GroceryListScreen } from '../screens/GroceryListScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RecipeDetailScreen, RecipeStepsScreen } from '../screens/RecipeDetailScreen';
import { RestaurantPacksScreen } from '../screens/RestaurantPacksScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabRouteName = keyof MainTabParamList;

const tabLabels: Record<MainTabRouteName, string> = {
  HomeScreen: 'Home',
  RestaurantPacksScreen: 'Discover',
  ScanScreen: 'Scan',
  LibraryScreen: 'Saved',
  ProfileScreen: 'Profile',
  SettingsScreen: 'Settings',
  RecipeDetailScreen: 'Recipe',
  RecipeStepsScreen: 'Steps',
  GroceryListScreen: 'Grocery',
};

const visibleTabOrder: MainTabRouteName[] = [
  'HomeScreen',
  'GroceryListScreen',
  'LibraryScreen',
  'SettingsScreen',
];

function TabIcon({ color, focused, routeName }: { color: string; focused: boolean; routeName: MainTabRouteName }) {
  const iconSize = routeName === 'ScanScreen' ? 36 : focused ? 27 : 26;
  const strokeWidth = routeName === 'ScanScreen' ? 2.1 : focused ? 2.2 : 1.9;

  switch (routeName) {
    case 'HomeScreen':
      return <HomeSimple color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'RestaurantPacksScreen':
      return <Compass color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'GroceryListScreen':
      return <Cart color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'LibraryScreen':
      return <Book color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'ProfileScreen':
      return <User color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'SettingsScreen':
      return <Settings color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'ScanScreen':
    default:
      return <Camera color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
  }
}

function FloatingTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const routesByName = Object.fromEntries(
    state.routes.map((route) => [route.name as MainTabRouteName, route]),
  ) as Record<MainTabRouteName, (typeof state.routes)[number]>;
  const focusedRoute = state.routes[state.index];

  if (focusedRoute?.name === 'RecipeStepsScreen') {
    return null;
  }

  const navigateToTab = (routeName: MainTabRouteName) => {
    const route = routesByName[routeName];

    if (!route) {
      return;
    }

    const isFocused = focusedRoute?.key === route.key;
    const event = navigation.emit({
      canPreventDefault: true,
      target: route.key,
      type: 'tabPress',
    });

    if (!isFocused && !event.defaultPrevented) {
      if (routeName === 'GroceryListScreen') {
        navigation.navigate('GroceryListScreen', { mode: undefined });
        return;
      }

      navigation.navigate(route.name);
    }
  };

  const onLongPress = (routeName: MainTabRouteName) => {
    const route = routesByName[routeName];

    if (!route) {
      return;
    }

    navigation.emit({
      target: route.key,
      type: 'tabLongPress',
    });
  };

  const renderSideTab = (routeName: MainTabRouteName) => {
    const route = routesByName[routeName];

    if (!route) {
      return null;
    }

    const descriptor = descriptors[route.key];
    const options = descriptor?.options;
    const focused = focusedRoute?.key === route.key;
    const color = focused ? colors.charcoal : inactiveGray;
    const label =
      typeof options?.tabBarLabel === 'string'
        ? options.tabBarLabel
        : options?.title ?? tabLabels[routeName];

    return (
      <Pressable
        key={routeName}
        accessibilityLabel={options?.tabBarAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : undefined}
        hitSlop={8}
        style={({ pressed }) => [styles.sideTab, pressed ? styles.tabPressed : null]}
        testID={options?.tabBarButtonTestID}
        onLongPress={() => onLongPress(routeName)}
        onPress={() => navigateToTab(routeName)}
      >
        <TabIcon color={color} focused={focused} routeName={routeName} />
        <Text numberOfLines={1} style={[styles.sideLabel, focused ? styles.sideLabelActive : null]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.tabBarRoot, { height: 122 + bottomInset }]}>
      <View style={[styles.tabBarPill, { bottom: bottomInset + 8 }]}>
        <BlurView intensity={34} pointerEvents="none" style={styles.tabBarBlur} tint="light" />
        <View style={styles.sideTabRow}>
          {visibleTabOrder.map(renderSideTab)}
        </View>
      </View>
    </View>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeScreen"
      tabBar={(props) => {
        const focusedRoute = props.state.routes[props.state.index];

        if (focusedRoute.name === 'RecipeStepsScreen') {
          return null;
        }

        return <FloatingTabBar {...props} />;
      }}
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tab.Screen name="HomeScreen" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="RestaurantPacksScreen" component={RestaurantPacksScreen} options={{ title: 'Discover' }} />
      <Tab.Screen name="ScanScreen" component={ScanScreen} options={{ title: 'Scan' }} />
      <Tab.Screen name="LibraryScreen" component={LibraryScreen} options={{ title: 'Saved' }} />
      <Tab.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Tab.Screen name="SettingsScreen" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Tab.Screen name="RecipeDetailScreen" component={RecipeDetailScreen} options={{ title: 'Recipe' }} />
      <Tab.Screen name="RecipeStepsScreen" component={RecipeStepsScreen} options={{ title: 'Steps', tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="GroceryListScreen" component={GroceryListScreen} options={{ title: 'Grocery' }} />
    </Tab.Navigator>
  );
}

const inactiveGray = '#a39b8e';

const styles = StyleSheet.create({
  tabBarRoot: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  tabBarPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderColor: 'rgba(255, 255, 255, 0.76)',
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    height: 76,
    justifyContent: 'center',
    left: 14,
    overflow: 'visible',
    paddingHorizontal: 8,
    position: 'absolute',
    right: 14,
    shadowColor: '#3a2d1d',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  // Glass layer behind the tab row. On Android BlurView falls back to a
  // translucent fill, which still reads correctly against the ivory canvas.
  tabBarBlur: {
    borderRadius: 34,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sideTabRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
    width: '100%',
  },
  sideTab: {
    alignItems: 'center',
    borderRadius: 22,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  sideLabel: {
    color: inactiveGray,
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 13,
    maxWidth: '100%',
    textAlign: 'center',
  },
  sideLabelActive: {
    color: colors.charcoal,
    fontWeight: '700',
  },
  tabPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
