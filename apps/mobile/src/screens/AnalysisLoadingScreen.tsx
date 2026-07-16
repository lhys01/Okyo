import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, Sparks } from 'iconoir-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { KikoMascot } from '../components/KikoMascot';
import { ProgressFill } from '../components/OkyoUI';
import { colors, fontFamilies, radius, shadows, spacing, surfaces, typography } from '../theme/okyoTheme';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { getRealScanImageUri } from '../utils/recipeImages';
import { uiLog } from '../utils/uiDebug';

type AnalysisNavigation = NativeStackNavigationProp<RootStackParamList, 'AnalysisLoadingScreen'>;
type AnalysisRoute = RouteProp<RootStackParamList, 'AnalysisLoadingScreen'>;

const loadingSteps = [
  'Reading your plate',
  'Finding the best guess',
  'Building your recipe',
  'Making your grocery list',
  'Almost ready',
];

export function AnalysisLoadingScreen() {
  const navigation = useNavigation<AnalysisNavigation>();
  const route = useRoute<AnalysisRoute>();
  const insets = useSafeAreaInsets();
  const scanSessionId = useOkyoStore((state) => state.scanSessionId);
  const latestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const latestScanFailure = useOkyoStore((state) => state.latestScanFailure);
  const clearLatestScan = useOkyoStore((state) => state.clearLatestScan);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const scanImageUri = getRealScanImageUri(selectedScanImage);
  const [pulseIndex, setPulseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const didNavigate = useRef(false);
  const didTrackCompletion = useRef(false);

  useEffect(() => {
    uiLog('AnalysisLoadingScreen', 'enter');
    const pulse = setInterval(() => {
      setPulseIndex((currentIndex) => Math.min(currentIndex + 1, loadingSteps.length - 1));
      setElapsedSeconds((currentSeconds) => currentSeconds + 1);
    }, 1000);

    return () => clearInterval(pulse);
  }, []);

  useEffect(() => {
    if (didTrackCompletion.current || latestScanStatus === 'pending' || !latestScanStatus) {
      return;
    }

    didTrackCompletion.current = true;
    if ((latestScanStatus === 'success' || latestScanStatus === 'partial') && latestScanResult) {
      track(analyticsEvents.DISH_DETECTED, {
        dishName: latestScanResult.dishName,
        screen: 'AnalysisLoadingScreen',
      });
      if (latestScanRecipe) {
        track(analyticsEvents.RECIPE_GENERATED, {
          dishName: latestScanResult.dishName,
          mode: latestScanRecipe.mode,
          savings: latestScanRecipe.estimatedSavings,
          screen: 'AnalysisLoadingScreen',
        });
      }
      return;
    }

    if (latestScanStatus === 'failed' || latestScanStatus === 'rejected') {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: latestScanFailure?.rejectionReason ?? 'Scan did not return a safe result.',
        screen: 'AnalysisLoadingScreen',
      });
    }
  }, [latestScanFailure?.rejectionReason, latestScanRecipe, latestScanResult, latestScanStatus]);

  useEffect(() => {
    if (didNavigate.current || latestScanStatus === 'pending' || !latestScanStatus) {
      return;
    }

    didNavigate.current = true;
    uiLog('AnalysisLoadingScreen', 'navigate_result', { status: latestScanStatus });
    navigation.navigate('ResultSummaryScreen', {
      scanSessionId: route.params?.scanSessionId ?? scanSessionId ?? undefined,
    });
  }, [latestScanStatus, navigation, route.params?.scanSessionId, scanSessionId]);

  // Safety net: the scan store always receives a terminal write (the API client
  // times out at 60s), but if anything ever hangs past that, move the user on
  // instead of stranding them on the loading screen.
  useEffect(() => {
    const safetyFallback = setTimeout(() => {
      if (didNavigate.current) {
        return;
      }

      didNavigate.current = true;
      uiLog('AnalysisLoadingScreen', 'navigate_result_safety_fallback');
      navigation.navigate('ResultSummaryScreen', { scanSessionId: route.params?.scanSessionId ?? scanSessionId ?? undefined });
    }, 90_000);

    return () => clearTimeout(safetyFallback);
  }, [navigation, route.params?.scanSessionId, scanSessionId]);

  const goBackToScan = () => {
    didNavigate.current = true;
    clearLatestScan({
      reason: 'user_aborted_scan_from_loading',
      source: 'AnalysisLoadingScreen.goBackToScan',
    });
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 220 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View pointerEvents="none" style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Analyzing</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <KikoMascot animated="thinking" pose="scanning" size={150} style={styles.heroMascot} />
          {scanImageUri ? (
            <View style={styles.scanImageWrap}>
              <Image
                resizeMode="cover"
                source={{ uri: scanImageUri }}
                style={styles.scanImageThumb}
              />
              <Text style={styles.scanImageCaption}>Your photo · analyzing</Text>
            </View>
          ) : null}
          <Text style={styles.kicker}>Scanning</Text>
          <Text style={styles.title}>Kiko is reading your plate…</Text>
          <Text style={styles.subtitle}>
            Finding the homemade version. This can take a few seconds, and Okyo only shows a result it trusts.
          </Text>
          {elapsedSeconds >= 8 ? (
            <Text style={styles.stillWorkingText}>
              Still working on the photo. Clear food and drink scans can take a little longer.
            </Text>
          ) : null}
        </View>

        <View style={styles.progressCardWrap}>
          <ProgressFill
            progress={(pulseIndex + 1) / loadingSteps.length}
            style={styles.analysisProgressFill}
          />
          <View style={styles.progressCard} accessibilityRole="progressbar">
            {loadingSteps.map((step, index) => {
              const isActive = index === pulseIndex;
              const isDone = index < pulseIndex;

              return (
                <View key={step} style={[styles.stepRow, isActive ? styles.stepRowActive : null]}>
                  {isActive ? (
                    <ActivityIndicator color={colors.coral} size="small" />
                  ) : (
                    <Sparks
                      color={isDone ? colors.coral : colors.creamDeep}
                      height={20}
                      strokeWidth={2.1}
                      width={20}
                    />
                  )}
                  <Text style={[styles.stepText, isActive ? styles.stepTextActive : null]}>{step}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={goBackToScan}
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
        >
          <Camera color={colors.body} height={25} strokeWidth={2.25} width={25} />
          <Text style={styles.backButtonText}>Back to scan</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    minHeight: 64,
    position: 'relative',
  },
  topTitleWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  topTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  hero: {
    alignItems: 'flex-start',
    marginTop: 72,
  },
  heroMascot: {
    alignSelf: 'center',
    marginBottom: 18,
  },
  scanImageWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 22,
    marginTop: -8,
  },
  scanImageThumb: {
    borderColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 3,
    height: 104,
    width: 104,
    ...shadows.card,
  },
  scanImageCaption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  kicker: {
    ...typography.label,
    color: colors.coralDark,
    fontSize: 14,
    marginBottom: 12,
  },
  title: {
    ...typography.hero,
    fontSize: 32,
    lineHeight: 39,
  },
  subtitle: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 16,
  },
  stillWorkingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 14,
  },
  progressCardWrap: {
    marginTop: 40,
  },
  analysisProgressFill: {
    marginBottom: 12,
  },
  progressCard: {
    ...surfaces.card,
    gap: 4,
    padding: spacing.sm,
  },
  stepRow: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  stepRowActive: {
    backgroundColor: colors.cream,
  },
  stepText: {
    color: colors.muted,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    minWidth: 0,
  },
  stepTextActive: {
    color: colors.charcoal,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: 38,
    minHeight: 56,
    paddingHorizontal: 36,
    ...shadows.soft,
  },
  backButtonText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
