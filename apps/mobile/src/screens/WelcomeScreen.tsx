import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { createScan } from '../api/client';
import { OKYO_MAX_SCAN_IMAGE_DATA_URL_BYTES } from '../api/config';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import {
  KikoSpeechBubble,
  OnboardingFirstResultScreen,
  OnboardingHeroScreen,
  OnboardingLoadingScreen,
  OnboardingScanCard,
  OnboardingScreenShell,
  onboardingColors,
} from '../components/onboarding/OnboardingUI';
import { KikoMascot } from '../components/KikoMascot';
import {
  getSafeRecipeMode,
  type Recipe,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import {
  useOkyoStore,
  type LatestScanFailure,
} from '../state/useOkyoStore';
import { colors, fontFamilies, shadows } from '../theme/okyoTheme';
import { hasFoodEvidence, isUsableScan, shouldRejectScan } from '../utils/scanDecision';
import {
  logMobileScreenReveal,
  markMobileScanStarted,
  measureMobileScanStage,
} from '../utils/scanTelemetry';
import { uiLog } from '../utils/uiDebug';

type WelcomeNavigation = NativeStackNavigationProp<RootStackParamList, 'WelcomeScreen'>;

type OnboardingScreenKey =
  | 'splash'
  | 'hero'
  | 'scan'
  | 'loading'
  | 'firstResult';

const maxProcessedImageWidth = 1400;

const progressSteps: OnboardingScreenKey[] = [
  'hero',
  'scan',
  'loading',
  'firstResult',
];

export function WelcomeScreen() {
  const navigation = useNavigation<WelcomeNavigation>();
  const [screenKey, setScreenKey] = useState<OnboardingScreenKey>('splash');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanSubmitting, setIsScanSubmitting] = useState(false);
  const didTrackStart = useRef(false);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const scanSessionId = useOkyoStore((state) => state.scanSessionId);
  const completeOnboarding = useOkyoStore((state) => state.completeOnboarding);
  const beginLatestScanSession = useOkyoStore((state) => state.beginLatestScanSession);
  const writeLatestScanSession = useOkyoStore((state) => state.writeLatestScanSession);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
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
    if (screenKey === 'firstResult') {
      logMobileScreenReveal(scanSessionId);
    }
  }, [scanSessionId, screenKey]);

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

  const progress = useMemo(() => {
    const index = progressSteps.indexOf(screenKey);
    if (index < 0) {
      return 0.05;
    }

    return (index + 1) / progressSteps.length;
  }, [screenKey]);

  const goBack = () => {
    const currentIndex = progressSteps.indexOf(screenKey);
    if (currentIndex <= 0 || screenKey === 'loading' || screenKey === 'firstResult') {
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

      const requestId = createScanSessionId('camera');
      markMobileScanStarted(requestId);
      const image = await measureMobileScanStage(
        requestId,
        'image_preparation',
        () => getImageMetadata(result.assets[0], 'camera'),
      );
      await startOnboardingScan('camera', requestId, image);
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

      const requestId = createScanSessionId('photos');
      markMobileScanStarted(requestId);
      const image = await measureMobileScanStage(
        requestId,
        'image_preparation',
        () => getImageMetadata(result.assets[0], 'photos'),
      );
      await startOnboardingScan('photos', requestId, image);
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Image picker failed.',
        screen: 'WelcomeScreen',
        source: 'photos',
      });
      Alert.alert('Photo upload unavailable', 'Okyo could not open your photo library. Try again.');
    }
  };

  const startOnboardingScan = async (
    source: ScanSource,
    requestId: string,
    image?: ScanImageMetadata,
  ) => {
    if (isScanSubmitting) {
      return;
    }

    const scanSessionId = requestId;
    const previewImage = getPreviewImageMetadata(image);
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
      const result = await createScan({ requestId, image, mode: selectedMode, source });
      if (!isActiveScanSession(scanSessionId)) {
        return;
      }

      const handled = handleScanResult({
        fallbackImage: image,
        result,
        scanSessionId,
        source,
      });

      if (!handled) {
        setScreenKey('scan');
        setScanError(getScanFailureReason(result));
        logMobileScreenReveal(scanSessionId);
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
      logMobileScreenReveal(scanSessionId);
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

  const finishOnboarding = () => {
    track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'WelcomeScreen' });
    completeOnboarding();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            params: latestScanRecipe
              ? { screen: 'RecipeDetailScreen', params: { mode: getSafeRecipeMode(latestScanRecipe.mode) } }
              : { screen: 'ScanScreen' },
          },
        ],
      }),
    );
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
        progress={progress}
        recipeDescription={resultRecipe.description}
        recipeTitle={getFirstResultTitle(latestScanResult?.dishName, resultRecipe.title)}
        savingsText={getSavingsText(latestScanResult, resultRecipe)}
        timeText={getTimeText(resultRecipe)}
        onContinue={finishOnboarding}
      />
    );
  }

  return (
    <OnboardingScreenShell
      canGoBack={progressSteps.indexOf(screenKey) > 0}
      onBack={goBack}
      progress={progress}
    >
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
  const shouldSendDataUrl = Boolean(
    dataUrl &&
    dataUrlSizeBytes !== undefined &&
    dataUrlSizeBytes <= OKYO_MAX_SCAN_IMAGE_DATA_URL_BYTES
  );

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

      if (
        dataUrl &&
        dataUrlSizeBytes !== undefined &&
        dataUrlSizeBytes <= OKYO_MAX_SCAN_IMAGE_DATA_URL_BYTES
      ) {
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
    backgroundColor: colors.onCoral,
    borderRadius: 44,
    height: 190,
    justifyContent: 'center',
    width: 190,
    ...shadows.hero,
  },
  splashWordmark: {
    color: colors.onCoral,
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
});
