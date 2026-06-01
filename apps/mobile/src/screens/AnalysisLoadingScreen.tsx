import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, NavArrowLeft, Spark, Sparks } from 'iconoir-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { colors } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';

type AnalysisNavigation = NativeStackNavigationProp<RootStackParamList, 'AnalysisLoadingScreen'>;

const progressBars = Array.from({ length: 8 }, (_, index) => index);

export function AnalysisLoadingScreen() {
  const navigation = useNavigation<AnalysisNavigation>();
  const latestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const latestScanFailure = useOkyoStore((state) => state.latestScanFailure);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanRecipes = useOkyoStore((state) => state.setLatestScanRecipes);
  const setLatestScanStatus = useOkyoStore((state) => state.setLatestScanStatus);
  const setLatestScanFailure = useOkyoStore((state) => state.setLatestScanFailure);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const setSelectedScanImage = useOkyoStore((state) => state.setSelectedScanImage);
  const setLatestAiDebugMetadata = useOkyoStore((state) => state.setLatestAiDebugMetadata);
  const [pulseIndex, setPulseIndex] = useState(0);
  const didNavigate = useRef(false);
  const didTrackCompletion = useRef(false);

  useEffect(() => {
    uiLog('AnalysisLoadingScreen', 'enter');
    const pulse = setInterval(() => {
      setPulseIndex((currentIndex) => (currentIndex + 1) % progressBars.length);
    }, 420);

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
      navigation.navigate('ResultSummaryScreen');
    }, 750);

    return () => clearTimeout(finish);
  }, [latestScanStatus, navigation]);

  useEffect(() => {
    const fallback = setTimeout(() => {
      if (didNavigate.current) {
        return;
      }

      didNavigate.current = true;
      uiLog('AnalysisLoadingScreen', 'navigate_result_waiting');
      navigation.navigate('ResultSummaryScreen');
    }, 5200);

    return () => clearTimeout(fallback);
  }, [navigation]);

  const goBackToScan = () => {
    didNavigate.current = true;
    setLatestScanFailure(null);
    setLatestScanResult(null);
    setLatestScanRecipes([]);
    setLatestScanStatus(null);
    setLatestScanRecipe(null);
    setSelectedScanImage(null);
    setLatestAiDebugMetadata(null);
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.kicker}>SCANNING</Text>
          <Text style={styles.title}>Okyo is building your homemade swap.</Text>
          <Text style={styles.subtitle}>
            This can take a few seconds for real food photos. We only show a result when it feels trustworthy.
          </Text>
        </View>

        <View style={styles.progressCardWrap}>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Sparks color={colors.coral} height={34} strokeWidth={2.1} width={34} />
              <Text style={styles.progressTitle}>Building your homemade swap...</Text>
            </View>
            <View style={styles.progressTrack} accessibilityRole="progressbar">
              {progressBars.map((bar) => {
                const isActive = (bar + progressBars.length - pulseIndex) % progressBars.length < 4;

                return (
                  <View
                    key={bar}
                    style={[styles.progressSegment, isActive ? styles.progressSegmentActive : null]}
                  />
                );
              })}
            </View>
            <View style={styles.progressFooter}>
              <ActivityIndicator color={colors.coral} size="small" />
              <Text style={styles.progressHint}>Checking the dish, savings, and recipe fit.</Text>
            </View>
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

        <Spark color="#f5b763" height={26} style={styles.softSpark} strokeWidth={2.1} width={26} />
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
    paddingBottom: 28,
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
    marginTop: 96,
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
    marginTop: 54,
  },
  progressCard: {
    backgroundColor: colors.card,
    borderColor: '#f0e5d8',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 22,
    shadowColor: '#7b5a38',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 2,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minWidth: 0,
  },
  progressTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
    minWidth: 0,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 26,
  },
  progressSegment: {
    backgroundColor: '#f4ebe2',
    borderRadius: 999,
    flex: 1,
    height: 14,
    minWidth: 0,
  },
  progressSegmentActive: {
    backgroundColor: '#ffa36d',
  },
  progressFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    minWidth: 0,
  },
  progressHint: {
    color: colors.body,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    minWidth: 0,
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
  softSpark: {
    opacity: 0.35,
    position: 'absolute',
    right: 32,
    top: 302,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
