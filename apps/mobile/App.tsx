import { NavigationContainer } from '@react-navigation/native';
import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { LogBox } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { initializeRevenueCat } from './src/services/revenueCat';
import { getRevenueCatDevelopmentLogBoxIgnores } from './src/services/revenueCatLogBox';

void ExpoSplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });
  const appStartedAt = useRef(Date.now()).current;
  const [fontFallbackElapsed, setFontFallbackElapsed] = useState(false);
  const readyToRender = fontsLoaded || fontFallbackElapsed;

  useEffect(() => {
    const timer = setTimeout(() => setFontFallbackElapsed(true), 1100);
    return () => clearTimeout(timer);
  }, []);

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
    if (readyToRender) {
      void ExpoSplashScreen.hideAsync();
    }
  }, [readyToRender]);

  if (!readyToRender) {
    return null;
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <AppNavigator appStartedAt={appStartedAt} fontsLoaded={fontsLoaded} />
    </NavigationContainer>
  );
}
