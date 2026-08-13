import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { onboardingV3Assets } from '../assets/onboardingV3Assets';

const SPLASH_MINIMUM_MS = 700;
const SPLASH_FONT_FALLBACK_MS = 1100;

export function SplashScreen({ appStartedAt, fontsLoaded, onFinished }: {
  appStartedAt: number;
  fontsLoaded: boolean;
  onFinished: (elapsedMs: number, fontsLoaded: boolean) => void;
}) {
  useEffect(() => {
    const targetMs = fontsLoaded ? SPLASH_MINIMUM_MS : SPLASH_FONT_FALLBACK_MS;
    const remainingMs = Math.max(0, targetMs - (Date.now() - appStartedAt));
    const timer = setTimeout(() => onFinished(Date.now() - appStartedAt, fontsLoaded), remainingMs);
    return () => clearTimeout(timer);
  }, [appStartedAt, fontsLoaded, onFinished]);

  return (
    <View style={styles.screen}>
      <StatusBar animated={false} hidden />
      <Image contentFit="cover" source={onboardingV3Assets.approvedOnboarding1} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { backgroundColor: '#fffdfe', flex: 1 } });
