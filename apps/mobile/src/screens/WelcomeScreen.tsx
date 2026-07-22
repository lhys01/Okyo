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
import { fontFamilies, shadows } from '../theme/okyoTheme';
import { scheduleOkyoDailyReminder } from '../utils/notifications';
import { hasFoodEvidence, isUsableScan, shouldRejectScan } from '../utils/scanDecision';
import { copyToDocuments } from '../utils/scanImageStorage';
import { uiLog } from '../utils/uiDebug';

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
  const [selectedWeeklyGoal, setSelectedWeeklyGoal] = useState<string | null>(null);
  const didTrackStart = useRef(false);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const completeOnboarding = useOkyoStore((state) => state.completeOnboarding);
  const beginLatestScanSession = useOkyoStore((state) => state.beginLatestScanSession);
  const writeLatestScanSession = useOkyoStore((state) => state.writeLatestScanSession);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const setWeeklyGoal = useOkyoStore((state) => state.setWeeklyGoal);
  const notificationChoice = useOkyoStore((state) => state.notificationChoice);
  const setNotificationChoice = useOkyoStore((state) => state.setNotificationChoice);
  const markFirstOnboardingScanCompleted = useOkyoStore((state) => state.markFirstOnboardingScanCompleted);
  const markFirstOnboardingResultSeen = useOkyoStore((state) => state.markFirstOnboardingResultSeen);
  const markPaywallShown = useOkyoStore((state) => state.markPaywallShown);
  const resultRecipe = latestScanRecipe;

  useEffect(() => {
    if (didTrackStart.current) {
      return;
    }

    didTrackStart.current = true;
    uiLog('WelcomeScreen', 'enter_onboarding_flow');
    track(analyticsEvents.ONBOARDING_START, { screen: 'WelcomeScreen' });
  }, []);

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
      setScreenKey('hero');
    });
  }, [screenKey, splashOpacity]);

  // Auto-advance from the "Building Your Plan" loading screen to scan after 2.5s
  useEffect(() => {
    if (screenKey !== 'loading' || selectedScanImage?.uri) {
      return;
    }

    const timer = setTimeout(() => {
      setScreenKey('scan');
    }, 2500);

    return () => clearTimeout(timer);
  }, [screenKey, selectedScanImage?.uri]);

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
      setScreenKey('reminder');
      return;
    }

    setScreenKey(progressSteps[currentIndex - 1]);
  };

  const advance = () => {
    const currentIndex = progressSteps.indexOf(screenKey);
    if (currentIndex >= 0 && currentIndex < progressSteps.length - 1) {
      setScreenKey(progressSteps[currentIndex + 1]);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      await startOnboardingScan('camera', await getImageMetadata(result.assets[0], 'camera'));
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Camera unavailable.',
        screen: 'WelcomeScreen',
        source: 'camera',
      });
      Alert.alert('Camera unavailable', 'Use Upload from Photos instead.');
    }
  };

  const uploadFromPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      await startOnboardingScan('photos', await getImageMetadata(result.assets[0], 'photos'));
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Image picker failed.',
        screen: 'WelcomeScreen',
        source: 'photos',
      });
      Alert.alert('Photo upload unavailable', 'Okyo could not open your photo library. Try again.');
    }
  };

  const startOnboardingScan = async (source: ScanSource, image?: ScanImageMetadata) => {
    if (isScanSubmitting) {
      return;
    }

    const scanSessionId = createScanSessionId(source);
    const persistedImage = (image && !image.placeholder) ? await copyToDocuments(image) : image;
    const previewImage = getPreviewImageMetadata(persistedImage);
    setIsScanSubmitting(true);
    setScanError(null);
    setScreenKey('loading');
    track(analyticsEvents.SCAN_STARTED, { screen: 'WelcomeScreen', source });
    beginLatestScanSession({
      scanSessionId,
      latestScanStatus: 'pending',
      latestScanFailure: null,
      latestScanResult: null,
      latestScanRecipe: null,
      selectedScanImage: previewImage,
      latestAiDebugMetadata: null,
      source,
      reason: 'WelcomeScreen.startOnboardingScan',
    });

    try {
      const result = await createMockScan({ image, mode: selectedMode, source });
      if (!isActiveScanSession(scanSessionId)) {
        return;
      }

      const handled = handleScanResult({
        fallbackImage: persistedImage,
        result,
        scanSessionId,
        source,
      });

      if (!handled) {
        setScreenKey('scan');
        setScanError(getScanFailureReason(result));
      }
    } catch (error) {
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
        source,
        reason: 'WelcomeScreen.api_error',
      });
      setScreenKey('scan');
      setScanError(failureReason);
    } finally {
      setIsScanSubmitting(false);
    }
  };

  const handleScanResult = ({
    fallbackImage,
    result,
    scanSessionId,
    source,
  }: {
    fallbackImage?: ScanImageMetadata;
    result: CreateScanResult;
    scanSessionId: string;
    source: ScanSource;
  }) => {
    const status = result.status ?? 'success';
    const recipes = getScanRecipes(result);
    const selectedRecipe = getScanRecipeForMode(recipes, selectedMode, result.recipe);
    const responseImage = getPreviewImageMetadata(result.image ?? fallbackImage);
    const aiDebugMetadata = getAiDebugMetadata(result);
    const canRevealResult = Boolean(
      result.scan &&
      selectedRecipe &&
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
        source,
        reason: 'WelcomeScreen.api_success',
      });
      markFirstOnboardingScanCompleted();
      markFirstOnboardingResultSeen();
      setScreenKey('firstResult');
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
      source,
      reason: 'WelcomeScreen.api_failure',
    });
    return false;
  };

  const showPaywall = () => {
    markPaywallShown();
    setScreenKey('paywall');
  };

  const finishOnboarding = () => {
    markPaywallShown();
    track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'WelcomeScreen' });
    completeOnboarding();
    if (notificationChoice === 'remind_me') {
      scheduleOkyoDailyReminder();
    }
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
        progress={progress}
        userImageUri={selectedScanImage?.uri}
      />
    );
  }

  if (screenKey === 'firstResult' && resultRecipe) {
    return (
      <OnboardingFirstResultScreen
        confidence={latestScanResult?.confidence}
        difficulty={resultRecipe.difficulty}
        imageStatus={resultRecipe.imageStatus}
        imageUri={selectedScanImage?.uri}
        imageUrl={resultRecipe.imageUrl}
        recipeDescription={resultRecipe.description}
        recipeTitle={getFirstResultTitle(latestScanResult?.dishName, resultRecipe.title)}
        savingsText={getSavingsText(latestScanResult, resultRecipe)}
        timeText={getTimeText(resultRecipe)}
        onContinue={showPaywall}
      />
    );
  }

  if (screenKey === 'paywall') {
    return (
      <OnboardingPaywallScreen
        onContinue={finishOnboarding}
        onRestore={() => Alert.alert('Restore Purchases', 'Purchases are not active in this build yet.')}
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
        text="Now show me what you're craving 👀"
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
  const processed = await getProcessedImage(asset);
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
    uri: processed.uri ?? asset.uri,
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
    } catch (_error) {
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

function getSavingsText(scanResult: { estimatedSavings: number; restaurantPrice: number } | null, recipe: Recipe) {
  const estimatedSavings = scanResult?.estimatedSavings ?? recipe.estimatedSavings;
  const restaurantPrice = scanResult?.restaurantPrice ?? 0;

  if (restaurantPrice > 0 && estimatedSavings > 0) {
    return `$${estimatedSavings.toFixed(2)}`;
  }

  return `$${recipe.estimatedHomemadeCost.toFixed(2)}`;
}

function getTimeText(recipe: Recipe) {
  const totalTime = recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  return `${totalTime} min`;
}

function createScanSessionId(source: ScanSource) {
  return `onboarding-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveScanSession(scanSessionId: string) {
  return useOkyoStore.getState().scanSessionId === scanSessionId;
}

function noop() {
  // Keeps scan actions inert while a scan request is already in flight.
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    backgroundColor: onboardingColors.primary,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  splashContent: {
    alignItems: 'center',
  },
  splashMascot: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderRadius: 44,
    height: 190,
    justifyContent: 'center',
    width: 190,
    ...shadows.hero,
  },
  splashWordmark: {
    color: '#fffdf8',
    fontFamily: fontFamilies.display,
    fontSize: 58,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 64,
    marginTop: 22,
    textTransform: 'lowercase',
  },
  splashTagline: {
    color: '#fff3eb',
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '700',
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
    backgroundColor: '#FFF0E6',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  iosDialogTitle: {
    color: '#1C1C1E',
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
    color: '#3C3C43',
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    opacity: 0.6,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  iosDialogDivider: {
    backgroundColor: 'rgba(60,60,67,0.29)',
    height: StyleSheet.hairlineWidth,
  },
  iosDialogButtons: {
    flexDirection: 'row',
  },
  iosDialogButtonDivider: {
    backgroundColor: 'rgba(60,60,67,0.29)',
    width: StyleSheet.hairlineWidth,
  },
  iosDialogButton: {
    color: '#007AFF',
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
