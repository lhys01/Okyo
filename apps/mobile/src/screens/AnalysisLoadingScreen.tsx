import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Check, NavArrowLeft } from 'iconoir-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { colors, fontFamilies, PrimaryButton } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { getRealScanImageUri } from '../utils/recipeImages';
import { getLastPreparedImage, startScan } from '../utils/scanController';
import { getAnalysisScreenOutcome, getFreshDescribeMealResetState, getHomeResetState } from '../utils/scanControllerUtils';
import { isUsableScan } from '../utils/scanDecision';
import { getInlineFailureCopy, getScanFailureCategory } from '../utils/scanFailureCopy';
import { preparePickedImage } from '../utils/scanImageProcessing';
import { getPendingAnalysisPresentation } from '../utils/scanProgress';
import { uiLog } from '../utils/uiDebug';

type AnalysisNavigation = NativeStackNavigationProp<RootStackParamList, 'AnalysisLoadingScreen'>;
type AnalysisRoute = RouteProp<RootStackParamList, 'AnalysisLoadingScreen'>;
const loadingProgressVideo = require('../../assets/button background/loading-progress-gradient.mp4');
const okyoAppIcon = require('../../assets/icon.png');

const ANALYSIS_STAGES = [
  'Identifying the image',
  'Finding ingredients',
  'Making the recipe',
  'Calculating the macros',
  'Adding the finishing touches',
] as const;

export function AnalysisLoadingScreen() {
  const navigation = useNavigation<AnalysisNavigation>();
  const route = useRoute<AnalysisRoute>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scanSessionId = useOkyoStore((state) => state.scanSessionId);
  const latestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const latestScanFailure = useOkyoStore((state) => state.latestScanFailure);
  const mealDescription = useOkyoStore((state) => state.mealDescription);
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const scanSource = useOkyoStore((state) => state.latestScanSession?.source ?? 'camera');
  const activeScanSessionId = scanSessionId ?? route.params?.scanSessionId ?? 'no-active-session';
  const clearLatestScan = useOkyoStore((state) => state.clearLatestScan);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const scanImageUri = getRealScanImageUri(selectedScanImage);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [finishState, setFinishState] = useState<{ durationMs: number; startElapsedMs: number; startProgress: number } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const isDescriptionScan = scanSource === 'description';
  const statusSequenceKey = `${activeScanSessionId}:${scanSource}`;
  const [reduceMotion, setReduceMotion] = useState(false);
  const didNavigate = useRef(false);
  const didTrackCompletion = useRef(false);
  const scanLineProgress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const stagePulseValue = useRef(new Animated.Value(1)).current;
  const progressVideoPlayer = useVideoPlayer(loadingProgressVideo, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });
  const uploadInFlight = useRef(false);

  // The photo must never move or remount for the life of a scan session — only
  // the scan-line overlay animates. We freeze the first URI seen for a given
  // session and keep rendering that frozen value even if the store's
  // selectedScanImage reference changes shape mid-flight (e.g. preview ->
  // response image echo) while this screen is still showing that session.
  const frozenScanImageRef = useRef<{ scanSessionId: string; uri: string } | null>(null);
  if (scanImageUri && frozenScanImageRef.current?.scanSessionId !== activeScanSessionId) {
    frozenScanImageRef.current = { scanSessionId: activeScanSessionId, uri: scanImageUri };
  }
  const stableScanImageUri = frozenScanImageRef.current?.scanSessionId === activeScanSessionId
    ? frozenScanImageRef.current.uri
    : scanImageUri;

  const usable = latestScanStatus && latestScanStatus !== 'pending'
    ? isUsableScan({
        latestScanRecipe,
        recipes: latestScanRecipe ? [latestScanRecipe] : [],
        scan: latestScanResult,
        status: latestScanStatus,
      })
    : false;
  const rawOutcome = getAnalysisScreenOutcome({
    status: latestScanStatus,
    usable,
    hasResult: Boolean(latestScanResult),
  });
  // A hang past the safety window forces an inline failure even if the store
  // is still technically 'pending' — a real success always wins the race.
  const outcome = timedOut && rawOutcome !== 'success' ? 'inline_failure' : rawOutcome;
  const failureCategory = outcome === 'inline_failure'
    ? getScanFailureCategory({
        isTimeout: timedOut,
        rejectionReason: latestScanFailure?.rejectionReason,
        rejectionType: latestScanFailure?.rejectionType,
        status: latestScanStatus,
        usable,
      })
    : null;
  const failureCopy = failureCategory ? getInlineFailureCopy(failureCategory, isDescriptionScan) : null;

  useEffect(() => {
    setAnalysisElapsed(0);
    setFinishState(null);
    const startedAt = Date.now();
    const timer = setInterval(() => setAnalysisElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [activeScanSessionId]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isDescriptionScan || reduceMotion || outcome !== 'pending') {
      scanLineProgress.stopAnimation();
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineProgress, { duration: 1800, easing: Easing.inOut(Easing.quad), toValue: 1, useNativeDriver: true }),
        Animated.timing(scanLineProgress, { duration: 0, toValue: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isDescriptionScan, reduceMotion, scanLineProgress, outcome]);

  useEffect(() => {
    uiLog('AnalysisLoadingScreen', 'enter');
  }, [statusSequenceKey]);

  const pendingPresentation = getPendingAnalysisPresentation(analysisElapsed);

  useEffect(() => {
    if (outcome !== 'success' || finishState) {
      return;
    }

    setFinishState({
      durationMs: reduceMotion ? 250 : analysisElapsed < 3_500 ? 800 : analysisElapsed < 8_000 ? 1_000 : 1_200,
      startElapsedMs: analysisElapsed,
      startProgress: pendingPresentation.progress,
    });
  }, [analysisElapsed, finishState, outcome, pendingPresentation.progress, reduceMotion]);

  const finishProgress = finishState
    ? Math.min(1, Math.max(0, (analysisElapsed - finishState.startElapsedMs) / finishState.durationMs))
    : 0;
  const easedFinishProgress = Easing.out(Easing.cubic)(finishProgress);
  const presentationProgress = outcome === 'success' && finishState
    ? finishState.startProgress + (1 - finishState.startProgress) * easedFinishProgress
    : pendingPresentation.progress;

  useEffect(() => {
    if (outcome === 'inline_failure') {
      progressValue.stopAnimation();
      return;
    }
    if (reduceMotion) {
      progressValue.setValue(presentationProgress);
      return;
    }
    Animated.timing(progressValue, {
      duration: 140,
      easing: Easing.out(Easing.quad),
      toValue: presentationProgress,
      useNativeDriver: false,
    }).start();
  }, [outcome, presentationProgress, progressValue, reduceMotion]);

  useEffect(() => {
    if (didTrackCompletion.current || outcome === 'pending') {
      return;
    }

    didTrackCompletion.current = true;
    if (outcome === 'success' && latestScanResult) {
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

    track(analyticsEvents.RESULT_ERROR, {
      errorMessage: timedOut ? 'Scan timed out.' : latestScanFailure?.rejectionReason ?? 'Scan did not return a safe result.',
      screen: 'AnalysisLoadingScreen',
    });
  }, [latestScanFailure?.rejectionReason, latestScanRecipe, latestScanResult, outcome, timedOut]);

  useEffect(() => {
    const routeScanSessionId = route.params?.scanSessionId;
    const isCurrentRouteSession = !routeScanSessionId || routeScanSessionId === scanSessionId;
    if (didNavigate.current || outcome !== 'success' || !finishState || !isCurrentRouteSession) {
      return;
    }

    const finish = setTimeout(() => {
      didNavigate.current = true;
      uiLog('AnalysisLoadingScreen', 'navigate_result', { status: latestScanStatus });
      navigation.navigate('MainTabs', {
        screen: 'ResultSummaryScreen',
        params: {
          recipeId: latestScanRecipe?.id,
          scanSessionId: route.params?.scanSessionId ?? scanSessionId ?? undefined,
        },
      });
    }, finishState.durationMs + 220);

    return () => clearTimeout(finish);
  }, [finishState, outcome, navigation, route.params?.scanSessionId, scanSessionId, latestScanRecipe?.id, latestScanStatus]);

  // Safety net: the scan store always receives a terminal write (the API client
  // times out at 60s), but if anything ever hangs past that, resolve to the
  // inline failure state instead of stranding the user on the loading screen.
  useEffect(() => {
    const safetyFallback = setTimeout(() => {
      uiLog('AnalysisLoadingScreen', 'navigate_result_safety_fallback');
      setTimedOut(true);
    }, 90_000);

    return () => clearTimeout(safetyFallback);
  }, [scanSessionId]);

  const resetForRetry = () => {
    didNavigate.current = false;
    didTrackCompletion.current = false;
    setTimedOut(false);
  };

  const goHome = (reason: string) => {
    didNavigate.current = true;
    clearLatestScan({ reason, source: 'AnalysisLoadingScreen.goHome' });
    navigation.reset(getHomeResetState());
  };

  const handleTryAgain = () => {
    if (isDescriptionScan) {
      resetForRetry();
      void startScan({
        mealDescription: mealDescription ?? '',
        mode: selectedMode,
        navigateToAnalysis: (newSessionId) => navigation.setParams({ scanSessionId: newSessionId }),
        reason: 'AnalysisLoadingScreen.tryAgainDescription',
        source: 'description',
      });
      return;
    }

    const fullImage = scanSessionId ? getLastPreparedImage(scanSessionId) : null;
    if (!fullImage) {
      void handleChooseAnotherPhoto();
      return;
    }

    resetForRetry();
    void startScan({
      image: fullImage,
      mode: selectedMode,
      navigateToAnalysis: (newSessionId) => navigation.setParams({ scanSessionId: newSessionId }),
      reason: 'AnalysisLoadingScreen.tryAgain',
      source: scanSource,
    });
  };

  const handleChooseAnotherPhoto = async () => {
    if (uploadInFlight.current) {
      return;
    }
    uploadInFlight.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        uiLog('AnalysisLoadingScreen', 'choose_another_photo_cancelled');
        return;
      }

      const image = await preparePickedImage(result.assets[0], 'photos');
      resetForRetry();
      void startScan({
        image,
        mode: selectedMode,
        navigateToAnalysis: (newSessionId) => navigation.setParams({ scanSessionId: newSessionId }),
        reason: 'AnalysisLoadingScreen.chooseAnotherPhoto',
        source: 'photos',
      });
    } catch {
      Alert.alert('Photo upload unavailable', 'Okyo could not open your photo library. Try again.');
    } finally {
      uploadInFlight.current = false;
    }
  };

  const handleEditDescription = () => {
    didNavigate.current = true;
    clearLatestScan({ reason: 'user_editing_description_after_failure', source: 'AnalysisLoadingScreen.editDescription' });
    navigation.reset(getFreshDescribeMealResetState(mealDescription ?? undefined));
  };

  const isFailure = outcome === 'inline_failure' && failureCopy;
  const stageIndex = outcome === 'success' ? 4 : pendingPresentation.stageIndex;
  const isFinishingComplete = outcome === 'success' && finishProgress >= 1;
  const heroImageHeight = Math.min(380, Math.max(326, windowHeight * 0.41));

  useEffect(() => {
    if (reduceMotion || isFailure || isFinishingComplete) {
      stagePulseValue.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(stagePulseValue, { duration: 700, easing: Easing.inOut(Easing.quad), toValue: 0.35, useNativeDriver: true }),
        Animated.timing(stagePulseValue, { duration: 700, easing: Easing.inOut(Easing.quad), toValue: 1, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isFailure, isFinishingComplete, reduceMotion, stagePulseValue]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, isDescriptionScan ? styles.descriptionHero : null]}>
          {!isDescriptionScan && stableScanImageUri ? (
            <View style={[styles.scanImageWrap, { height: heroImageHeight }]}>
              <Image resizeMode="cover" source={{ uri: stableScanImageUri }} style={styles.scanImage} />
              <Pressable
                accessibilityLabel="Back to Home"
                accessibilityRole="button"
                onPress={() => goHome('user_aborted_scan_from_loading')}
                style={({ pressed }) => [styles.backPill, pressed ? styles.pressed : null]}
              >
                <View pointerEvents="none" style={styles.backPillBackdrop}>
                  <BlurView intensity={42} style={StyleSheet.absoluteFill} tint="light" />
                </View>
                <NavArrowLeft color={colors.charcoal} height={21} strokeWidth={2.4} width={21} />
                <Text style={styles.backPillText}>Home</Text>
              </Pressable>
              {!isFailure ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineProgress.interpolate({ inputRange: [0, 1], outputRange: [8, heroImageHeight - 14] }) }] },
                  ]}
                />
              ) : null}
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Back to Home"
              accessibilityRole="button"
              onPress={() => goHome('user_aborted_scan_from_loading')}
              style={({ pressed }) => [styles.descriptionBackPill, pressed ? styles.pressed : null]}
            >
              <NavArrowLeft color={colors.charcoal} height={21} strokeWidth={2.4} width={21} />
              <Text style={styles.backPillText}>Home</Text>
            </Pressable>
          )}
          <View style={styles.appIconFrame}>
            <Image accessibilityIgnoresInvertColors resizeMode="contain" source={okyoAppIcon} style={styles.appIcon} />
          </View>
          {isFailure ? (
            <>
              <Text style={styles.title}>{failureCopy.title}</Text>
              <Text style={styles.failureBody}>{failureCopy.body}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, isDescriptionScan ? styles.descriptionTitle : null]}>
                Okyo is scanning your food
              </Text>
              <Text numberOfLines={2} style={styles.statusText}>
                {ANALYSIS_STAGES[stageIndex]}
              </Text>
            </>
          )}
        </View>

        <View
          accessibilityLabel={isDescriptionScan ? 'Building your recipe' : 'Scanning your food'}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: 100, min: 0, now: Math.round(presentationProgress * 100) }}
          style={styles.progressTrack}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          >
            <VideoView contentFit="cover" nativeControls={false} player={progressVideoPlayer} style={StyleSheet.absoluteFill} surfaceType="textureView" />
          </Animated.View>
        </View>

        {!isFailure ? (
          <View style={styles.stageSection}>
            <View accessibilityLabel="Analysis stages" style={styles.stageList}>
              {ANALYSIS_STAGES.map((stage, index) => {
                const complete = index < stageIndex || (index === 4 && isFinishingComplete);
                const current = index === stageIndex && !complete;
                return (
                  <View key={stage} style={styles.stageRow}>
                    <View style={[styles.stageMarker, complete ? styles.stageMarkerComplete : null, current ? styles.stageMarkerCurrent : null]}>
                      {complete ? <Check color="#FFFFFF" height={14} strokeWidth={3} width={14} /> : null}
                      {current ? <Animated.View style={[styles.stageMarkerActiveDot, { opacity: stagePulseValue }]} /> : null}
                    </View>
                    <Text style={[styles.stageLabel, complete ? styles.stageLabelComplete : null, current ? styles.stageLabelCurrent : null]}>
                      {stage}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {isFailure ? (
          <View style={styles.failureActions}>
            <PrimaryButton onPress={handleTryAgain}>Try again</PrimaryButton>
            {isDescriptionScan ? (
              <SecondaryAction label="Edit description" onPress={handleEditDescription} />
            ) : (
              <SecondaryAction label="Choose another photo" onPress={() => void handleChooseAnotherPhoto()} />
            )}
            <SecondaryAction label="Back to Home" onPress={() => goHome('user_left_scan_after_failure')} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
    >
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
  },
  backPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    left: 14,
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 12,
    position: 'absolute',
    top: 14,
    zIndex: 3,
  },
  backPillBackdrop: {
    borderRadius: 21,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backPillText: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  descriptionBackPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  hero: {
    alignItems: 'center',
    marginTop: 2,
  },
  descriptionHero: {
    marginTop: 8,
    width: '100%',
  },
  scanImageWrap: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 30,
    height: 310,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  appIconFrame: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 20,
    overflow: 'hidden',
    width: 120,
  },
  appIcon: {
    height: 120,
    maxHeight: 120,
    maxWidth: 120,
    width: 120,
  },
  scanImage: {
    height: '100%',
    width: '100%',
  },
  scanLine: {
    backgroundColor: colors.coral,
    height: 3,
    left: 14,
    opacity: 0.9,
    position: 'absolute',
    right: 14,
    top: 0,
  },
  title: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.45,
    lineHeight: 35,
    maxWidth: 340,
    textAlign: 'center',
  },
  descriptionTitle: {
    fontSize: 24,
    lineHeight: 29,
    maxWidth: 300,
  },
  statusText: {
    color: colors.coral,
    fontFamily: fontFamilies.bold,
    fontSize: 19,
    fontWeight: '700',
    minHeight: 28,
    lineHeight: 26,
    marginTop: 5,
    maxWidth: 300,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  stageSection: {
    marginTop: 16,
    width: '100%',
  },
  stageList: {
    gap: 9,
  },
  stageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 24,
  },
  stageMarker: {
    alignItems: 'center',
    backgroundColor: '#F2E8E5',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  stageMarkerCurrent: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coral,
    borderWidth: 1,
  },
  stageMarkerComplete: {
    backgroundColor: colors.coral,
  },
  stageMarkerActiveDot: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  stageLabel: {
    color: '#A7A1A5',
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  stageLabelCurrent: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  stageLabelComplete: {
    color: colors.body,
  },
  failureBody: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 320,
    textAlign: 'center',
  },
  progressTrack: {
    alignSelf: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    height: 8,
    marginTop: 14,
    overflow: 'hidden',
    width: '72%',
  },
  progressFill: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    height: '100%',
  },
  failureActions: {
    gap: 10,
    marginTop: 28,
    width: '100%',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  secondaryActionText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
