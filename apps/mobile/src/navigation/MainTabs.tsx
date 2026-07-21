import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Book, Cart, HomeSimple, Settings } from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamilies } from '../theme/okyoTheme';
import { haptics } from '../utils/haptics';
import { devQaScreen } from '../utils/devQa';
import { GroceryListScreen } from '../screens/GroceryListScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { RecipeDetailScreen, RecipeStepsScreen } from '../screens/RecipeDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabRouteName = keyof MainTabParamList;

const tabLabels: Record<MainTabRouteName, string> = {
  HomeScreen: 'Home',
  GroceryListScreen: 'Grocery',
  LibraryScreen: 'Saved',
  SettingsScreen: 'Settings',
  RecipeDetailScreen: 'Recipe',
  RecipeStepsScreen: 'Steps',
};

// The four real product destinations. Recipe detail/steps stay registered in
// the navigator (so recipe flows keep tab context) but never appear in the bar.
const visibleTabOrder: MainTabRouteName[] = [
  'HomeScreen',
  'GroceryListScreen',
  'LibraryScreen',
  'SettingsScreen',
];

function TabIcon({ color, focused, routeName }: { color: string; focused: boolean; routeName: MainTabRouteName }) {
  const iconSize = focused ? 27 : 26;
  const strokeWidth = focused ? 2.2 : 1.9;

  switch (routeName) {
    case 'GroceryListScreen':
      return <Cart color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'LibraryScreen':
      return <Book color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'SettingsScreen':
      return <Settings color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
    case 'HomeScreen':
    default:
      return <HomeSimple color={color} height={iconSize} strokeWidth={strokeWidth} width={iconSize} />;
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
      haptics.selection();
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

  return (
    <View pointerEvents="box-none" style={[styles.tabBarRoot, { height: 78 + bottomInset }]}>
      <View style={[styles.tabBarPill, { bottom: bottomInset + 4 }]}>
        <BlurView intensity={55} pointerEvents="none" style={styles.tabBarBlur} tint="light" />
        <View style={styles.tabRow}>
          {visibleTabOrder.map((routeName) => {
            const route = routesByName[routeName];

            if (!route) {
              return null;
            }

            const descriptor = descriptors[route.key];
            const options = descriptor?.options;
            const focused = focusedRoute?.key === route.key;
            const color = focused ? colors.coral : inactiveGray;
            const label =
              typeof options?.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options?.title ?? tabLabels[routeName];

            return (
              <Pressable
                key={routeName}
                accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : undefined}
                hitSlop={8}
                style={({ pressed }) => [styles.tab, pressed ? styles.tabPressed : null]}
                testID={options?.tabBarButtonTestID}
                onLongPress={() => onLongPress(routeName)}
                onPress={() => navigateToTab(routeName)}
              >
                <TabIcon color={color} focused={focused} routeName={routeName} />
                <Text numberOfLines={1} style={[styles.tabLabel, focused ? styles.tabLabelActive : null]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName={getDevQaTabRoute()}
      tabBar={(props) => {
        const focusedRoute = props.state.routes[props.state.index];

        if (focusedRoute.name === 'RecipeStepsScreen') {
          return null;
        }

        return <FloatingTabBar {...props} />;
      }}
      screenOptions={{
        animation: 'fade',
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tab.Screen name="HomeScreen" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="GroceryListScreen" component={GroceryListScreen} options={{ title: 'Grocery' }} />
      <Tab.Screen name="LibraryScreen" component={LibraryScreen} options={{ title: 'Saved' }} />
      <Tab.Screen name="SettingsScreen" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Tab.Screen name="RecipeDetailScreen" component={RecipeDetailScreen} options={{ title: 'Recipe' }} />
      <Tab.Screen name="RecipeStepsScreen" component={RecipeStepsScreen} options={{ title: 'Steps', tabBarStyle: { display: 'none' } }} />
    </Tab.Navigator>
  );
}

function getDevQaTabRoute(): MainTabRouteName {
  switch (devQaScreen) {
    case 'grocery':
    case 'grocery-empty':
      return 'GroceryListScreen';
    case 'saved':
    case 'saved-empty':
      return 'LibraryScreen';
    case 'settings':
      return 'SettingsScreen';
    case 'recipe':
      return 'RecipeDetailScreen';
    case 'steps':
    case 'completion':
      return 'RecipeStepsScreen';
    default:
      return 'HomeScreen';
  }
}

const inactiveGray = '#7d7466';

const styles = StyleSheet.create({
  tabBarRoot: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  tabBarPill: {
    alignItems: 'center',
    backgroundColor: colors.glassFill,
    borderColor: colors.glassStroke,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 62,
    justifyContent: 'center',
    left: 18,
    overflow: 'visible',
    paddingHorizontal: 8,
    position: 'absolute',
    right: 18,
    shadowColor: '#3a2d1d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  // Glass layer behind the tab row. On Android BlurView falls back to a
  // translucent fill, which still reads correctly against the ivory canvas.
  tabBarBlur: {
    borderRadius: 18,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tabRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
    width: '100%',
  },
  tab: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  tabLabel: {
    color: inactiveGray,
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 13,
    maxWidth: '100%',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.coral,
    fontWeight: '700',
  },
  tabPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
