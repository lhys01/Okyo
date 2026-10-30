import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Check } from 'iconoir-react-native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamilies, PrimaryButton } from '../components/OkyoUI';
import { BackButton } from '../components/okyo/BackButton';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { useChosenMascotName } from '../state/useMascotName';
import { getRealScanImageUri } from '../utils/recipeImages';
import { getScanActivitySnapshot, subscribeToScanActivity } from '../utils/scanActivity';
import { createPickedImagePreview } from '../utils/scanImageReference';
import { cancelScanSession, getLastPreparedImage, getRetryScanIdempotencyKey, startScan } from '../utils/scanController';
import { getAnalysisScreenOutcome, getScanResultNavigationTarget } from '../utils/scanControllerUtils';
import { isUsableScan } from '../utils/scanDecision';
import { getInlineFailureCopy, getScanFailureCategory } from '../utils/scanFailureCopy';
import { preparePickedImage } from '../utils/scanImageProcessing';
import { getPendingAnalysisPresentation } from '../utils/scanProgress';
import { getAnalysisScreenLayout } from '../utils/analysisScreenLayout';
import { scanTraceLog, uiLog } from '../utils/uiDebug';

type AnalysisNavigation = NativeStackNavigationProp<RootStackParamList, 'AnalysisLoadingScreen'>;
type AnalysisRoute = RouteProp<RootStackParamList, 'AnalysisLoadingScreen'>;
const loadingProgressVideo = require('../../assets/backgrounds/button-background/loading-progress-gradient.mp4');
const okyoAppIcon = require('../../assets/app-icon/icon.png');

const ANALYSIS_STAGES = [
  'Identifying the image',
  'Finding ingredients',
  'Making the recipe',
  'Calculating the macros',
  'Adding the finishing touches',
] as const;

export function AnalysisLoadingScreen() {
  const mascotName = useChosenMascotName();
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
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const scanImageUri = getRealScanImageUri(selectedScanImage);
  const scanActivity = useSyncExternalStore(subscribeToScanActivity, getScanActivitySnapshot, getScanActivitySnapshot);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [finishState, setFinishState] = useState<{ durationMs: number; startElapsedMs: number; startProgress: number } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const isDescriptionScan = scanSource === 'description';
  const statusSequenceKey = `${activeScanSessionId}:${scanSource}`;
  const isPreparingImage = !isDescriptionScan && scanActivity?.scanSessionId === activeScanSessionId && scanActivity.phase === 'preparing';
  const layout = getAnalysisScreenLayout(windowHeight, insets.top, insets.bottom);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [previewLoad, setPreviewLoad] = useState<{ scanSessionId: string; uri: string; state: 'loaded' | 'failed' } | null>(null);
  const didNavigate = useRef(false);
  const didCancel = useRef(false);
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

  // Use the current session's selected image URI. It intentionally changes
  // once when the picker cache URI is replaced by its durable Documents copy.
  const stableScanImageUri = scanImageUri;

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
  const failureCopy = failureCategory ? getInlineFailureCopy(failureCategory, isDescriptionScan, mascotName) : null;

  useEffect(() => {
    scanTraceLog('analysis_outcome', {
      requestId: activeScanSessionId,
      status: outcome,
      hasScan: Boolean(latestScanResult),
      hasRecipe: Boolean(latestScanRecipe),
      routeSessionMatches: !route.params?.scanSessionId || route.params.scanSessionId === scanSessionId,
      stage: 'navigation',
    });
  }, [activeScanSessionId, latestScanRecipe, latestScanResult, outcome, route.params?.scanSessionId, scanSessionId]);

  useEffect(() => {
    setAnalysisElapsed(0);
    setFinishState(null);
    const startedAt = Date.now();
    const timer = setInterval(() => setAnalysisElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [activeScanSessionId, isPreparingImage]);

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

      return;
    }


  }, [latestScanFailure?.rejectionReason, latestScanRecipe, latestScanResult, outcome, timedOut]);

  useEffect(() => {
    const routeScanSessionId = route.params?.scanSessionId;
    const isCurrentRouteSession = !routeScanSessionId || routeScanSessionId === scanSessionId;
    if (didNavigate.current || didCancel.current || outcome !== 'success' || !finishState || !isCurrentRouteSession) {
      return;
    }

    const finish = setTimeout(() => {
      if (didCancel.current || !navigation.isFocused()) return;
      didNavigate.current = true;
      uiLog('AnalysisLoadingScreen', 'navigate_result', { status: latestScanStatus });
      navigation.navigate('MainTabs', getScanResultNavigationTarget(
        latestScanRecipe?.id,
        route.params?.scanSessionId ?? scanSessionId ?? undefined,
      ));
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
    didCancel.current = false;
    didTrackCompletion.current = false;
    setTimedOut(false);
  };

  const handleGoBack = () => {
    didCancel.current = true;
    const sessionId = route.params?.scanSessionId ?? scanSessionId;
    if (sessionId) {
      cancelScanSession(sessionId, 'AnalysisLoadingScreen.back');
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'HomeScreen' });
    }
  };

  const handleTryAgain = () => {
    const idempotencyKey = scanSessionId ? getRetryScanIdempotencyKey(scanSessionId) : undefined;
    if (isDescriptionScan) {
      resetForRetry();
      void startScan({
        mealDescription: mealDescription ?? '',
        idempotencyKey,
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
      idempotencyKey,
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

      const asset = result.assets[0];
      const image = createPickedImagePreview(asset, 'photos');
      resetForRetry();
      void startScan({
        image,
        prepareImage: () => preparePickedImage(asset, 'photos'),
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

  const isFailure = outcome === 'inline_failure' && failureCopy;
  const stageIndex = outcome === 'success' ? 4 : pendingPresentation.stageIndex;
  const isFinishingComplete = outcome === 'success' && finishProgress >= 1;
  const heroImageHeight = layout.imageHeight;
  const iconSize = layout.iconSize;
  const previewLoaded = previewLoad?.scanSessionId === activeScanSessionId && previewLoad.uri === stableScanImageUri && previewLoad.state === 'loaded';
  const previewFailed = previewLoad?.scanSessionId === activeScanSessionId && previewLoad.uri === stableScanImageUri && previewLoad.state === 'failed';

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
      <View style={styles.topBar}>
        <BackButton onPress={handleGoBack} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={[styles.hero, isDescriptionScan ? styles.descriptionHero : null]}>
          {!isDescriptionScan && stableScanImageUri ? (
            <View style={[styles.scanImageWrap, { height: heroImageHeight }]}>
              <Image
                accessibilityLabel="Selected dish photo"
                key={`${activeScanSessionId}:${stableScanImageUri}`}
                onError={() => setPreviewLoad({ scanSessionId: activeScanSessionId, uri: stableScanImageUri, state: 'failed' })}
                onLoad={() => setPreviewLoad({ scanSessionId: activeScanSessionId, uri: stableScanImageUri, state: 'loaded' })}
                resizeMode="cover"
                source={{ uri: stableScanImageUri }}
                style={styles.scanImage}
              />
              {!previewLoaded && !previewFailed ? (
                <View pointerEvents="none" style={styles.imageLoadingOverlay}>
                  <ActivityIndicator color={colors.coral} />
                  <Text style={styles.imageLoadingText}>Loading your photo…</Text>
                </View>
              ) : null}
              {previewFailed && isPreparingImage ? (
                <View pointerEvents="none" style={styles.imageLoadingOverlay}>
                  <ActivityIndicator color={colors.coral} />
                  <Text style={styles.imageLoadingText}>Getting your photo ready…</Text>
                </View>
              ) : null}
              {previewFailed && !isPreparingImage ? (
                <View pointerEvents="none" style={styles.imageLoadingOverlay}>
                  <Text style={styles.imageLoadingText}>Photo preview unavailable</Text>
                </View>
              ) : null}
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
          ) : !isDescriptionScan && isPreparingImage ? (
            <View style={[styles.scanImageWrap, styles.preparingImage, { height: heroImageHeight }]}>
              <ActivityIndicator color={colors.coral} size="large" />
              <Text style={styles.imageLoadingText}>Getting your photo ready…</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={[styles.appIconFrame, { height: iconSize, width: iconSize, borderRadius: layout.compact ? 22 : 28, marginTop: layout.compact ? 12 : 18, marginBottom: layout.compact ? 10 : 14 }]}>
            <Image accessibilityIgnoresInvertColors resizeMode="contain" source={okyoAppIcon} style={{ height: iconSize, width: iconSize }} />
          </View>
          {isFailure ? (
            <>
              <Text style={styles.title}>{failureCopy.title}</Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={2} style={styles.failureBody}>{failureCopy.body}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, isDescriptionScan ? styles.descriptionTitle : null]}>
                Okyo is scanning your food
              </Text>
              <Text numberOfLines={2} style={styles.statusText}>
                {isPreparingImage ? 'Getting your photo ready' : ANALYSIS_STAGES[stageIndex]}
              </Text>
            </>
          )}
        </View>

        {!isFailure ? (
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
        ) : null}

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
                      {isPreparingImage && index === 0 ? 'Getting your photo ready' : stage}
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
            <SecondaryAction label="Choose another photo" onPress={() => void handleChooseAnotherPhoto()} />
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
  topBar: {
    alignItems: 'flex-start',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  scroll: {
    flex: 1,
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
  preparingImage: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  imageLoadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 250, 245, 0.82)',
    bottom: 0,
    gap: 8,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  imageLoadingText: {
    color: colors.body,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    textAlign: 'center',
  },
  appIconFrame: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 20,
    overflow: 'hidden',
    borderRadius: 28,
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
    fontWeight: '800',
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
    fontSize: 15,
    lineHeight: 20,
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
