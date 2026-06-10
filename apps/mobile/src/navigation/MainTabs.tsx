import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Bag,
  Book,
  Camera,
  Dollar,
  Settings as SettingsIcon,
  Trophy,
} from 'iconoir-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../components/OkyoUI';
import { LibraryScreen } from '../screens/LibraryScreen';
import { RankingsScreen } from '../screens/RankingsScreen';
import { RestaurantPacksScreen } from '../screens/RestaurantPacksScreen';
import { SavingsDashboardScreen } from '../screens/SavingsDashboardScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabRouteName = keyof MainTabParamList;

const tabLabels: Record<MainTabRouteName, string> = {
  ScanScreen: 'Scan',
  LibraryScreen: 'Library',
  SavingsDashboardScreen: 'Savings',
  RankingsScreen: 'Rank',
  RestaurantPacksScreen: 'Packs',
  SettingsScreen: 'Settings',
};

const visibleTabOrder: MainTabRouteName[] = [
  'LibraryScreen',
  'SavingsDashboardScreen',
  'RankingsScreen',
  'RestaurantPacksScreen',
  'SettingsScreen',
];

function TabIcon({ color, focused, routeName }: { color: string; focused: boolean; routeName: MainTabRouteName }) {
  const iconSize = routeName === 'ScanScreen' ? 38 : focused ? 29 : 28;
  const strokeWidth = routeName === 'ScanScreen' ? 2.25 : focused ? 2.35 : 2.1;

  switch (routeName) {
    case 'LibraryScreen':
      return <Book color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'SavingsDashboardScreen':
      return <Dollar color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'RankingsScreen':
      return <Trophy color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'RestaurantPacksScreen':
      return <Bag color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'SettingsScreen':
      return <SettingsIcon color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
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
    const color = focused ? scanOrange : warmGray;
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
        style={({ pressed }) => [
          styles.sideTab,
          focused ? styles.sideTabActive : null,
          pressed ? styles.tabPressed : null,
        ]}
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
    <View pointerEvents="box-none" style={[styles.tabBarRoot, { height: 128 + bottomInset }]}>
      <View style={[styles.tabBarPill, { bottom: bottomInset + 8 }]}>
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
            { bottom: bottomInset + 18 },
            pressed ? styles.scanTabPressed : null,
          ]}
          testID={descriptors[scanRoute.key]?.options.tabBarButtonTestID}
          onLongPress={() => onLongPress('ScanScreen')}
          onPress={() => navigateToTab('ScanScreen')}
        >
          <View style={styles.scanCircleOuter}>
            <View style={styles.scanCircleInner}>
              <View style={styles.scanHighlight} />
              <TabIcon color="#fffdf8" focused routeName="ScanScreen" />
            </View>
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
      initialRouteName="ScanScreen"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.charcoal,
        sceneStyle: { backgroundColor: colors.background },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tab.Screen name="ScanScreen" component={ScanScreen} options={{ title: 'Scan', headerShown: false }} />
      <Tab.Screen name="LibraryScreen" component={LibraryScreen} options={{ title: 'Library', headerShown: false }} />
      <Tab.Screen
        name="SavingsDashboardScreen"
        component={SavingsDashboardScreen}
        options={{ title: 'Savings', tabBarLabel: 'Savings', headerShown: false }}
      />
      <Tab.Screen name="RankingsScreen" component={RankingsScreen} options={{ title: 'Rankings', tabBarLabel: 'Rank' }} />
      <Tab.Screen
        name="RestaurantPacksScreen"
        component={RestaurantPacksScreen}
        options={{ title: 'Packs', tabBarLabel: 'Packs' }}
      />
      <Tab.Screen name="SettingsScreen" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

const scanOrange = '#ff7a1f';
const warmGray = '#8a837a';

const styles = StyleSheet.create({
  tabBarRoot: {
    backgroundColor: colors.background,
    overflow: 'visible',
  },
  tabBarPill: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: '#eadcc6',
    borderRadius: 38,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
    left: 12,
    overflow: 'visible',
    paddingHorizontal: 8,
    position: 'absolute',
    right: 12,
    shadowColor: '#3a2a1c',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
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
    gap: 3,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  sideTabActive: {
    backgroundColor: '#fff2e3',
  },
  sideLabel: {
    color: warmGray,
    fontSize: 9.5,
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 12,
    maxWidth: '100%',
    textAlign: 'center',
  },
  sideLabelActive: {
    color: scanOrange,
    fontWeight: '900',
  },
  scanGap: {
    width: 72,
  },
  scanTab: {
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
    width: 92,
    zIndex: 2,
  },
  scanTabPressed: {
    transform: [{ scale: 0.97 }],
  },
  scanCircleOuter: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: '#ffffff',
    borderRadius: 43,
    borderWidth: 4,
    height: 82,
    justifyContent: 'center',
    shadowColor: '#c84f16',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'ios' ? 0.24 : 0.3,
    shadowRadius: 16,
    width: 82,
    elevation: 14,
  },
  scanCircleInner: {
    alignItems: 'center',
    backgroundColor: scanOrange,
    borderRadius: 37,
    height: 70,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 70,
  },
  scanHighlight: {
    backgroundColor: '#ff9826',
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    height: 34,
    left: 0,
    opacity: 0.5,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scanLabel: {
    fontSize: 15,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  scanLabelActive: {
    color: scanOrange,
  },
  scanLabelInactive: {
    color: warmGray,
  },
  tabPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
