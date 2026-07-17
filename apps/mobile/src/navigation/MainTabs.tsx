import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import {
  Book,
  Camera,
  Cart,
  HomeSimple,
  User,
} from 'iconoir-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamilies } from '../theme/okyoTheme';
import { GroceryListScreen } from '../screens/GroceryListScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RecipeDetailScreen, RecipeStepsScreen } from '../screens/RecipeDetailScreen';
import { ScanScreen } from '../screens/ScanScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabRouteName = keyof MainTabParamList;

const tabLabels: Record<MainTabRouteName, string> = {
  HomeScreen: 'Home',
  ScanScreen: 'Scan',
  LibraryScreen: 'Saved',
  ProfileScreen: 'Profile',
  RecipeDetailScreen: 'Recipe',
  RecipeStepsScreen: 'Steps',
  GroceryListScreen: 'Grocery',
};

const visibleTabOrder: MainTabRouteName[] = [
  'HomeScreen',
  'GroceryListScreen',
  'LibraryScreen',
  'ProfileScreen',
];

function TabIcon({ color, focused, routeName }: { color: string; focused: boolean; routeName: MainTabRouteName }) {
  const iconSize = routeName === 'ScanScreen' ? 36 : focused ? 27 : 26;
  const strokeWidth = routeName === 'ScanScreen' ? 2.1 : focused ? 2.2 : 1.9;

  switch (routeName) {
    case 'HomeScreen':
      return <HomeSimple color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'GroceryListScreen':
      return <Cart color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'LibraryScreen':
      return <Book color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'ProfileScreen':
      return <User color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
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

  const scanRoute = routesByName.ScanScreen;
  const scanFocused = focusedRoute?.key === scanRoute?.key;

  return (
    <View pointerEvents="box-none" style={[styles.tabBarRoot, { height: 122 + bottomInset }]}>
      <View style={[styles.tabBarPill, { bottom: bottomInset + 8 }]}>
        <BlurView intensity={55} pointerEvents="none" style={styles.tabBarBlur} tint="light" />
        <View style={styles.sideTabRow}>
          {visibleTabOrder.slice(0, 2).map(renderSideTab)}
          <View pointerEvents="none" style={styles.scanGap} />
          {visibleTabOrder.slice(2).map(renderSideTab)}
        </View>
      </View>

      {scanRoute ? (
        <Pressable
          accessibilityLabel={descriptors[scanRoute.key]?.options.tabBarAccessibilityLabel}
          accessibilityRole="button"
          accessibilityState={scanFocused ? { selected: true } : undefined}
          hitSlop={10}
          style={({ pressed }) => [
            styles.scanTab,
            { bottom: bottomInset + 20 },
            pressed ? styles.scanTabPressed : null,
          ]}
          testID={descriptors[scanRoute.key]?.options.tabBarButtonTestID}
          onLongPress={() => onLongPress('ScanScreen')}
          onPress={() => navigateToTab('ScanScreen')}
        >
          <View style={styles.scanCircle}>
            <TabIcon color="#fffdf8" focused routeName="ScanScreen" />
          </View>
          <Text style={[styles.scanLabel, scanFocused ? styles.scanLabelActive : styles.scanLabelInactive]}>
            {tabLabels.ScanScreen}
          </Text>
        </Pressable>
      ) : null}
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
      <Tab.Screen name="ScanScreen" component={ScanScreen} options={{ title: 'Scan' }} />
      <Tab.Screen name="LibraryScreen" component={LibraryScreen} options={{ title: 'Saved' }} />
      <Tab.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Tab.Screen name="RecipeDetailScreen" component={RecipeDetailScreen} options={{ title: 'Recipe' }} />
      <Tab.Screen name="RecipeStepsScreen" component={RecipeStepsScreen} options={{ title: 'Steps', tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="GroceryListScreen" component={GroceryListScreen} options={{ title: 'Grocery' }} />
    </Tab.Navigator>
  );
}

const inactiveGray = '#7d7466';

const styles = StyleSheet.create({
  tabBarRoot: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  tabBarPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.78)',
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
  scanGap: {
    width: 76,
  },
  scanTab: {
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
    width: 92,
    zIndex: 2,
  },
  scanTabPressed: {
    transform: [{ scale: 0.96 }],
  },
  scanCircle: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 40,
    borderWidth: 4,
    height: 76,
    justifyContent: 'center',
    shadowColor: '#c2401f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'ios' ? 0.26 : 0.32,
    shadowRadius: 16,
    width: 76,
    elevation: 14,
  },
  scanLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  scanLabelActive: {
    color: colors.coral,
  },
  scanLabelInactive: {
    color: inactiveGray,
  },
  tabPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
