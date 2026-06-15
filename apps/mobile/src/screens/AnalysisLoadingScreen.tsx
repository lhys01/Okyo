import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, NavArrowLeft, Sparks } from 'iconoir-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { KikoMascot } from '../components/KikoMascot';
import { colors } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';

type AnalysisNavigation = NativeStackNavigationProp<RootStackParamList, 'AnalysisLoadingScreen'>;
type AnalysisRoute = RouteProp<RootStackParamList, 'AnalysisLoadingScreen'>;

const loadingSteps = [
  'Reading your plate',
  'Finding the best guess',
  'Building your recipe',
  'Making your grocery list',
  'Checking the result',
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
  const [pulseIndex, setPulseIndex] = useState(0);
  const didNavigate = useRef(false);
  const didTrackCompletion = useRef(false);

  useEffect(() => {
    uiLog('AnalysisLoadingScreen', 'enter');
    const pulse = setInterval(() => {
      setPulseIndex((currentIndex) => (currentIndex + 1) % loadingSteps.length);
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

    const finish = setTimeout(() => {
      didNavigate.current = true;
      uiLog('AnalysisLoadingScreen', 'navigate_result', { status: latestScanStatus });
      navigation.navigate('ResultSummaryScreen', { scanSessionId: route.params?.scanSessionId ?? scanSessionId ?? undefined });
    }, 750);

    return () => clearTimeout(finish);
  }, [latestScanStatus, navigation, route.params?.scanSessionId, scanSessionId]);

  useEffect(() => {
    const fallback = setTimeout(() => {
      if (didNavigate.current) {
        return;
      }

      didNavigate.current = true;
      uiLog('AnalysisLoadingScreen', 'navigate_result_waiting');
      navigation.navigate('ResultSummaryScreen', { scanSessionId: route.params?.scanSessionId ?? scanSessionId ?? undefined });
    }, 5200);

    return () => clearTimeout(fallback);
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
          <Pressable
            accessibilityLabel="Back to scan"
            accessibilityRole="button"
            onPress={goBackToScan}
            style={({ pressed }) => [styles.backPill, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.charcoal} height={24} strokeWidth={2.35} width={24} />
            <Text style={styles.backPillText}>Scan</Text>
          </Pressable>
          <View pointerEvents="none" style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Analyzing</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <KikoMascot pose="scanning" size={150} style={styles.heroMascot} />
          <Text style={styles.kicker}>SCANNING</Text>
          <Text style={styles.title}>Kiko is reading your plate…</Text>
          <Text style={styles.subtitle}>
            Finding the homemade version. This can take a few seconds, and Okyo only shows a result it trusts.
          </Text>
        </View>

        <View style={styles.progressCardWrap}>
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
    height: 64,
    justifyContent: 'center',
    marginTop: 8,
    position: 'relative',
  },
  backPill: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    left: 0,
    minHeight: 48,
    paddingHorizontal: 14,
    position: 'absolute',
    top: 8,
  },
  backPillText: {
    color: colors.body,
    fontSize: 17,
    fontWeight: '900',
  },
  topTitleWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 90,
    position: 'absolute',
    right: 90,
    top: 0,
  },
  topTitle: {
    color: colors.charcoal,
    fontSize: 21,
    fontWeight: '900',
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
  kicker: {
    color: colors.coral,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 16,
  },
  title: {
    color: colors.charcoal,
    fontSize: 33,
    fontWeight: '900',
    lineHeight: 39,
  },
  subtitle: {
    color: colors.body,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 25,
    marginTop: 18,
  },
  progressCardWrap: {
    marginTop: 40,
  },
  progressCard: {
    backgroundColor: colors.card,
    borderColor: '#f0e5d8',
    borderRadius: 22,
    borderWidth: 1,
    gap: 4,
    padding: 12,
    shadowColor: '#7b5a38',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 2,
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
    backgroundColor: '#fffdf8',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: 38,
    minHeight: 56,
    paddingHorizontal: 36,
  },
  backButtonText: {
    color: colors.body,
    fontSize: 17,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
