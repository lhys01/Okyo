import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import {
  KikoSpeechBubble,
  OnboardingFirstResultScreen,
  OnboardingHeroScreen,
  OnboardingLoadingScreen,
  OnboardingPaywallScreen,
  OnboardingScanCard,
  OnboardingScreenShell,
  OnboardingStatefulButton,
  onboardingColors,
} from '../components/onboarding/OnboardingUI';
import { KikoMascot } from '../components/KikoMascot';
import {
  getSafeRecipeMode,
  type Recipe,
  type RecipeMode,
} from '../mocks';
import {
  useOkyoStore,
  type LatestScanFailure,
  type OnboardingWeeklyGoal,
} from '../state/useOkyoStore';
import { colors, fontFamilies, shadows } from '../theme/okyoTheme';
import { hasFoodEvidence, isUsableScan, shouldRejectScan } from '../utils/scanDecision';
import { checkImageFileExists } from '../utils/imageValidation';
import {
  getMissingOnboardingImageError,
  getNextOnboardingPlanScreen,
  getOnboardingResponseImage,
  getOnboardingResultFallbackScreen,
  getOnboardingScanStartDecision,
  getOnboardingUploadUri,
  isCurrentOnboardingScanSession,
  shouldKeepOnboardingScanLoading,
} from '../utils/onboardingScanGuards';
import { copyToDocuments } from '../utils/scanImageStorage';
import { isPurchaseProviderAvailable } from '../utils/purchaseAvailability';
import { imageTraceLog, uiLog } from '../utils/uiDebug';

const purchasesAvailable = isPurchaseProviderAvailable();

type OnboardingScreenKey =
  | 'splash'
  | 'hero'
  | 'weeklyGoal'
  | 'reminder'
  | 'scan'
  | 'loading'
  | 'firstResult'
  | 'paywall';

const maxImageDataUrlBytes = 12_000_000;
const maxProcessedImageWidth = 1400;

const progressSteps: OnboardingScreenKey[] = [
  'hero',
  'weeklyGoal',
  'reminder',
  'loading',
  'scan',
  'firstResult',
  'paywall',
];

type WeeklyGoalOption = {
  frequency: string;
  id: string;
  label: string;
};

const weeklyGoalOptions: WeeklyGoalOption[] = [
  { id: '1_meal', frequency: '1 meal / week', label: 'Casual' },
  { id: '3_meals', frequency: '3 meals / week', label: 'Regular' },
  { id: '5_meals', frequency: '5 meals / week', label: 'Serious' },
  { id: '7_meals', frequency: '7 meals / week', label: 'All in' },
];

export function WelcomeScreen() {
  const [screenKey, setScreenKey] = useState<OnboardingScreenKey>('splash');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanSubmitting, setIsScanSubmitting] = useState(false);
  const [loadingImageUri, setLoadingImageUri] = useState<string | null>(null);
  const [selectedWeeklyGoal, setSelectedWeeklyGoal] = useState<string | null>(null);
  const didTrackStart = useRef(false);
  const isScanSubmittingRef = useRef(false);
  const loadingScanSessionIdRef = useRef<string | null>(null);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const activeScanSessionId = useOkyoStore((state) => state.scanSessionId);
  const activeScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const beginLatestScanSession = useOkyoStore((state) => state.beginLatestScanSession);
  const writeLatestScanSession = useOkyoStore((state) => state.writeLatestScanSession);
  const clearLatestScan = useOkyoStore((state) => state.clearLatestScan);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const setWeeklyGoal = useOkyoStore((state) => state.setWeeklyGoal);
  const setNotificationChoice = useOkyoStore((state) => state.setNotificationChoice);
  const markFirstOnboardingScanCompleted = useOkyoStore((state) => state.markFirstOnboardingScanCompleted);
  const markFirstOnboardingResultSeen = useOkyoStore((state) => state.markFirstOnboardingResultSeen);
  const markPaywallShown = useOkyoStore((state) => state.markPaywallShown);
  const completeOnboarding = useOkyoStore((state) => state.completeOnboarding);
  const setPremium = useOkyoStore((state) => state.setPremium);
  const resultRecipe = latestScanRecipe;

  const transitionScreen = (nextScreen: OnboardingScreenKey, reason: string) => {
    setScreenKey((previousScreen) => {
      if (previousScreen === nextScreen) {
        return previousScreen;
      }
      const activeScan = useOkyoStore.getState();
      imageTraceLog('WelcomeScreen', {
        stage: 'screen_transition',
        previousScreen,
        nextScreen,
        reason,
        activeScanSessionId: activeScan.scanSessionId,
        activeScanStatus: activeScan.latestScanStatus,
      });
      return nextScreen;
    });
  };

  useEffect(() => {
    if (didTrackStart.current) {
      return;
    }

    didTrackStart.current = true;
    clearLatestScan({
      reason: 'onboarding_started',
      source: 'WelcomeScreen.enter_onboarding_flow',
    });
    uiLog('WelcomeScreen', 'enter_onboarding_flow');
    track(analyticsEvents.ONBOARDING_START, { screen: 'WelcomeScreen' });
  }, [clearLatestScan]);

  useEffect(() => {
    if (screenKey !== 'splash') {
      return;
    }

    Animated.sequence([
      Animated.timing(splashOpacity, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(820),
      Animated.timing(splashOpacity, {
        duration: 280,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      transitionScreen('hero', 'splash_completed');
    });
  }, [screenKey, splashOpacity]);

  // The plan loader is a pre-scan step. It must always finish at the scan step;
  // selected image state belongs to the scan request that follows it.
  useEffect(() => {
    if (screenKey !== 'loading') {
      return;
    }

    if (shouldKeepOnboardingScanLoading({
      screenKey,
      loadingScanSessionId: loadingScanSessionIdRef.current,
      activeScanSessionId,
      activeScanStatus,
    })) {
      return;
    }

    const timer = setTimeout(() => {
      transitionScreen('scan', 'plan_loading_timer_completed');
    }, 2500);

    return () => clearTimeout(timer);
  }, [activeScanSessionId, activeScanStatus, screenKey]);

  const progress = useMemo(() => {
    const index = progressSteps.indexOf(screenKey);
    if (index < 0) {
      return 0.05;
    }

    return (index + 1) / progressSteps.length;
  }, [screenKey]);

  const goBack = () => {
    const currentIndex = progressSteps.indexOf(screenKey);
    if (currentIndex <= 0 || screenKey === 'loading' || screenKey === 'firstResult' || screenKey === 'paywall') {
      return;
    }

    // Skip the 'loading' (Building Your Plan) step when navigating back from scan
    if (screenKey === 'scan') {
      transitionScreen('reminder', 'back_from_scan');
      return;
    }

    transitionScreen(progressSteps[currentIndex - 1], 'back_navigation');
  };

  const advance = () => {
    if (screenKey === 'weeklyGoal' || screenKey === 'reminder' || screenKey === 'loading') {
      transitionScreen(getNextOnboardingPlanScreen(screenKey), 'onboarding_step_advanced');
      return;
    }

    const currentIndex = progressSteps.indexOf(screenKey);
    if (currentIndex >= 0 && currentIndex < progressSteps.length - 1) {
      transitionScreen(progressSteps[currentIndex + 1], 'onboarding_step_advanced');
    }
  };

  const commitWeeklyGoal = () => {
    setWeeklyGoal((selectedWeeklyGoal ?? '3_meals') as OnboardingWeeklyGoal);
    advance();
  };

  const remindMe = () => {
    setNotificationChoice('remind_me');
    advance();
  };

  const skipReminder = () => {
    setNotificationChoice('not_now');
    advance();
  };

  const takePhoto = async () => {
    if (isScanSubmittingRef.current) {
      return;
    }
    isScanSubmittingRef.current = true;
    setScanError(null);
    imageTraceLog('WelcomeScreen', { stage: 'lock_acquired', source: 'camera' });
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera permission needed',
          'Okyo needs camera permission to take a food photo. You can allow camera access in Settings or upload from Photos.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        imageTraceLog('WelcomeScreen', { stage: 'picker_canceled', source: 'camera' });
        return;
      }

      imageTraceLog('WelcomeScreen', { stage: 'picker_asset_received', source: 'camera', asset: getAssetLogSummary(result.assets[0]) });
      await startOnboardingScan('camera', await getImageMetadata(result.assets[0], 'camera'));
    } catch (error) {
      const friendlyMessage = getOnboardingImageErrorMessage(error, 'Camera unavailable.');
      imageTraceLog('WelcomeScreen', { stage: 'caught_error', source: 'camera', error: serializeError(error) });
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: friendlyMessage,
        screen: 'WelcomeScreen',
        source: 'camera',
      });
      if (isOnboardingImageUnavailableError(error)) {
        transitionScreen('scan', 'camera_error');
        setScanError(friendlyMessage);
      } else {
        transitionScreen('scan', 'camera_error');
        setScanError(friendlyMessage);
      }
    } finally {
      isScanSubmittingRef.current = false;
      imageTraceLog('WelcomeScreen', { stage: 'lock_released', source: 'camera' });
    }
  };

  const uploadFromPhotos = async () => {
    if (isScanSubmittingRef.current) {
      return;
    }
    isScanSubmittingRef.current = true;
    setScanError(null);
    imageTraceLog('WelcomeScreen', { stage: 'lock_acquired', source: 'photos' });
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        imageTraceLog('WelcomeScreen', { stage: 'picker_canceled', source: 'photos' });
        return;
      }

      imageTraceLog('WelcomeScreen', { stage: 'picker_asset_received', source: 'photos', asset: getAssetLogSummary(result.assets[0]) });
      await startOnboardingScan('photos', await getImageMetadata(result.assets[0], 'photos'));
    } catch (error) {
      const friendlyMessage = getOnboardingImageErrorMessage(error, 'Image picker failed.');
      imageTraceLog('WelcomeScreen', { stage: 'caught_error', source: 'photos', error: serializeError(error) });
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: friendlyMessage,
        screen: 'WelcomeScreen',
        source: 'photos',
      });
      if (isOnboardingImageUnavailableError(error)) {
        transitionScreen('scan', 'photos_error');
        setScanError(friendlyMessage);
      } else {
        transitionScreen('scan', 'photos_error');
        setScanError(friendlyMessage);
      }
    } finally {
      isScanSubmittingRef.current = false;
      imageTraceLog('WelcomeScreen', { stage: 'lock_released', source: 'photos' });
    }
  };

  const startOnboardingScan = async (source: ScanSource, image: ScanImageMetadata | null | undefined) => {
    const startDecision = getOnboardingScanStartDecision(isScanSubmitting, image);
    if (!startDecision.canStart) {
      if (startDecision.reason !== 'scan_already_submitting') {
        transitionScreen('scan', 'missing_onboarding_image');
        setScanError(getMissingOnboardingImageError());
      }
      return;
    }

    const processedImage = startDecision.image;
    imageTraceLog('WelcomeScreen', { stage: 'copyToDocuments_started', source, uri: processedImage.uri });
    let preparedImage = processedImage;
    try {
      const persistedImage = await copyToDocuments(processedImage);
      imageTraceLog('WelcomeScreen', { stage: 'persisted_uri', source, uri: persistedImage.uri });
      const persistedExists = await checkImageFileExists(persistedImage.uri);
      imageTraceLog('WelcomeScreen', { stage: 'persisted_file_existence_result', source, uri: persistedImage.uri, exists: persistedExists });
      preparedImage = !persistedExists && persistedImage.uri !== processedImage.uri ? processedImage : persistedImage;
      imageTraceLog('WelcomeScreen', { stage: 'prepared_uri', source, uri: preparedImage.uri });
    } catch (error) {
      imageTraceLog('WelcomeScreen', { stage: 'local_preparation_failed', source, error: serializeError(error) });
      transitionScreen('scan', 'local_image_preparation_failed');
      setScanError(error instanceof Error ? error.message : getMissingOnboardingImageError());
      return;
    }

    const scanSessionId = createScanSessionId(source);
    const previewImage = getPreviewImageMetadata(preparedImage);
    setIsScanSubmitting(true);
    setScanError(null);
    track(analyticsEvents.SCAN_STARTED, { screen: 'WelcomeScreen', source });
    beginLatestScanSession({
      scanSessionId,
      latestScanStatus: 'pending',
      latestScanFailure: null,
      latestScanResult: null,
      latestScanRecipe: null,
      selectedScanImage: previewImage,
      latestAiDebugMetadata: null,
      mealDescription: null,
      source,
      reason: 'WelcomeScreen.startOnboardingScan',
    });
    setLoadingImageUri(previewImage?.uri ?? null);
    loadingScanSessionIdRef.current = scanSessionId;
    imageTraceLog('WelcomeScreen', { stage: 'scan_session_created', source, scanSessionId, uri: preparedImage.uri });
    transitionScreen('loading', 'scan_session_created');
    imageTraceLog('WelcomeScreen', { stage: 'loading_started', source, scanSessionId });

    try {
      imageTraceLog('WelcomeScreen', { stage: 'createMockScan_called', source, scanSessionId, uri: preparedImage.uri });
      const result = await createMockScan({ image: preparedImage, mode: selectedMode, source });
      imageTraceLog('WelcomeScreen', { stage: 'request_succeeded', source, scanSessionId });
      if (!isActiveScanSession(scanSessionId)) {
        return;
      }

      const handled = handleScanResult({
        selectedImage: preparedImage,
        result,
        scanSessionId,
        source,
      });

      if (!handled) {
        loadingScanSessionIdRef.current = null;
        setLoadingImageUri(null);
        transitionScreen('scan', 'scan_result_unusable');
        setScanError(getScanFailureReason(result));
      }
    } catch (error) {
      imageTraceLog('WelcomeScreen', { stage: 'request_failed', source, scanSessionId, error: serializeError(error) });
      if (!isActiveScanSession(scanSessionId)) {
        return;
      }

      const failureReason = getUploadFailureReasonFromError(error);
      const failure = {
        status: 'failed',
        rejectionType: 'ai_failed',
        rejectionReason: failureReason,
      } satisfies LatestScanFailure;
      writeLatestScanSession({
        scanSessionId,
        latestScanStatus: 'failed',
        latestScanFailure: failure,
        latestScanResult: null,
        latestScanRecipe: null,
        selectedScanImage: previewImage,
        latestAiDebugMetadata: {
          aiSource: 'fallback_ai',
          fallbackReason: 'mobile_api_unavailable',
          confidence: 0,
        },
        mealDescription: null,
        source,
        reason: 'WelcomeScreen.api_error',
      });
      loadingScanSessionIdRef.current = null;
      setLoadingImageUri(null);
      transitionScreen('scan', 'scan_request_failed');
      setScanError(failureReason);
    } finally {
      if (isActiveScanSession(scanSessionId)) {
        setIsScanSubmitting(false);
      }
    }
  };

  const handleScanResult = ({
    selectedImage,
    result,
    scanSessionId,
    source,
  }: {
    selectedImage: ScanImageMetadata;
    result: CreateScanResult;
    scanSessionId: string;
    source: ScanSource;
  }) => {
    const status = result.status ?? 'success';
    const recipes = getScanRecipes(result);
    const selectedRecipe = getScanRecipeForMode(recipes, selectedMode, result.recipe);
    const responseImage = getPreviewImageMetadata(getOnboardingResponseImage(selectedImage, result));
    const aiDebugMetadata = getAiDebugMetadata(result);
    const canRevealResult = Boolean(
      result.scan &&
      selectedRecipe &&
      hasCompleteOnboardingRecipe(selectedRecipe) &&
      isUsableScan({
        recipes,
        result,
        scan: result.scan,
        status,
      }),
    );

    if (canRevealResult && result.scan && selectedRecipe) {
      const safeMode = getSafeRecipeMode(selectedRecipe.mode);
      setSelectedMode(safeMode);
      writeLatestScanSession({
        scanSessionId,
        latestScanStatus: status === 'partial' ? 'partial' : 'success',
        latestScanFailure: null,
        latestScanResult: result.scan,
        latestScanRecipe: selectedRecipe,
        selectedScanImage: responseImage,
        latestAiDebugMetadata: aiDebugMetadata,
        mealDescription: null,
        source,
        reason: 'WelcomeScreen.api_success',
      });
      markFirstOnboardingScanCompleted();
      markFirstOnboardingResultSeen();
      loadingScanSessionIdRef.current = null;
      setLoadingImageUri(null);
      transitionScreen('firstResult', 'scan_request_succeeded');
      return true;
    }

    const failureStatus = shouldRejectScan({ result, status }) ? 'rejected' : 'failed';
    const failure = {
      status: failureStatus,
      rejectionType: result.rejectionType ?? 'ai_failed',
      rejectionReason: getScanFailureReason(result),
    } satisfies LatestScanFailure;
    writeLatestScanSession({
      scanSessionId,
      latestScanStatus: failureStatus,
      latestScanFailure: failure,
      latestScanResult: null,
      latestScanRecipe: null,
      selectedScanImage: responseImage,
      latestAiDebugMetadata: aiDebugMetadata,
      mealDescription: null,
      source,
      reason: 'WelcomeScreen.api_failure',
    });
    return false;
  };

  const showPaywall = () => {
    markPaywallShown();
    transitionScreen('paywall', 'first_result_continue');
  };

  // Real purchase path: only reachable when purchasesAvailable is true (never
  // in this build). Premium is only ever granted after a confirmed provider
  // entitlement — never optimistically, and never on cancel/error.
  const requestPurchase = (_plan: 'annual' | 'weekly') => {
    if (!purchasesAvailable) {
      return;
    }
    // No purchase provider is wired into this build, so there is nothing to
    // call here yet. When one is connected, this becomes: start the native
    // purchase flow, and only on a confirmed successful entitlement call
    // setPremium(true) and completeOnboarding() — cancellation or an error
    // must leave the user non-premium with onboarding still in progress.
  };

  const restorePurchases = () => {
    Alert.alert(
      'Purchases aren’t active yet',
      'Restore Purchases is not connected in this build, so Okyo could not confirm an entitlement.',
    );
  };

  // Honest fallback when no purchase provider is connected: complete
  // onboarding, persist that completion, and continue as a non-premium user.
  // Never grants premium, never charges, never claims a trial started.
  const continueWithoutPurchase = () => {
    track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'WelcomeScreen', premium: false });
    setPremium(false);
    completeOnboarding();
  };

  // ── Screen rendering ────────────────────────────────────────────────────────

  if (screenKey === 'splash') {
    return <SplashScreen opacity={splashOpacity} />;
  }

  if (screenKey === 'hero') {
    return <OnboardingHeroScreen onContinue={advance} progress={progress} />;
  }

  if (screenKey === 'loading') {
    return (
      <OnboardingLoadingScreen
        hasValidatedRecipe={Boolean(latestScanRecipe) && activeScanStatus === 'success'}
        progress={progress}
        scanSessionId={activeScanSessionId}
        scanStatus={activeScanStatus}
        userImageUri={loadingImageUri ?? selectedScanImage?.uri}
      />
    );
  }

  if (screenKey === 'firstResult' && resultRecipe && selectedScanImage?.uri) {
    return (
      <OnboardingFirstResultScreen
        imageUri={selectedScanImage.uri}
        recipeTitle={getFirstResultTitle(latestScanResult?.dishName, resultRecipe.title)}
        recipe={resultRecipe}
        onContinue={showPaywall}
      />
    );
  }

  if (screenKey === 'firstResult') {
    const fallbackScreen = getOnboardingResultFallbackScreen();
    return (
      <OnboardingScreenShell
        canGoBack={false}
        footer={getFooter(fallbackScreen, {
          selectedWeeklyGoal,
          onCommitWeeklyGoal: commitWeeklyGoal,
          onRemindMe: remindMe,
          onSkipReminder: skipReminder,
        })}
        progress={progress}
      >
        <ScanIntroScreen
          errorMessage="Okyo could not load that recipe result. Choose the photo again to retry."
          isSubmitting={isScanSubmitting}
          onTakePhoto={takePhoto}
          onUpload={uploadFromPhotos}
        />
      </OnboardingScreenShell>
    );
  }

  if (screenKey === 'paywall') {
    return (
      <OnboardingPaywallScreen
        onContinueWithoutPurchase={continueWithoutPurchase}
        onPurchase={requestPurchase}
        onRestore={restorePurchases}
        purchasesAvailable={purchasesAvailable}
      />
    );
  }

  return (
    <OnboardingScreenShell
      canGoBack={progressSteps.indexOf(screenKey) > 0}
      footer={getFooter(screenKey, {
        selectedWeeklyGoal,
        onCommitWeeklyGoal: commitWeeklyGoal,
        onRemindMe: remindMe,
        onSkipReminder: skipReminder,
      })}
      onBack={goBack}
      progress={progress}
    >
      {screenKey === 'weeklyGoal' ? (
        <WeeklyGoalScreen
          selectedId={selectedWeeklyGoal}
          onSelect={setSelectedWeeklyGoal}
        />
      ) : null}

      {screenKey === 'reminder' ? <ReminderScreen /> : null}

      {screenKey === 'scan' ? (
        <ScanIntroScreen
          errorMessage={scanError}
          isSubmitting={isScanSubmitting}
          onTakePhoto={takePhoto}
          onUpload={uploadFromPhotos}
        />
      ) : null}
    </OnboardingScreenShell>
  );
}

// ── Splash ────────────────────────────────────────────────────────────────────

function SplashScreen({ opacity }: { opacity: Animated.Value }) {
  return (
    <View style={styles.splash}>
      <Animated.View
        style={[
          styles.splashContent,
          {
            opacity,
            transform: [
              {
                scale: opacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.splashMascot}>
          <KikoMascot pose="happy" size={150} />
        </View>
        <Text style={styles.splashWordmark}>okyo</Text>
        <Text style={styles.splashTagline}>Turn any meal into a recipe.</Text>
      </Animated.View>
    </View>
  );
}

// ── Weekly goal ───────────────────────────────────────────────────────────────

function WeeklyGoalScreen({
  onSelect,
  selectedId,
}: {
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <View style={styles.screenBlock}>
      <KikoSpeechBubble
        pose="recipeCard"
        text="What's your weekly cooking goal?"
        typed={!selectedId}
      />
      <View style={styles.goalOptionList}>
        {weeklyGoalOptions.map((option, index) => (
          <WeeklyGoalCard
            key={option.id}
            delay={index * 75}
            option={option}
            selected={selectedId === option.id}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

function WeeklyGoalCard({
  delay = 0,
  onPress,
  option,
  selected,
}: {
  delay?: number;
  onPress: () => void;
  option: WeeklyGoalOption;
  selected: boolean;
}) {
  const intro = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    intro.setValue(0);
    Animated.timing(intro, {
      delay,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [delay, intro]);

  const pressIn = () => Animated.spring(scale, { toValue: 0.975, damping: 18, mass: 0.6, stiffness: 280, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, damping: 18, mass: 0.6, stiffness: 280, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        opacity: intro,
        transform: [
          { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.goalCard, selected ? styles.goalCardSelected : null]}
      >
        <Text style={[styles.goalFrequency, selected ? styles.goalFrequencySelected : null]}>
          {option.frequency}
        </Text>
        <Text style={[styles.goalLabel, selected ? styles.goalLabelSelected : null]}>
          {option.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Reminder ──────────────────────────────────────────────────────────────────

function ReminderScreen() {
  return (
    <View style={styles.screenBlock}>
      <KikoSpeechBubble
        pose="happy"
        text="I'll remind you to cook so it becomes a habit!"
        typed
      />
      <IOSPermissionDialog />
      <View style={styles.notifArrowWrap}>
        <Text style={styles.notifArrow}>↑</Text>
      </View>
    </View>
  );
}

function IOSPermissionDialog() {
  return (
    <View style={styles.iosDialog}>
      <Text style={styles.iosDialogTitle}>Okyo Would Like to Send You Notifications</Text>
      <Text style={styles.iosDialogBody}>
        Notifications may include recipe reminders, savings alerts, and grocery nudges. These can be configured in Settings.
      </Text>
      <View style={styles.iosDialogDivider} />
      <View style={styles.iosDialogButtons}>
        <Text style={styles.iosDialogButton}>Don't Allow</Text>
        <View style={styles.iosDialogButtonDivider} />
        <Text style={[styles.iosDialogButton, styles.iosDialogButtonAllow]}>Allow</Text>
      </View>
    </View>
  );
}

// ── Scan intro ────────────────────────────────────────────────────────────────

function ScanIntroScreen({
  errorMessage,
  isSubmitting,
  onTakePhoto,
  onUpload,
}: {
  errorMessage: string | null;
  isSubmitting: boolean;
  onTakePhoto: () => void;
  onUpload: () => void;
}) {
  return (
    <View style={styles.screenBlock}>
      <KikoSpeechBubble
        pose="scanning"
        text="Now show me what you're craving."
      />
      <OnboardingScanCard
        errorMessage={errorMessage}
        onTakePhoto={isSubmitting ? noop : onTakePhoto}
        onUpload={isSubmitting ? noop : onUpload}
      />
    </View>
  );
}

// ── Footer factory ────────────────────────────────────────────────────────────

function getFooter(
  screenKey: OnboardingScreenKey,
  context: {
    selectedWeeklyGoal: string | null;
    onCommitWeeklyGoal: () => void;
    onRemindMe: () => void;
    onSkipReminder: () => void;
  },
) {
  if (screenKey === 'weeklyGoal') {
    return (
      <OnboardingStatefulButton
        disabled={!context.selectedWeeklyGoal}
        label="I'm committed"
        onPress={context.onCommitWeeklyGoal}
      />
    );
  }

  if (screenKey === 'reminder') {
    return (
      <View style={styles.reminderFooter}>
        <OnboardingStatefulButton
          label="Remind me to cook"
          onPress={context.onRemindMe}
        />
        <Pressable
          accessibilityRole="button"
          onPress={context.onSkipReminder}
          style={styles.skipLink}
        >
          <Text style={styles.skipLinkText}>Maybe later</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function getScanRecipes(result: CreateScanResult) {
  if (Array.isArray(result.recipes) && result.recipes.length > 0) {
    return result.recipes;
  }

  return result.recipe ? [result.recipe] : [];
}

function getScanRecipeForMode(
  recipes: Recipe[],
  mode: RecipeMode,
  fallbackRecipe: Recipe | null | undefined = null,
) {
  return recipes.find((recipe) => recipe.mode === mode) ?? fallbackRecipe ?? recipes[0] ?? null;
}

function getAiDebugMetadata(result: CreateScanResult): AiDebugMetadata | null {
  if (!result.aiSource) {
    return null;
  }

  return {
    aiSource: result.aiSource,
    aiProvider: result.aiProvider,
    confidence: result.confidence,
    fallbackReason: result.fallbackReason,
    recipeModel: result.recipeModel,
    visionModel: result.visionModel,
  };
}

async function getImageMetadata(asset: ImagePicker.ImagePickerAsset, source: ScanSource): Promise<ScanImageMetadata> {
  imageTraceLog('WelcomeScreen', { stage: 'original_uri', source, uri: asset.uri });
  const originalExists = await checkImageFileExists(asset.uri);
  imageTraceLog('WelcomeScreen', { stage: 'original_file_existence_result', source, uri: asset.uri, exists: originalExists });
  imageTraceLog('WelcomeScreen', { stage: 'image_processing_started', source, uri: asset.uri });
  const processed = await getProcessedImage(asset);
  const processedUri = getOnboardingUploadUri(processed.uri, asset.uri);
  const processedExists = await checkImageFileExists(processedUri);
  imageTraceLog('WelcomeScreen', { stage: 'processed_uri', source, uri: processedUri, exists: processedExists, conversionError: processed.conversionError });
  if (!processed.uri || processed.conversionError === 'image_processing_failed') {
    throw new OnboardingImageUnavailableError();
  }
  const dataUrl = getImageDataUrl(processed.base64, processed.mimeType);
  const dataUrlSizeBytes = dataUrl ? dataUrl.length : undefined;
  const shouldSendDataUrl = Boolean(dataUrl && dataUrlSizeBytes !== undefined && dataUrlSizeBytes <= maxImageDataUrlBytes);

  return {
    fileName: getProcessedFileName(asset.fileName),
    height: processed.height ?? asset.height,
    mimeType: processed.mimeType,
    placeholder: false,
    sizeBytes: asset.fileSize ?? undefined,
    dataUrl: shouldSendDataUrl ? dataUrl : undefined,
    dataUrlSizeBytes,
    source,
    uri: processedUri,
    width: processed.width ?? asset.width,
    conversionError: shouldSendDataUrl
      ? undefined
      : dataUrl
        ? 'image_payload_too_large'
        : processed.conversionError ?? 'image_base64_missing',
  };
}

async function getProcessedImage(asset: ImagePicker.ImagePickerAsset) {
  const attempts = [
    { compress: 0.78, maxWidth: maxProcessedImageWidth },
    { compress: 0.64, maxWidth: 1200 },
    { compress: 0.52, maxWidth: 1000 },
    { compress: 0.42, maxWidth: 850 },
    { compress: 0.34, maxWidth: 720 },
    { compress: 0.28, maxWidth: 600 },
  ];
  let latestResult: {
    base64?: string;
    height?: number;
    mimeType: string;
    uri?: string;
    width?: number;
    conversionError?: string;
  } | null = null;

  for (const attempt of attempts) {
    try {
      const actions: ImageManipulator.Action[] = asset.width > attempt.maxWidth
        ? [{ resize: { width: attempt.maxWidth } }]
        : [];
      const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        base64: true,
        compress: attempt.compress,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const dataUrl = getImageDataUrl(result.base64, 'image/jpeg');
      const dataUrlSizeBytes = dataUrl ? dataUrl.length : undefined;

      latestResult = {
        base64: result.base64 ?? undefined,
        height: result.height,
        mimeType: 'image/jpeg',
        uri: result.uri,
        width: result.width,
        conversionError: dataUrl ? undefined : 'image_base64_missing',
      };

      if (dataUrl && dataUrlSizeBytes !== undefined && dataUrlSizeBytes <= maxImageDataUrlBytes) {
        return latestResult;
      }
    } catch (error) {
      imageTraceLog('WelcomeScreen', { stage: 'image_processing_attempt_failed', error: serializeError(error), maxWidth: attempt.maxWidth, compress: attempt.compress });
      latestResult = {
        height: asset.height,
        mimeType: asset.mimeType ?? getMimeTypeFromFileName(asset.fileName) ?? 'image/jpeg',
        uri: asset.uri,
        width: asset.width,
        conversionError: 'image_processing_failed',
      };
    }
  }

  return latestResult ?? {
    height: asset.height,
    mimeType: asset.mimeType ?? getMimeTypeFromFileName(asset.fileName) ?? 'image/jpeg',
    uri: asset.uri,
    width: asset.width,
    conversionError: 'image_processing_failed',
  };
}

function getProcessedFileName(fileName: string | null | undefined) {
  if (!fileName) {
    return 'okyo-scan-upload.jpg';
  }

  return fileName.replace(/\.[a-z0-9]+$/i, '.jpg') || 'okyo-scan-upload.jpg';
}

function getImageDataUrl(base64: string | null | undefined, mimeType: string) {
  const cleanBase64 = typeof base64 === 'string' ? base64.trim() : '';
  if (!cleanBase64) {
    return undefined;
  }

  return `data:${mimeType};base64,${cleanBase64}`;
}

function getMimeTypeFromFileName(fileName: string | null | undefined) {
  const normalized = fileName?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function getPreviewImageMetadata(image: ScanImageMetadata | undefined): ScanImageMetadata | null {
  if (!image) {
    return null;
  }

  const { dataUrl: _dataUrl, ...previewImage } = image;
  return previewImage;
}

function getAssetLogSummary(asset: ImagePicker.ImagePickerAsset) {
  return { uri: asset.uri, width: asset.width, height: asset.height, mimeType: asset.mimeType, fileName: asset.fileName, fileSize: asset.fileSize };
}

function serializeError(error: unknown) {
  return { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
}

function getScanFailureReason(result: CreateScanResult) {
  if (
    result.fallbackReason === 'image_not_available_to_ai' ||
    result.image?.conversionError === 'image_payload_too_large' ||
    result.rejectionReason?.toLowerCase().includes('too large')
  ) {
    return 'This photo was too large to scan. Try a smaller image.';
  }
  if (result.rejectionReason) {
    return result.rejectionReason;
  }
  if (result.rejectionType === 'not_food' || shouldRejectScan({ result })) {
    return "This doesn't look like food or drink yet. Try a clearer meal photo.";
  }
  if (result.rejectionType === 'unclear_image' || !hasFoodEvidence({ result })) {
    return 'Try a brighter, clearer photo with the meal centered.';
  }

  return 'Okyo found something, but could not build a clear recipe yet. Try one more photo.';
}

function getUploadFailureReasonFromError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('too large')) {
    return 'This photo was too large to scan. Try a smaller image.';
  }
  if (
    message.includes('network') ||
    message.includes('abort') ||
    message.includes('fetch') ||
    message.includes('failed to fetch')
  ) {
    return 'Okyo could not reach the scanner. Check the API server and try again.';
  }

  return 'Okyo had trouble scanning this photo. Try again in a second.';
}

function getFirstResultTitle(dishName: string | undefined, recipeTitle: string) {
  if (dishName?.trim()) {
    return dishName.trim();
  }

  return recipeTitle;
}

function hasCompleteOnboardingRecipe(recipe: Recipe | null | undefined) {
  return Boolean(
    recipe?.title?.trim() &&
    recipe.description?.trim() &&
    Array.isArray(recipe.ingredients) &&
    recipe.ingredients.length > 0 &&
    recipe.ingredients.every((ingredient) => ingredient.name?.trim() && ingredient.quantity?.trim()) &&
    Array.isArray(recipe.steps) &&
    recipe.steps.length > 0 &&
    recipe.steps.every((step) => step?.trim()),
  );
}

function createScanSessionId(source: ScanSource) {
  return `onboarding-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveScanSession(scanSessionId: string) {
  return isCurrentOnboardingScanSession(useOkyoStore.getState().scanSessionId, scanSessionId);
}

function noop() {
  // Keeps scan actions inert while a scan request is already in flight.
}

class OnboardingImageUnavailableError extends Error {
  constructor() {
    super(getMissingOnboardingImageError());
    this.name = 'OnboardingImageUnavailableError';
  }
}

function isOnboardingImageUnavailableError(error: unknown) {
  return error instanceof OnboardingImageUnavailableError;
}

function getOnboardingImageErrorMessage(error: unknown, fallback: string) {
  return isOnboardingImageUnavailableError(error)
    ? getMissingOnboardingImageError()
    : error instanceof Error
      ? error.message
      : fallback;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    backgroundColor: onboardingColors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  splashContent: {
    alignItems: 'center',
  },
  splashMascot: {
    alignItems: 'center',
    backgroundColor: onboardingColors.primarySoft,
    borderColor: 'rgba(255,139,174,0.28)',
    borderWidth: 1,
    borderRadius: 44,
    height: 190,
    justifyContent: 'center',
    width: 190,
    ...shadows.hero,
  },
  splashWordmark: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 58,
    fontWeight: '800',
    letterSpacing: -1.16,
    lineHeight: 64,
    marginTop: 22,
    textTransform: 'lowercase',
  },
  splashTagline: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.36,
    marginTop: 8,
    textAlign: 'center',
  },
  screenBlock: {
    flex: 1,
  },
  // Weekly goal cards
  goalOptionList: {
    gap: 12,
  },
  goalCard: {
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderColor: onboardingColors.border,
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 22,
    paddingVertical: 18,
    ...shadows.card,
  },
  goalCardSelected: {
    backgroundColor: onboardingColors.primarySoft,
    borderColor: onboardingColors.primary,
  },
  goalFrequency: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  goalFrequencySelected: {
    color: onboardingColors.primary,
  },
  goalLabel: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 15,
  },
  goalLabelSelected: {
    color: onboardingColors.primary,
  },
  // Reminder — iOS permission dialog
  iosDialog: {
    backgroundColor: onboardingColors.card,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.softCharcoal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  iosDialogTitle: {
    color: onboardingColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
    marginTop: 22,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  iosDialogBody: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    opacity: 0.6,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  iosDialogDivider: {
    backgroundColor: 'rgba(199,179,255,0.32)',
    height: StyleSheet.hairlineWidth,
  },
  iosDialogButtons: {
    flexDirection: 'row',
  },
  iosDialogButtonDivider: {
    backgroundColor: 'rgba(199,179,255,0.32)',
    width: StyleSheet.hairlineWidth,
  },
  iosDialogButton: {
    color: onboardingColors.sky,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: 14,
    textAlign: 'center',
  },
  iosDialogButtonAllow: {
    fontFamily: fontFamilies.extraBold,
    fontWeight: '700',
  },
  notifArrowWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  notifArrow: {
    color: onboardingColors.primary,
    fontFamily: fontFamilies.extraBold,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  // Reminder footer
  reminderFooter: {
    gap: 6,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipLinkText: {
    color: onboardingColors.gray,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
  },
});
