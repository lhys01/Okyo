import { AppErrorBoundary } from './src/observability/AppErrorBoundary';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { LogBox } from 'react-native';

import { LaunchBoundary, useLaunchStartup } from './src/startup/LaunchScreen';
import { useOkyoStore } from './src/state/useOkyoStore';

import { AppNavigator } from './src/navigation/AppNavigator';
import type { RootStackParamList } from './src/navigation/types';
import { OkyoAuthProvider } from './src/auth/OkyoAuthProvider';
import { useOkyoAuth } from './src/auth/useOkyoAuth';
import { bootstrapAnalytics, trackScreenViewed } from './src/analytics/bootstrap';
import { startCookingReminderSync } from './src/state/cookingReminder';
import { startGroceryReminderSync } from './src/state/groceryReminder';
import { initializeRevenueCat, syncRevenueCatIdentity } from './src/services/revenueCat';
import { getRevenueCatDevelopmentLogBoxIgnores } from './src/services/revenueCatLogBox';
import { setOptionalAuthTokenProvider } from './src/api/client';


const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AppContent() {
  const { finished: launchFinished, setResourcesReady, markNavigationReady } = useLaunchStartup();
  const hasHydrated = useOkyoStore((state) => state.hasHydrated);
  const lastAnalyticsScreen = useRef<string | null>(null);
  const handleNavigationStateChange = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (!routeName || routeName === lastAnalyticsScreen.current) return;
    lastAnalyticsScreen.current = routeName;
    trackScreenViewed(routeName);
  };
  const [fontsLoaded] = useFonts({
    // Manrope is the single typeface for the whole app, including onboarding
    // (src/onboarding-v3/**), which reaches it through the onboardingFontFamilies
    // token map. There is no static "black" weight in the Manrope set, so
    // ExtraBold (800) covers every role that previously used the heaviest weight.
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const appStartedAt = useRef(Date.now()).current;
  const [fontFallbackElapsed, setFontFallbackElapsed] = useState(false);
  const readyToRender = fontsLoaded || fontFallbackElapsed;

  useEffect(() => {
    const timer = setTimeout(() => setFontFallbackElapsed(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bootstrapAnalytics();
  }, []);

  useEffect(() => startGroceryReminderSync(), []);
  useEffect(() => startCookingReminderSync(), []);

  useEffect(() => {
    const expectedDevelopmentLogs = getRevenueCatDevelopmentLogBoxIgnores(
      typeof __DEV__ !== 'undefined' && __DEV__,
    );
    if (expectedDevelopmentLogs.length > 0) {
      LogBox.ignoreLogs(expectedDevelopmentLogs);
    }
    void initializeRevenueCat();
  }, []);

  useEffect(() => {
    setResourcesReady(readyToRender && hasHydrated);
  }, [readyToRender, hasHydrated, setResourcesReady]);

  if (!readyToRender) {
    return null;
  }

  return (
    <OkyoAuthProvider>
      <AuthenticatedServicesBridge />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => { markNavigationReady(); handleNavigationStateChange(); }}
        onStateChange={handleNavigationStateChange}
      >
        <StatusBar hidden={!launchFinished} style="dark" />
        <AppNavigator appStartedAt={appStartedAt} fontsLoaded={fontsLoaded} />
      </NavigationContainer>
    </OkyoAuthProvider>
  );
}

/** Keeps the RevenueCat customer ID aligned with the authenticated Clerk user. */
function AuthenticatedServicesBridge() {
  const auth = useOkyoAuth();

  useEffect(() => {
    setOptionalAuthTokenProvider(auth.isLoaded && auth.isSignedIn ? () => auth.getToken() : null);
    return () => setOptionalAuthTokenProvider(null);
  }, [auth.isLoaded, auth.isSignedIn, auth.userId]);

  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn || !auth.userId) return;
    void syncRevenueCatIdentity(auth.userId);
  }, [auth.isLoaded, auth.isSignedIn, auth.userId]);

  return null;
}

export default function App() {
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    if (!useOkyoStore.getState().hasHydrated) {
      void Promise.resolve(useOkyoStore.persist.rehydrate()).catch(() => undefined);
    }
    setAttempt((current) => current + 1);
  };
  return <LaunchBoundary key={attempt} onRetry={retry}><AppErrorBoundary><AppContent /></AppErrorBoundary></LaunchBoundary>;
}
