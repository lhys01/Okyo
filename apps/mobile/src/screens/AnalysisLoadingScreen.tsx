import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { NavArrowLeft } from 'iconoir-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { KikoMascot } from '../components/KikoMascot';
import { colors, PrimaryButton } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { getRealScanImageUri } from '../utils/recipeImages';
import { getLastPreparedImage, startScan } from '../utils/scanController';
import { getAnalysisScreenOutcome, getFreshDescribeMealResetState, getHomeResetState } from '../utils/scanControllerUtils';
import { isUsableScan } from '../utils/scanDecision';
import { getInlineFailureCopy, getScanFailureCategory } from '../utils/scanFailureCopy';
import { preparePickedImage } from '../utils/scanImageProcessing';
import { createStatusSequenceForScan } from '../utils/scanLoadingMessages';
import { INITIAL_SCAN_PROGRESS_STATE, nextScanProgress, type ScanProgressState } from '../utils/scanProgress';
import { uiLog } from '../utils/uiDebug';

type AnalysisNavigation = NativeStackNavigationProp<RootStackParamList, 'AnalysisLoadingScreen'>;
type AnalysisRoute = RouteProp<RootStackParamList, 'AnalysisLoadingScreen'>;

export function AnalysisLoadingScreen() {
  const navigation = useNavigation<AnalysisNavigation>();
  const route = useRoute<AnalysisRoute>();
  const insets = useSafeAreaInsets();
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
  const [pulseIndex, setPulseIndex] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const isDescriptionScan = scanSource === 'description';
  const statusMessages = useMemo(
    () => createStatusSequenceForScan(scanSource, Math.random),
    [activeScanSessionId, scanSource],
  );
  const statusSequenceKey = `${activeScanSessionId}:${scanSource}`;
  const [reduceMotion, setReduceMotion] = useState(false);
  const didNavigate = useRef(false);
  const didTrackCompletion = useRef(false);
  const pulseSequenceKey = useRef(statusSequenceKey);
  const scanLineProgress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const scanProgressStateRef = useRef<ScanProgressState>(INITIAL_SCAN_PROGRESS_STATE);
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
    pulseSequenceKey.current = statusSequenceKey;
    setPulseIndex(0);
  }, [statusSequenceKey]);

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
    if (outcome !== 'pending' || reduceMotion) {
      return;
    }

    uiLog('AnalysisLoadingScreen', 'enter');
    const pulse = setInterval(() => {
      setPulseIndex((currentIndex) => Math.min(currentIndex + 1, statusMessages.length - 1));
    }, 2000);

    return () => clearInterval(pulse);
  }, [statusMessages.length, statusSequenceKey, outcome, reduceMotion]);

  useEffect(() => {
    const isPending = outcome === 'pending';
    const nextState = nextScanProgress({
      hasPreparedImage: Boolean(selectedScanImage) || isDescriptionScan,
      hasValidatedRecipe: outcome === 'success',
      previous: scanProgressStateRef.current,
      scanSessionId: activeScanSessionId,
      status: outcome === 'inline_failure' ? 'failed' : isPending ? 'pending' : 'success',
    });
    const isNewSession = nextState.scanSessionId !== scanProgressStateRef.current.scanSessionId;
    const previousValue = scanProgressStateRef.current.value;
    scanProgressStateRef.current = nextState;

    // No forward movement to animate — skip restarting an identical
    // Animated.timing on every unrelated re-render (e.g. a rotating message
    // or an unchanged store update). This is what keeps the bar from
    // repeatedly re-running 0 -> 100 for a single scan.
    if (!isNewSession && nextState.value === previousValue) {
      return;
    }

    if (isNewSession) {
      progressValue.setValue(0);
    }

    if (reduceMotion) {
      progressValue.setValue(nextState.value);
      return;
    }

    Animated.timing(progressValue, {
      duration: isPending ? 12000 : 360,
      easing: Easing.out(Easing.quad),
      toValue: nextState.value,
      useNativeDriver: false,
    }).start();
  }, [activeScanSessionId, isDescriptionScan, outcome, progressValue, reduceMotion, selectedScanImage]);

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
    if (didNavigate.current || outcome !== 'success' || !isCurrentRouteSession) {
      return;
    }

    const finish = setTimeout(() => {
      didNavigate.current = true;
      uiLog('AnalysisLoadingScreen', 'navigate_result', { status: latestScanStatus });
      navigation.navigate('ResultSummaryScreen', {
        recipeId: latestScanRecipe?.id,
        scanSessionId: route.params?.scanSessionId ?? scanSessionId ?? undefined,
      });
    }, 750);

    return () => clearTimeout(finish);
  }, [outcome, navigation, route.params?.scanSessionId, scanSessionId, latestScanRecipe?.id, latestScanStatus]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back to Home"
            accessibilityRole="button"
            onPress={() => goHome('user_aborted_scan_from_loading')}
            style={({ pressed }) => [styles.backPill, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.charcoal} height={24} strokeWidth={2.35} width={24} />
            <Text style={styles.backPillText}>Home</Text>
          </Pressable>
        </View>

        <View style={[styles.hero, isDescriptionScan ? styles.descriptionHero : null]}>
          {!isDescriptionScan && stableScanImageUri ? (
            <View style={styles.scanImageWrap}>
              <Image resizeMode="cover" source={{ uri: stableScanImageUri }} style={styles.scanImage} />
              {!isFailure ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineProgress.interpolate({ inputRange: [0, 1], outputRange: [8, 298] }) }] },
                  ]}
                />
              ) : null}
            </View>
          ) : null}
          <KikoMascot
            pose={isFailure ? 'thinking' : 'scanning'}
            size={isDescriptionScan ? 48 : 72}
            style={styles.heroMascot}
          />
          {isFailure ? (
            <>
              <Text style={styles.title}>{failureCopy.title}</Text>
              <Text style={styles.failureBody}>{failureCopy.body}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, isDescriptionScan ? styles.descriptionTitle : null]}>
                {isDescriptionScan ? 'Kiko is building your recipe' : 'Kiko is studying your food'}
              </Text>
              <Text numberOfLines={2} style={styles.statusText}>
                {statusMessages[pulseSequenceKey.current === statusSequenceKey ? pulseIndex : 0] ?? statusMessages[0]}
              </Text>
            </>
          )}
        </View>

        <View accessibilityLabel={isDescriptionScan ? 'Building your recipe' : 'Scanning your food'} accessibilityRole="progressbar" style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>

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
    paddingHorizontal: 22,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 8,
    minHeight: 64,
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
    opacity: 0.72,
    paddingHorizontal: 14,
    position: 'absolute',
    top: 8,
  },
  backPillText: {
    color: colors.body,
    fontSize: 17,
    fontWeight: '700',
  },
  hero: {
    alignItems: 'center',
    marginTop: 24,
  },
  descriptionHero: {
    marginTop: 8,
  },
  heroMascot: {
    marginTop: 4,
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
    top: 82,
  },
  title: {
    color: colors.charcoal,
    fontSize: 29,
    fontWeight: '700',
    lineHeight: 35,
    textAlign: 'center',
  },
  descriptionTitle: {
    fontSize: 24,
    lineHeight: 29,
    maxWidth: 300,
  },
  statusText: {
    color: colors.coral,
    fontSize: 19,
    fontWeight: '700',
    height: 52,
    lineHeight: 26,
    marginTop: 8,
    maxWidth: 300,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  failureBody: {
    color: colors.body,
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
    marginTop: 22,
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
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
