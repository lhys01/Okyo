import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, CheckCircle, Clock, NavArrowLeft } from 'iconoir-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { AnimatedGradientBackground } from '../components/AnimatedGradientBackground';
import { KikoMascot } from '../components/KikoMascot';
import { GlowNode } from '../components/motifs';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, fontFamilies, radius, shadows, spacing, typography } from '../theme/okyoTheme';
import { getRealScanImageUri } from '../utils/recipeImages';
import { uiLog } from '../utils/uiDebug';
import { devQaScreen } from '../utils/devQa';

type AnalysisNavigation = NativeStackNavigationProp<RootStackParamList, 'AnalysisLoadingScreen'>;
type AnalysisRoute = RouteProp<RootStackParamList, 'AnalysisLoadingScreen'>;

const longWaitSeconds = 12;
const timeoutSeconds = 70;

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
  const [elapsedSeconds, setElapsedSeconds] = useState(devQaScreen === 'analysis-timeout' ? timeoutSeconds : 0);
  const [showTimeout, setShowTimeout] = useState(devQaScreen === 'analysis-timeout');
  const didNavigate = useRef(false);
  const didTrackCompletion = useRef(false);

  useEffect(() => {
    uiLog('AnalysisLoadingScreen', 'enter');
    const ticker = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (latestScanStatus === 'pending' && elapsedSeconds >= timeoutSeconds) {
      setShowTimeout(true);
    }
  }, [elapsedSeconds, latestScanStatus]);

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
    uiLog('AnalysisLoadingScreen', 'replace_with_result', { status: latestScanStatus });
    navigation.replace('ResultSummaryScreen', {
      scanSessionId: route.params?.scanSessionId ?? scanSessionId ?? undefined,
    });
  }, [latestScanStatus, navigation, route.params?.scanSessionId, scanSessionId]);

  const leaveAnalysis = () => {
    didNavigate.current = true;
    clearLatestScan({
      reason: 'user_aborted_scan_from_loading',
      source: 'AnalysisLoadingScreen.leaveAnalysis',
    });
    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const keepWaiting = () => {
    setElapsedSeconds(longWaitSeconds);
    setShowTimeout(false);
  };

  const longWait = elapsedSeconds >= longWaitSeconds;

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedGradientBackground />
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Cancel analysis"
            accessibilityRole="button"
            hitSlop={10}
            onPress={leaveAnalysis}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.charcoal} height={23} strokeWidth={2.25} width={23} />
          </Pressable>
          <Text style={styles.topTitle}>Analyzing</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.imageStage}>
          {scanImageUri ? (
            <Image source={{ uri: scanImageUri }} resizeMode="cover" style={styles.scanImage} />
          ) : (
            <View style={styles.imageFallback}>
              <Camera color={colors.coral} height={34} strokeWidth={2} width={34} />
              <Text style={styles.imageFallbackText}>Your food idea is with Kiko</Text>
            </View>
          )}
          <View pointerEvents="none" style={styles.imageWash} />
          <View style={styles.kikoStage}>
            <KikoMascot animated="thinking" pose="thinking" size={118} />
          </View>
          <View style={styles.receivedBadge}>
            <CheckCircle color={colors.green} height={18} strokeWidth={2.3} width={18} />
            <Text style={styles.receivedText}>Photo received</Text>
          </View>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.kicker}>{showTimeout ? 'Still safe with us' : 'Kiko is on it'}</Text>
          <Text style={styles.title}>
            {showTimeout
              ? 'This is taking longer than usual.'
              : longWait
                ? 'Still working on your homemade version.'
                : 'Finding a recipe worth cooking.'}
          </Text>
          <Text style={styles.subtitle}>
            {showTimeout
              ? 'Okyo did not receive a trusted answer in time. No result was invented, and you can try another photo.'
              : 'Okyo is identifying the dish and building one inspired-by recipe. We will only reveal it when the request finishes.'}
          </Text>
        </View>

        <View accessibilityLabel="Analysis stages" accessibilityRole="summary" style={styles.stagePanel}>
          <StageRow
            icon={<CheckCircle color={colors.green} height={20} strokeWidth={2.3} width={20} />}
            label="Photo ready"
          >
            <GlowNode label="Received" state="done" tone="mint" />
          </StageRow>
          <View style={styles.stageDivider} />
          <StageRow
            icon={<Clock color={colors.coral} height={20} strokeWidth={2.3} width={20} />}
            label="Dish + recipe analysis"
          >
            <GlowNode label={showTimeout ? 'Paused' : 'Working'} state={showTimeout ? 'pending' : 'active'} tone="pink" />
          </StageRow>
          <View style={styles.stageDivider} />
          <StageRow
            icon={<CheckCircle color={colors.muted} height={20} strokeWidth={2.1} width={20} />}
            label="Result trust check"
          >
            <GlowNode label="Next" state="pending" tone="blue" />
          </StageRow>
        </View>

        {longWait && !showTimeout ? (
          <Text style={styles.longWaitText}>Clear photos sometimes need a little extra time. You can leave safely at any point.</Text>
        ) : null}

        <View style={styles.actions}>
          {showTimeout ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={leaveAnalysis}
                style={({ pressed }) => [styles.primaryAction, pressed ? styles.primaryPressed : null]}
              >
                <Camera color={colors.onCoral} height={21} strokeWidth={2.3} width={21} />
                <Text style={styles.primaryActionText}>Try another photo</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={keepWaiting}
                style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
              >
                <Text style={styles.secondaryActionText}>Keep waiting</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={leaveAnalysis}
              style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
            >
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StageRow({ children, icon, label }: { children: ReactNode; icon: ReactNode; label: string }) {
  return (
    <View style={styles.stageRow}>
      <View style={styles.stageIcon}>{icon}</View>
      <Text style={styles.stageLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
    ...shadows.soft,
  },
  topTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 26,
  },
  topSpacer: {
    width: 44,
  },
  imageStage: {
    aspectRatio: 1.28,
    backgroundColor: colors.cardWarm,
    borderRadius: radius.hero,
    marginTop: 12,
    minHeight: 252,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.hero,
  },
  scanImage: {
    height: '100%',
    width: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 46,
  },
  imageFallbackText: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  imageWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,253,248,0.16)',
  },
  kikoStage: {
    alignItems: 'center',
    backgroundColor: colors.cardWarm,
    borderColor: colors.card,
    borderRadius: 24,
    borderWidth: 2,
    bottom: 14,
    height: 122,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    right: 14,
    width: 104,
    ...shadows.soft,
  },
  receivedBadge: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    left: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    position: 'absolute',
    top: 14,
    ...shadows.soft,
  },
  receivedText: {
    color: colors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  copyBlock: {
    marginTop: spacing.lg,
  },
  kicker: {
    ...typography.label,
    color: colors.coralDark,
    fontSize: 13,
  },
  title: {
    ...typography.hero,
    fontSize: 31,
    lineHeight: 38,
    marginTop: 8,
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
  stagePanel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 20,
    paddingHorizontal: 14,
    ...shadows.card,
  },
  stageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 62,
  },
  stageIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  stageLabel: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 0,
  },
  stageDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 34,
  },
  longWaitText: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 22,
    ...shadows.cta,
  },
  primaryActionText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 28,
  },
  secondaryActionText: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  primaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
