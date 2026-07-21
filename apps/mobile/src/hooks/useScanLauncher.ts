import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRef } from 'react';
import { Alert } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import { OKYO_MAX_SCAN_IMAGE_DATA_URL_BYTES } from '../api/config';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import { sampleFoodImageUrls } from '../data/sampleFoodImages';
import { getSafeRecipeMode, type Recipe, type RecipeMode } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore, type LatestScanFailure } from '../state/useOkyoStore';
import { hasFoodEvidence, isUsableScan, shouldRejectScan } from '../utils/scanDecision';
import { markMobileScanStarted, measureMobileScanStage } from '../utils/scanTelemetry';
import { uiLog } from '../utils/uiDebug';
import { getUploadFailureReasonFromError } from '../screens/scanErrorMessage';

// Scanning starts directly from Home (and from retry actions elsewhere): this
// hook owns the full launch pipeline — native camera / photo picker, image
// validation + compression, scan-session bookkeeping, and the API request.
// Behavior is a straight extraction of the former ScanScreen logic; the scan
// session dedupe rules and honest failure paths are unchanged.

type ScanNavigation = NativeStackNavigationProp<RootStackParamList>;

const maxProcessedImageWidth = 1400;

export function useScanLauncher() {
  const navigation = useNavigation<ScanNavigation>();
  const isLaunchingRef = useRef(false);

  const takePhoto = async () => {
    if (isLaunchingRef.current) {
      return;
    }
    isLaunchingRef.current = true;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        uiLog('useScanLauncher', 'camera_permission_denied');
        Alert.alert(
          'Camera access needed',
          'Okyo uses the camera to look at your food. You can allow camera access in Settings, or pick a photo from your library instead.',
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
        uiLog('useScanLauncher', 'camera_cancelled');
        return;
      }

      const requestId = createScanSessionId('camera');
      markMobileScanStarted(requestId);
      const cameraImage = await measureMobileScanStage(
        requestId,
        'image_preparation',
        () => getImageMetadata(result.assets[0], 'camera'),
      );
      startScan(navigation, 'camera', requestId, cameraImage);
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Camera unavailable.',
        screen: 'useScanLauncher',
        source: 'camera',
      });
      uiLog('useScanLauncher', 'camera_unavailable');
      Alert.alert(
        'Camera unavailable',
        'The camera didn’t open — this can happen in the simulator. Choosing a photo from your library works the same way.',
      );
    } finally {
      isLaunchingRef.current = false;
    }
  };

  const uploadFromPhotos = async () => {
    if (isLaunchingRef.current) {
      return;
    }
    isLaunchingRef.current = true;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        uiLog('useScanLauncher', 'photo_picker_cancelled');
        return;
      }

      const requestId = createScanSessionId('photos');
      markMobileScanStarted(requestId);
      const photosImage = await measureMobileScanStage(
        requestId,
        'image_preparation',
        () => getImageMetadata(result.assets[0], 'photos'),
      );
      startScan(navigation, 'photos', requestId, photosImage);
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Image picker failed.',
        screen: 'useScanLauncher',
        source: 'photos',
      });
      uiLog('useScanLauncher', 'photo_picker_error');
      Alert.alert(
        'Photos didn’t open',
        'Okyo couldn’t reach your photo library just now. Nothing was lost — try again in a moment.',
      );
    } finally {
      isLaunchingRef.current = false;
    }
  };

  return { takePhoto, uploadFromPhotos };
}

function startScan(
  navigation: ScanNavigation,
  source: ScanSource,
  requestId: string,
  image?: ScanImageMetadata,
) {
  const state = useOkyoStore.getState();
  const selectedMode = state.selectedMode;
  const uploadedImage = isRealUploadedImage(source, image);
  const scanSessionId = requestId;
  const previewImage = getPreviewImageMetadata(image);
  uiLog('useScanLauncher', 'scan_started', {
    source,
    hasImage: Boolean(image?.uri),
    placeholder: image?.placeholder,
    uploadedImage,
  });
  track(analyticsEvents.SCAN_STARTED, { screen: 'useScanLauncher', source });
  track(analyticsEvents.PHOTO_UPLOADED, { screen: 'useScanLauncher', source });
  state.beginLatestScanSession({
    scanSessionId,
    latestScanStatus: 'pending',
    latestScanFailure: null,
    latestScanResult: null,
    latestScanRecipe: null,
    selectedScanImage: previewImage,
    latestAiDebugMetadata: null,
    source,
    reason: 'useScanLauncher.startScan',
  });
  navigation.navigate('AnalysisLoadingScreen', { scanSessionId });

  createMockScan({ requestId, image, mode: selectedMode, source })
    .then((result) => {
      if (!isActiveScanSession(scanSessionId)) {
        logIgnoredScanSessionWrite(scanSessionId, 'useScanLauncher.api_response_stale');
        return;
      }

      const status = result.status ?? 'success';
      // Prefer the user's original uploaded photo over the API-returned image.
      // The API may return result.image with placeholder:true (e.g. on
      // conversion error), which would cause getRealScanImageUri() to return
      // null downstream even though the user's real photo URI is intact.
      const imageForStorage = (!image?.placeholder && image?.uri) ? image : (result.image ?? image);
      const responseImage = getPreviewImageMetadata(imageForStorage);
      const aiDebugMetadata = getAiDebugMetadata(result);
      const foodEvidence = hasFoodEvidence({ result, status });
      const scanRecipes = getScanRecipes(result);
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
        const storedStatus = status === 'partial'
          ? 'partial'
          : selectedRecipe || foodEvidence
            ? 'success'
            : status;
        useOkyoStore.getState().writeLatestScanSession({
          scanSessionId,
          latestScanStatus: storedStatus,
          latestScanFailure: null,
          latestScanResult: result.scan,
          latestScanRecipe: selectedRecipe,
          selectedScanImage: responseImage,
          latestAiDebugMetadata: aiDebugMetadata,
          source,
          reason: 'useScanLauncher.api_success',
        });
      } else {
        const failureStatus = shouldRejectScan({ result, status }) ? 'rejected' : 'failed';
        const failure = {
          status: failureStatus,
          rejectionType: result.rejectionType ?? 'ai_failed',
          rejectionReason: getScanFailureReason(result),
        } satisfies LatestScanFailure;
        useOkyoStore.getState().writeLatestScanSession({
          scanSessionId,
          latestScanStatus: failureStatus,
          latestScanFailure: failure,
          latestScanResult: null,
          latestScanRecipe: null,
          selectedScanImage: responseImage,
          latestAiDebugMetadata: aiDebugMetadata,
          source,
          reason: 'useScanLauncher.api_failure',
        });
      }
      if (isActiveScanSession(scanSessionId) && (status === 'success' || status === 'partial') && result.recipe?.mode) {
        useOkyoStore.getState().setSelectedMode(getSafeRecipeMode(result.recipe.mode));
      }
      uiLog('useScanLauncher', 'api_scan_result', {
        scanId: result.scan?.id ?? result.scanId,
        source,
        status,
        rejectionType: result.rejectionType,
      });
    })
    .catch((error) => {
      if (!isActiveScanSession(scanSessionId)) {
        logIgnoredScanSessionWrite(scanSessionId, 'useScanLauncher.api_error_stale');
        return;
      }

      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Scan request failed.',
        screen: 'useScanLauncher',
        source,
      });
      uiLog('useScanLauncher', 'api_scan_fallback', { source });
      const failure = {
        status: 'failed',
        rejectionType: 'ai_failed',
        rejectionReason: getUploadFailureReasonFromError(error),
      } as const;
      useOkyoStore.getState().writeLatestScanSession({
        scanSessionId,
        latestScanStatus: 'failed',
        latestScanFailure: failure,
        latestScanResult: null,
        latestScanRecipe: null,
        selectedScanImage: getPreviewImageMetadata(image),
        latestAiDebugMetadata: {
          aiSource: 'fallback_ai',
          fallbackReason: 'mobile_api_unavailable',
          confidence: 0,
        },
        source,
        reason: uploadedImage ? 'useScanLauncher.api_error_uploaded_image' : 'useScanLauncher.api_error',
      });
    });
}

async function getImageMetadata(asset: ImagePicker.ImagePickerAsset, source: ScanSource): Promise<ScanImageMetadata> {
  const processed = await getProcessedImage(asset);
  const dataUrl = getImageDataUrl(processed.base64, processed.mimeType);
  const dataUrlSizeBytes = dataUrl ? getUtf8SizeBytes(dataUrl) : undefined;
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
      const dataUrlSizeBytes = dataUrl ? getUtf8SizeBytes(dataUrl) : undefined;

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
    } catch {
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
  const decorateRecipe = shouldUseSampleRecipeImages(result)
    ? addSampleImageUrl
    : (recipe: Recipe) => recipe;

  if (Array.isArray(result.recipes) && result.recipes.length > 0) {
    return result.recipes.map(decorateRecipe);
  }

  return result.recipe ? [decorateRecipe(result.recipe)] : [];
}

function shouldUseSampleRecipeImages(result: CreateScanResult) {
  return result.source === 'mock' || result.image?.placeholder === true;
}

function addSampleImageUrl(recipe: Recipe): Recipe {
  if (recipe.imageUrl || recipe.imageUri) {
    return recipe;
  }

  return {
    ...recipe,
    imageStatus: 'ready',
    imageUrl: getSampleImageUrlForDish(recipe.title),
  };
}

function getSampleImageUrlForDish(dishName: string) {
  const normalized = dishName.toLowerCase();
  if (normalized.includes('pasta') || normalized.includes('rigatoni') || normalized.includes('noodle') || normalized.includes('spaghetti')) {
    return sampleFoodImageUrls.pasta;
  }
  if (normalized.includes('burger') || normalized.includes('sandwich') || normalized.includes('biscuit')) {
    return sampleFoodImageUrls.burger;
  }
  if (normalized.includes('salad')) {
    return sampleFoodImageUrls.salad;
  }
  if (normalized.includes('cake') || normalized.includes('cookie') || normalized.includes('dessert')) {
    return sampleFoodImageUrls.dessert;
  }
  if (normalized.includes('egg') || normalized.includes('toast') || normalized.includes('breakfast')) {
    return sampleFoodImageUrls.breakfast;
  }

  return sampleFoodImageUrls.bowl;
}

function getScanRecipeForMode(
  recipes: Recipe[],
  mode: RecipeMode,
  fallbackRecipe: Recipe | null | undefined = null,
) {
  return recipes.find((recipe) => recipe.mode === mode) ?? fallbackRecipe ?? null;
}

function createScanSessionId(source: ScanSource) {
  return `scan-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveScanSession(scanSessionId: string) {
  return useOkyoStore.getState().scanSessionId === scanSessionId;
}

function logIgnoredScanSessionWrite(scanSessionId: string, reason: string) {
  uiLog('useScanLauncher', 'stale_scan_session_write_ignored', {
    activeScanSessionId: useOkyoStore.getState().scanSessionId,
    reason,
    scanSessionId,
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
    return 'That photo was too large to scan. A smaller or closer shot will work.';
  }
  if (result.rejectionReason) {
    return result.rejectionReason;
  }
  if (result.rejectionType === 'not_food') {
    return 'Okyo looked closely but couldn’t find food in this photo.';
  }
  if (result.rejectionType === 'unclear_image') {
    return 'The photo was a little hard to read. A clearer, closer shot helps.';
  }

  return 'Okyo had trouble reading this photo. Your photo is safe — try again in a moment.';
}
