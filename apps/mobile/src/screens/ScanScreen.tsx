import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  Book,
  CameraSolid,
  Cart,
  Dollar,
  NavArrowRight,
  OpenBook,
  Sparks,
  Upload,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import { KikoMascot } from '../components/KikoMascot';
import { colors } from '../components/OkyoUI';
import { defaultScanResult, getSafeRecipeForMode, getSafeRecipeMode, type Recipe, type RecipeMode } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore, type LatestScanFailure } from '../state/useOkyoStore';
import { hasFoodEvidence, isFoodScanState, isUsableScan, shouldRejectScan } from '../utils/scanDecision';
import { uiLog } from '../utils/uiDebug';

type ScanNavigation = NativeStackNavigationProp<RootStackParamList, 'ScanScreen'>;

const maxImageDataUrlBytes = 12_000_000;
const maxProcessedImageWidth = 1400;
const tabBarSafePadding = 260;

export function ScanScreen() {
  const navigation = useNavigation<ScanNavigation>();
  const insets = useSafeAreaInsets();
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const beginLatestScanSession = useOkyoStore((state) => state.beginLatestScanSession);
  const writeLatestScanSession = useOkyoStore((state) => state.writeLatestScanSession);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);

  const startScan = (source: ScanSource, image?: ScanImageMetadata) => {
    const uploadedImage = isRealUploadedImage(source, image);
    const scanSessionId = createScanSessionId(source);
    const previewImage = getPreviewImageMetadata(image);
    logDev('okyo_scan_start', {
      hasImage: Boolean(image),
      mode: selectedMode,
      scanSessionId,
      source: getPublicScanSource(source),
      timestamp: new Date().toISOString(),
      uploadedImage,
    });
    uiLog('ScanScreen', 'scan_started', { source, hasImage: Boolean(image?.uri), placeholder: image?.placeholder, uploadedImage });
    logSelectedImage(source, image);
    track(analyticsEvents.SCAN_STARTED, { screen: 'ScanScreen', source });
    track(analyticsEvents.PHOTO_UPLOADED, { screen: 'ScanScreen', source });
    beginLatestScanSession({
      scanSessionId,
      latestScanStatus: 'pending',
      latestScanFailure: null,
      latestScanResult: null,
      latestScanRecipes: [],
      latestScanRecipe: null,
      selectedScanImage: previewImage,
      latestAiDebugMetadata: null,
      source,
      reason: 'ScanScreen.startScan',
    });
    navigation.navigate('AnalysisLoadingScreen', { scanSessionId });

    createMockScan({ image, mode: selectedMode, source })
      .then((result) => {
        if (!isActiveScanSession(scanSessionId)) {
          logIgnoredScanSessionWrite(scanSessionId, 'ScanScreen.api_response_stale');
          return;
        }

        const status = result.status ?? 'success';
        const responseImage = getPreviewImageMetadata(result.image ?? image);
        const aiDebugMetadata = getAiDebugMetadata(result);
        logScanResponse(result, image);
        const foodEvidence = hasFoodEvidence({ result, status });
        const initialRecipes = getScanRecipes(result);
        const scanRecipes = result.scan && foodEvidence && initialRecipes.length === 0
          ? createStarterRecipesFromScan(result.scan)
          : initialRecipes;
        const shouldUseSuccessPath = Boolean(
          result.scan &&
          isUsableScan({
            recipes: scanRecipes,
            result,
            scan: result.scan,
            status,
          }),
        );
        if (shouldUseSuccessPath && result.scan) {
          const selectedRecipe = getScanRecipeForMode(scanRecipes, selectedMode, result.recipe);
          const storedStatus = selectedRecipe || foodEvidence ? 'success' : status;
          writeLatestScanSession({
            scanSessionId,
            latestScanStatus: storedStatus,
            latestScanFailure: null,
            latestScanResult: result.scan,
            latestScanRecipes: scanRecipes,
            latestScanRecipe: selectedRecipe,
            selectedScanImage: responseImage,
            latestAiDebugMetadata: aiDebugMetadata,
            source,
            reason: 'ScanScreen.api_success',
          });
          logStoreAfterResponse(storedStatus, result.scan, selectedRecipe, scanRecipes, result.image ?? image, scanSessionId);
        } else {
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
            latestScanRecipes: [],
            latestScanRecipe: null,
            selectedScanImage: responseImage,
            latestAiDebugMetadata: aiDebugMetadata,
            source,
            reason: 'ScanScreen.api_failure',
          });
          logStoreAfterResponse(failureStatus, null, null, [], result.image ?? image, scanSessionId);
        }
        logScanRouteDecision(status, result, shouldUseSuccessPath ? 'result_success_path' : failureStatusToRoute(status, result));
        if (isActiveScanSession(scanSessionId) && (status === 'success' || status === 'partial') && result.recipe?.mode) {
          setSelectedMode(getSafeRecipeMode(result.recipe.mode));
        }
        uiLog('ScanScreen', 'api_scan_result', {
          scanId: result.scan?.id ?? result.scanId,
          source,
          status,
          rejectionType: result.rejectionType,
        });
      })
      .catch((error) => {
        if (!isActiveScanSession(scanSessionId)) {
          logIgnoredScanSessionWrite(scanSessionId, 'ScanScreen.api_error_stale');
          return;
        }

        track(analyticsEvents.RESULT_ERROR, {
          errorMessage: error instanceof Error ? error.message : 'Mock API scan failed.',
          screen: 'ScanScreen',
          source,
        });
        uiLog('ScanScreen', 'api_scan_fallback', { source });
        if (uploadedImage) {
          const failureReason = getUploadFailureReasonFromError(error);
          const failure = {
            status: 'failed',
            rejectionType: 'ai_failed',
            rejectionReason: failureReason,
          } as const;
          writeLatestScanSession({
            scanSessionId,
            latestScanStatus: 'failed',
            latestScanFailure: failure,
            latestScanResult: null,
            latestScanRecipes: [],
            latestScanRecipe: null,
            selectedScanImage: getPreviewImageMetadata(image),
            latestAiDebugMetadata: {
              aiSource: 'fallback_ai',
              fallbackReason: 'mobile_api_unavailable',
              confidence: 0,
            },
            source,
            reason: 'ScanScreen.api_error_uploaded_image',
          });
          logStoreAfterResponse('failed', null, null, [], image, scanSessionId);
        } else {
          const demoRecipes = getDemoRecipes();
          const demoRecipe = getScanRecipeForMode(demoRecipes, selectedMode);
          writeLatestScanSession({
            scanSessionId,
            latestScanStatus: 'success',
            latestScanFailure: null,
            latestScanResult: defaultScanResult,
            latestScanRecipes: demoRecipes,
            latestScanRecipe: demoRecipe,
            selectedScanImage: getPreviewImageMetadata(image),
            latestAiDebugMetadata: {
              aiSource: 'fallback_ai',
              fallbackReason: 'mobile_api_unavailable',
              confidence: defaultScanResult.confidence,
            },
            source,
            reason: 'ScanScreen.api_error_demo_fallback',
          });
          logStoreAfterResponse('success', defaultScanResult, demoRecipe, demoRecipes, image, scanSessionId);
        }
        logScanRouteDecision('failed', {
          rejectionReason: uploadedImage ? getUploadFailureReasonFromError(error) : 'Demo scan API unavailable.',
          rejectionType: 'ai_failed',
          status: 'failed',
        }, uploadedImage ? 'api_error_path' : 'result_success_path');
      });
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        uiLog('ScanScreen', 'camera_permission_denied');
        Alert.alert(
          'Camera permission needed',
          'Okyo needs camera permission to take a food photo. You can allow camera access in Settings or use Upload food photo instead.',
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
        uiLog('ScanScreen', 'camera_cancelled');
        return;
      }

      startScan('camera', await getImageMetadata(result.assets[0], 'camera'));
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Camera unavailable.',
        screen: 'ScanScreen',
        source: 'camera',
      });
      uiLog('ScanScreen', 'camera_unavailable');
      Alert.alert(
        'Camera unavailable',
        'Camera isn’t available in this simulator. Use Upload From Photos instead.',
      );
    }
  };

  const tryDemoScan = () => {
    startScan('mock', createPlaceholderImage('mock'));
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
        uiLog('ScanScreen', 'photo_picker_cancelled');
        return;
      }

      startScan('photos', await getImageMetadata(result.assets[0], 'photos'));
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Image picker failed.',
        screen: 'ScanScreen',
        source: 'photos',
      });
      uiLog('ScanScreen', 'photo_picker_error');
      Alert.alert(
        'Photo upload unavailable',
        'Okyo could not open your photo library. Try again or use the demo scan.',
      );
    }
  };

  const recentRecipe = savedRecipes.length > 0 ? savedRecipes[0] : null;

  const openRecentRecipe = () => {
    if (!recentRecipe?.id) {
      return;
    }

    const mode = getSafeRecipeMode(recentRecipe.mode);
    uiLog('ScanScreen', 'open_recent_recipe', { recipeId: recentRecipe.id });
    writeSavedRecipeContext({
      recipe: recentRecipe,
      reason: 'open_recent_recipe',
      source: 'ScanScreen.openRecentRecipe',
    });
    setSelectedMode(mode);
    navigation.navigate('RecipeDetailScreen', { mode });
  };

  const openLibrary = () => {
    navigation.navigate('MainTabs', { screen: 'LibraryScreen' });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarSafePadding + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={2}
            style={styles.headline}
          >
            What are we remaking today?
          </Text>
          <Text style={styles.subtitle}>
            Snap a restaurant meal and Okyo turns it into a homemade recipe, savings estimate, and grocery list.
          </Text>
        </View>

        <View style={styles.scanCard}>
          <View style={styles.illustrationPanel}>
            <KikoMascot pose="scanning" size={190} style={styles.scanMascot} />
          </View>

          <View style={styles.scanActions}>
            <ScanActionButton
              icon={<CameraSolid color="#fffdf8" height={25} width={25} />}
              label="Take photo"
              onPress={takePhoto}
              tone="primary"
            />
            <ScanActionButton
              icon={<Upload color={colors.coral} height={24} strokeWidth={2.3} width={24} />}
              label="Upload food photo"
              onPress={uploadFromPhotos}
            />
            <ScanActionButton
              icon={<Sparks color={colors.coral} height={25} strokeWidth={2.15} width={25} />}
              label="Try demo scan"
              onPress={tryDemoScan}
            />
          </View>
        </View>

        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How Okyo works</Text>
          <View style={styles.howCard}>
            <HowStep
              caption="Snap the dish"
              icon={<CameraSolid color={colors.coral} height={24} width={24} />}
              label="Scan"
            />
            <NavArrowRight color={colors.creamDeep} height={22} strokeWidth={2.6} width={22} />
            <HowStep
              caption="Homemade version"
              icon={<OpenBook color={colors.coral} height={24} strokeWidth={2.1} width={24} />}
              label="Recipe"
            />
            <NavArrowRight color={colors.creamDeep} height={22} strokeWidth={2.6} width={22} />
            <HowStep
              caption="Shop and cook"
              icon={<Cart color={colors.coral} height={24} strokeWidth={2.1} width={24} />}
              label="Groceries"
            />
          </View>
        </View>

        {recentRecipe ? (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent</Text>
              <Pressable
                accessibilityRole="button"
                onPress={openLibrary}
                style={({ pressed }) => [styles.seeAllButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.seeAllText}>See all</Text>
                <NavArrowRight color={colors.coral} height={20} strokeWidth={2.35} width={20} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={openRecentRecipe}
              style={({ pressed }) => [styles.recentCard, pressed ? styles.pressed : null]}
            >
              <View style={styles.recentIcon}>
                <Book color={colors.coral} height={28} strokeWidth={2.2} width={28} />
              </View>
              <View style={styles.recentCopy}>
                <Text numberOfLines={1} style={styles.recentRecipeTitle}>
                  {cleanPublicText(recentRecipe.title)}
                </Text>
                <Text style={styles.recentMeta}>Saved recipe</Text>
                <View style={styles.savedPill}>
                  <Dollar color={colors.green} height={17} strokeWidth={2.2} width={17} />
                  <Text style={styles.savedPillText}>
                    Home est. {formatOptionalCurrency(recentRecipe.estimatedHomemadeCost)}
                  </Text>
                </View>
              </View>
              <NavArrowRight color={colors.body} height={26} strokeWidth={2.2} width={26} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type HowStepProps = {
  caption: string;
  icon: ReactNode;
  label: string;
};

function HowStep({ caption, icon, label }: HowStepProps) {
  return (
    <View style={styles.howStep}>
      <View style={styles.howIcon}>{icon}</View>
      <Text style={styles.howLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.howCaption}>{caption}</Text>
    </View>
  );
}

type ScanActionButtonProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
};

function ScanActionButton({ icon, label, onPress, tone = 'secondary' }: ScanActionButtonProps) {
  const isPrimary = tone === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.scanButton,
        isPrimary ? styles.scanButtonPrimary : styles.scanButtonSecondary,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.scanButtonIcon}>{icon}</View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.84}
        numberOfLines={1}
        style={[styles.scanButtonText, isPrimary ? styles.scanButtonTextPrimary : styles.scanButtonTextSecondary]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createPlaceholderImage(source: ScanSource): ScanImageMetadata {
  return {
    fileName: `${source}-mock-placeholder.jpg`,
    mimeType: 'image/jpeg',
    placeholder: true,
    source,
  };
}

async function getImageMetadata(asset: ImagePicker.ImagePickerAsset, source: ScanSource): Promise<ScanImageMetadata> {
  const processed = await getProcessedImage(asset);
  const dataUrl = getImageDataUrl(processed.base64, processed.mimeType);
  const dataUrlSizeBytes = dataUrl ? getUtf8SizeBytes(dataUrl) : undefined;
  const shouldSendDataUrl = Boolean(dataUrl && dataUrlSizeBytes !== undefined && dataUrlSizeBytes <= maxImageDataUrlBytes);
  logDev('okyo_scan_data_url_exists', { exists: Boolean(dataUrl) });
  logDev('okyo_scan_data_url_length', { length: dataUrl?.length ?? 0, sizeBytes: dataUrlSizeBytes ?? 0 });
  logDev('okyo_scan_conversion_error', {
    conversionError: shouldSendDataUrl
      ? null
      : dataUrl
        ? 'image_payload_too_large'
        : processed.conversionError ?? 'image_base64_missing',
  });

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
      logDev('okyo_scan_image_resize_start', {
        compress: attempt.compress,
        compressionQuality: attempt.compress,
        maxWidth: attempt.maxWidth,
        originalHeight: asset.height,
        originalUriExists: Boolean(asset.uri),
        originalUriPrefix: getValuePrefix(asset.uri),
        originalWidth: asset.width,
        resizing: actions.length > 0,
        targetMaxWidth: attempt.maxWidth,
      });
      const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        base64: true,
        compress: attempt.compress,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const dataUrl = getImageDataUrl(result.base64, 'image/jpeg');
      const dataUrlSizeBytes = dataUrl ? getUtf8SizeBytes(dataUrl) : undefined;
      logDev('okyo_scan_image_resize_success', {
        base64Exists: Boolean(result.base64),
        base64Length: result.base64?.length ?? 0,
        compress: attempt.compress,
        dataUrlLength: dataUrl?.length ?? 0,
        height: result.height,
        maxWidth: attempt.maxWidth,
        resizedUriExists: Boolean(result.uri),
        resizedUriPrefix: getValuePrefix(result.uri),
        width: result.width,
      });

      latestResult = {
        base64: result.base64 ?? undefined,
        height: result.height,
        mimeType: 'image/jpeg',
        uri: result.uri,
        width: result.width,
        conversionError: dataUrl ? undefined : 'image_base64_missing',
      };

      if (dataUrl && dataUrlSizeBytes !== undefined && dataUrlSizeBytes <= maxImageDataUrlBytes) {
        logProcessedImageAttempt(attempt.maxWidth, attempt.compress, result.width, result.height, dataUrlSizeBytes, true);
        return latestResult;
      }

      logProcessedImageAttempt(attempt.maxWidth, attempt.compress, result.width, result.height, dataUrlSizeBytes, false);
    } catch (error) {
      latestResult = {
        height: asset.height,
        mimeType: asset.mimeType ?? getMimeTypeFromFileName(asset.fileName) ?? 'image/jpeg',
        uri: asset.uri,
        width: asset.width,
        conversionError: 'image_processing_failed',
      };
      logImageProcessingError(error, attempt.maxWidth, attempt.compress);
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

function getScanRecipes(result: CreateScanResult) {
  if (Array.isArray(result.recipes) && result.recipes.length > 0) {
    return result.recipes;
  }

  return result.recipe ? [result.recipe] : [];
}

function getDemoRecipes() {
  return defaultScanResult.modes.map((mode) => getSafeRecipeForMode(mode));
}

function createStarterRecipesFromScan(scan: NonNullable<CreateScanResult['scan']>) {
  const modes: RecipeMode[] = scan.modes?.length ? scan.modes : ['Restaurant Copy', 'Budget', 'Healthy'];
  return modes.map((mode) => createStarterRecipeFromScan(scan, mode));
}

function createStarterRecipeFromScan(scan: NonNullable<CreateScanResult['scan']>, mode: RecipeMode): Recipe {
  const dishName = cleanPublicText(scan.dishName || scan.bestGuessDishName || 'Restaurant-Style Food Plate');
  const titlePrefix = mode === 'Budget'
    ? 'Budget'
    : mode === 'Healthy'
      ? 'Lighter'
      : 'Restaurant-Style';
  const ingredientName = getStarterIngredientName(dishName);
  const homemadeCost = getModeStarterCost(scan.homemadeCost, scan.restaurantPrice, mode);

  return {
    id: `scan-starter-${slugify(dishName)}-${slugify(mode)}`,
    scanResultId: scan.id,
    title: `${titlePrefix} ${dishName}`,
    mode,
    description: `A flexible inspired-by starter recipe based on the visible food in your photo.`,
    prepTimeMinutes: 10,
    cookTimeMinutes: 18,
    totalTimeMinutes: 28,
    activeTimeMinutes: 20,
    servings: 2,
    skillLevel: 'Easy',
    difficulty: 'Easy',
    estimatedHomemadeCost: homemadeCost,
    estimatedSavings: Math.max(0, scan.restaurantPrice - homemadeCost),
    ingredients: [
      { name: ingredientName, quantity: '2 servings' },
      { name: 'matching sauce or dressing', quantity: '1/4 cup' },
      { name: 'fresh garnish or vegetables', quantity: '1 cup' },
      { name: 'salt, pepper, and cooking oil', quantity: 'pantry check', pantryItem: true },
    ],
    ingredientGroups: [
      { component: 'Main', items: [{ name: ingredientName, quantity: '2 servings' }] },
      { component: 'Sauce', items: [{ name: 'matching sauce or dressing', quantity: '1/4 cup' }] },
      { component: 'Finish', items: [{ name: 'fresh garnish or vegetables', quantity: '1 cup' }] },
    ],
    steps: [
      `Prep the visible main ingredients for ${dishName}.`,
      'Cook the main ingredient with oil, salt, and pepper until hot and browned where appropriate.',
      'Warm or stir together the sauce so it can coat the food evenly.',
      'Combine the base, sauce, and toppings, then taste and adjust seasoning.',
      'Serve right away with garnish or a bright squeeze of lemon if it fits.',
    ],
    structuredSteps: [
      {
        text: `Prep the visible main ingredients for ${dishName}.`,
        timeEstimate: '5 min',
        visualCue: 'Ingredients are cut or portioned.',
        whyItMatters: 'A flexible starter keeps the result useful without pretending to know the exact restaurant recipe.',
      },
      {
        text: 'Cook the main ingredient with oil, salt, and pepper until hot and browned where appropriate.',
        timeEstimate: '8-12 min',
        visualCue: 'Food is hot, browned, or tender.',
      },
      {
        text: 'Combine with sauce and toppings, then taste before serving.',
        timeEstimate: '3 min',
        visualCue: 'Everything is coated and seasoned.',
      },
    ],
    substitutions: [
      'Use any matching protein, vegetable, or grain you already have.',
      'Use bottled sauce, dressing, or a simple pan sauce.',
      'Swap garnish for herbs, scallions, sesame seeds, or cheese if they fit.',
    ],
    pantryNote: 'Assumes salt, pepper, and basic cooking oil are on hand.',
    confidenceNote: 'Starter recipe based on visible food evidence from the scan, not an official restaurant recipe.',
    mainIngredientsSummary: ingredientName,
    equipment: ['skillet or sheet pan', 'knife', 'cutting board', 'mixing bowl'],
    bestFor: 'a quick best-guess homemade version',
    avoidMistake: 'Do not treat this as the exact restaurant recipe; adjust based on what you can see.',
    mistakeWarning: 'Do not overcook the main ingredient while recreating the visible dish.',
    storageAndReheating: 'Store leftovers up to 3 days and reheat gently.',
    storage: 'Store leftovers up to 3 days and reheat gently.',
    groceryItems: [
      { category: 'Protein', name: ingredientName, quantity: '2 servings', sourceIngredient: ingredientName },
      { category: 'Sauces / Condiments', name: 'matching sauce or dressing', quantity: '1 small bottle' },
      { category: 'Produce', name: 'fresh garnish or vegetables', quantity: '1 small bunch or bag' },
      { category: 'Pantry', name: 'salt, pepper, and cooking oil', quantity: 'pantry check', pantryStaple: true },
    ],
    spicePairings: ['black pepper', 'chili flakes', 'garlic powder'],
    cookingTerms: [
      { term: 'Best guess', meaning: 'A useful recipe direction based on visible food evidence.' },
    ],
  };
}

function getScanRecipeForMode(
  recipes: Recipe[],
  mode: RecipeMode,
  fallbackRecipe: Recipe | null | undefined = null,
) {
  return recipes.find((recipe) => recipe.mode === mode) ?? fallbackRecipe ?? null;
}

function getStarterIngredientName(dishName: string) {
  const normalized = dishName.toLowerCase();
  if (normalized.includes('pizza')) {
    return 'pizza crust, sauce, and cheese';
  }
  if (normalized.includes('rice') || normalized.includes('bowl')) {
    return 'cooked rice or grain base';
  }
  if (normalized.includes('noodle') || normalized.includes('pasta')) {
    return 'noodles or pasta';
  }
  if (normalized.includes('burger') || normalized.includes('sandwich')) {
    return 'bun, filling, and toppings';
  }
  if (normalized.includes('salad')) {
    return 'greens, toppings, and dressing';
  }

  return 'visible main ingredient';
}

function getModeStarterCost(homemadeCost: number, restaurantPrice: number, mode: RecipeMode) {
  const baseCost = Number.isFinite(homemadeCost) && homemadeCost > 0
    ? homemadeCost
    : Math.max(3, restaurantPrice * 0.45);
  const multiplier = mode === 'Budget' ? 0.82 : mode === 'Healthy' ? 1.08 : 1;
  return Number(Math.max(2, baseCost * multiplier).toFixed(2));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'food';
}

function logScanResponse(result: CreateScanResult, image?: ScanImageMetadata) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_api_response_status', { status: result.status ?? 'success' });
  console.log('okyo_scan_api_response_scan_state', { scanState: result.scan?.scanState ?? result.scanState });
  console.log('okyo_scan_api_response_food_detected', {
    foodDetected: hasFoodEvidence({ result, status: result.status ?? 'success' }),
  });
  console.log('okyo_scan_api_response_dish_name', { dishName: result.scan?.dishName });
  console.log('okyo_scan_api_response_recipes_length', { recipesLength: result.recipes?.length ?? 0 });
  console.log('okyo_scan_response', {
    status: result.status,
    scanState: result.scan?.scanState ?? result.scanState,
    dishName: result.scan?.dishName,
    bestGuessDishName: result.scan?.bestGuessDishName,
    recipesLength: result.recipes?.length ?? 0,
    hasRecipe: Boolean(result.recipe),
    rejectionType: result.rejectionType,
    rejectionReason: result.rejectionReason,
    fallbackReason: result.fallbackReason,
    image: {
      conversionError: image?.conversionError,
      dataUrlSizeBytes: image?.dataUrlSizeBytes,
      hasDataUrl: Boolean(image?.dataUrl),
      height: image?.height,
      source: image?.source,
      width: image?.width,
    },
  });
}

function logSelectedImage(source: ScanSource, image?: ScanImageMetadata) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_selected_image_uri', {
    fileSize: image?.sizeBytes,
    height: image?.height,
    source: getPublicScanSource(source),
    uriExists: Boolean(image?.uri),
    uriPrefix: getValuePrefix(image?.uri),
    width: image?.width,
  });
  console.log('okyo_scan_selected_image', {
    source,
    uriExists: Boolean(image?.uri),
    uriPrefix: getValuePrefix(image?.uri),
    mimeType: image?.mimeType,
    width: image?.width,
    height: image?.height,
    dataUrlExists: Boolean(image?.dataUrl),
    dataUrlLength: image?.dataUrl?.length ?? 0,
    dataUrlSizeBytes: image?.dataUrlSizeBytes,
    conversionError: image?.conversionError,
  });
}

function logScanRouteDecision(status: string, result: Partial<CreateScanResult>, route: string) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const reason = getRouteReason(status, result, route);
  console.log('okyo_scan_failure_reason', {
    reason: route === 'result_success_path' ? null : reason,
    fallbackReason: result.fallbackReason,
    rejectionReason: result.rejectionReason,
    rejectionType: result.rejectionType,
  });
  console.log('okyo_scan_route_decision', {
    route,
    reason,
    status,
    scanState: result.scan?.scanState ?? result.scanState,
    foodDetected: isFoodScanState(result.scan?.scanState ?? result.scanState),
    dishName: result.scan?.dishName,
    recipesLength: result.recipes?.length ?? 0,
    hasRecipe: Boolean(result.recipe),
    rejectionType: result.rejectionType,
    rejectionReason: result.rejectionReason,
  });
}

function logStoreAfterResponse(
  latestScanStatus: string,
  latestScanResult: CreateScanResult['scan'] | null,
  latestScanRecipe: Recipe | null,
  latestScanRecipes: Recipe[],
  selectedScanImage: ScanImageMetadata | undefined,
  scanSessionId: string,
) {
  logDev('okyo_scan_store_after_response', {
    latestScanRecipeExists: Boolean(latestScanRecipe),
    latestScanRecipesLength: latestScanRecipes.length,
    latestScanResultExists: Boolean(latestScanResult),
    latestScanStatus,
    scanSessionId,
    selectedScanImageExists: Boolean(selectedScanImage),
  });
}

function failureStatusToRoute(status: string, result: Partial<CreateScanResult>) {
  if (shouldRejectScan({ result, status: status as CreateScanResult['status'] })) {
    return 'rejection_path';
  }

  return 'failure_path';
}

function getRouteReason(status: string, result: Partial<CreateScanResult>, route: string) {
  if (route === 'result_success_path') {
    if (status === 'partial') {
      return 'food_evidence_or_recipe_present';
    }
    return 'success_status_or_usable_scan';
  }
  if (route === 'rejection_path') {
    return result.rejectionReason ?? 'not_food_without_food_evidence';
  }
  if (route === 'api_error_path') {
    return result.rejectionReason ?? 'api_or_network_error';
  }

  return result.rejectionReason ?? result.fallbackReason ?? 'no_usable_food_result';
}

function getPublicScanSource(source: ScanSource) {
  if (source === 'photos') {
    return 'upload';
  }
  if (source === 'mock') {
    return 'demo';
  }

  return 'camera';
}

function createScanSessionId(source: ScanSource) {
  return `scan-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveScanSession(scanSessionId: string) {
  return useOkyoStore.getState().scanSessionId === scanSessionId;
}

function logIgnoredScanSessionWrite(scanSessionId: string, reason: string) {
  logDev('okyo_scan_state_write', {
    activeScanSessionId: useOkyoStore.getState().scanSessionId,
    ignored: true,
    reason,
    scanSessionId,
  });
}

function getValuePrefix(value: string | null | undefined, length = 30) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, length) : null;
}

function logDev(label: string, details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log(label, details);
}

function logProcessedImageAttempt(
  maxWidth: number,
  compress: number,
  width: number,
  height: number,
  dataUrlSizeBytes: number | undefined,
  accepted: boolean,
) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_image_processed', {
    accepted,
    compress,
    dataUrlLength: dataUrlSizeBytes ?? 0,
    height,
    maxWidth,
    width,
  });
}

function logImageProcessingError(error: unknown, maxWidth: number, compress: number) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_image_processing_error', {
    compress,
    maxWidth,
    message: error instanceof Error ? error.message : 'Unknown image processing error.',
  });
}

function isRealUploadedImage(source: ScanSource, image?: ScanImageMetadata) {
  return Boolean(
    image &&
    !image.placeholder &&
    source !== 'mock' &&
    (image.uri || image.dataUrl || image.fileName || image.width || image.height || image.sizeBytes || image.dataUrlSizeBytes),
  );
}

function getImageDataUrl(base64: string | null | undefined, mimeType: string) {
  const cleanBase64 = typeof base64 === 'string' ? base64.trim() : '';
  if (!cleanBase64) {
    return undefined;
  }

  return `data:${mimeType};base64,${cleanBase64}`;
}

function getUtf8SizeBytes(value: string) {
  return value.length;
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

function getUploadFailureReasonFromError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.toLowerCase().includes('too large')) {
    return 'This photo was too large to scan. Try a smaller image.';
  }
  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('abort') ||
    message.toLowerCase().includes('fetch') ||
    message.toLowerCase().includes('failed to fetch')
  ) {
    return 'Okyo could not reach the scanner. Check the API server and try again.';
  }

  return 'Okyo had trouble scanning this photo. Try again in a second.';
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
  if (result.rejectionType === 'not_food') {
    return "This doesn't look like a restaurant meal.";
  }
  if (result.rejectionType === 'unclear_image') {
    return 'Try uploading a clearer food photo.';
  }

  return 'Okyo had trouble scanning this photo. Try again in a second.';
}

function formatOptionalCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : '—';
}

function cleanPublicText(value: string) {
  const commonTypo = `Amer${'cian'}`;
  const lowercaseTypo = `amer${'cian'}`;
  const joinedCopyWord = ['copy', 'cat'].join('');
  const spacedCopyWord = ['copy', 'cat'].join('\\s+');

  return value
    .replace(new RegExp(`\\b${commonTypo}\\b`, 'g'), 'American')
    .replace(new RegExp(`\\b${lowercaseTypo}\\b`, 'g'), 'american')
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
    .trim();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  hero: {
    marginTop: 20,
    paddingBottom: 22,
  },
  headline: {
    color: colors.charcoal,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 46,
    maxWidth: 360,
  },
  subtitle: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 370,
  },
  scanCard: {
    backgroundColor: colors.card,
    borderRadius: 32,
    padding: 16,
    shadowColor: '#4a3a28',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 2,
  },
  illustrationPanel: {
    alignItems: 'center',
    aspectRatio: 2.35,
    backgroundColor: colors.cream,
    borderRadius: 26,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  scanMascot: {
    marginTop: 4,
  },
  scanActions: {
    gap: 10,
    marginTop: 16,
  },
  scanButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 20,
  },
  scanButtonPrimary: {
    backgroundColor: colors.coral,
    shadowColor: colors.coralDark,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  scanButtonSecondary: {
    backgroundColor: colors.cream,
  },
  scanButtonIcon: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 28,
  },
  scanButtonText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 0,
    textAlign: 'center',
  },
  scanButtonTextPrimary: {
    color: '#fffdf8',
  },
  scanButtonTextSecondary: {
    color: colors.coralDark,
  },
  howItWorks: {
    marginTop: 28,
  },
  howTitle: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  howCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 18,
    shadowColor: '#4a3a28',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  howStep: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  howIcon: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  howLabel: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  howCaption: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
    textAlign: 'center',
  },
  recentSection: {
    marginTop: 26,
  },
  recentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recentTitle: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '600',
  },
  seeAllButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: 36,
    paddingLeft: 12,
  },
  seeAllText: {
    color: colors.coral,
    fontSize: 15,
    fontWeight: '700',
  },
  recentCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 12,
    minHeight: 106,
    minWidth: 0,
    padding: 14,
    shadowColor: '#4a3a28',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  recentIcon: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 16,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
  },
  recentRecipeTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
  },
  recentMeta: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  savedPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  savedPillText: {
    color: colors.green,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
