import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import { PrimaryButton, SecondaryButton, colors } from '../components/OkyoUI';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { defaultScanResult, getSafeRecipeForMode, getSafeRecipeMode } from '../mocks';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';

const maxImageDataUrlBytes = 2_750_000;

export function ScanScreen() {
  const navigation = useNavigation();
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanRecipes = useOkyoStore((state) => state.setLatestScanRecipes);
  const setLatestScanStatus = useOkyoStore((state) => state.setLatestScanStatus);
  const setLatestScanFailure = useOkyoStore((state) => state.setLatestScanFailure);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const setSelectedScanImage = useOkyoStore((state) => state.setSelectedScanImage);
  const setLatestAiDebugMetadata = useOkyoStore((state) => state.setLatestAiDebugMetadata);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);

  const startScan = (source: ScanSource, image?: ScanImageMetadata) => {
    const uploadedImage = isRealUploadedImage(source, image);
    uiLog('ScanScreen', 'scan_started', { source, hasImage: Boolean(image?.uri), placeholder: image?.placeholder, uploadedImage });
    track(analyticsEvents.SCAN_STARTED, { screen: 'ScanScreen', source });
    track(analyticsEvents.PHOTO_UPLOADED, { screen: 'ScanScreen', source });
    setLatestScanResult(uploadedImage ? null : defaultScanResult);
    setLatestScanRecipes([]);
    setLatestScanStatus('pending');
    setLatestScanFailure(null);
    setLatestScanRecipe(null);
    setSelectedScanImage(getPreviewImageMetadata(image));
    setLatestAiDebugMetadata(null);
    navigation.navigate('AnalysisLoadingScreen' as never);

    createMockScan({ image, mode: selectedMode, source })
      .then((result) => {
        const status = result.status ?? 'success';
        setSelectedScanImage(getPreviewImageMetadata(result.image ?? image));
        setLatestAiDebugMetadata(getAiDebugMetadata(result));
        if ((status === 'success' || status === 'partial') && result.scan) {
          setLatestScanStatus(status);
          setLatestScanFailure(null);
          setLatestScanResult(result.scan);
<<<<<<< ours
          setLatestScanRecipes(status === 'success' ? getScanRecipes(result) : []);
=======
          setLatestScanRecipe(result.recipe ?? null);
>>>>>>> theirs
        } else {
          const failureStatus = status === 'rejected' || status === 'failed' ? status : 'failed';
          setLatestScanStatus(failureStatus);
          setLatestScanFailure({
            status: failureStatus,
            rejectionType: result.rejectionType ?? 'ai_failed',
            rejectionReason: getScanFailureReason(result),
          });
          setLatestScanResult(null);
<<<<<<< ours
          setLatestScanRecipes([]);
=======
          setLatestScanRecipe(null);
>>>>>>> theirs
        }
        if ((status === 'success' || status === 'partial') && result.recipe?.mode) {
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
        track(analyticsEvents.RESULT_ERROR, {
          errorMessage: error instanceof Error ? error.message : 'Mock API scan failed.',
          screen: 'ScanScreen',
          source,
        });
        uiLog('ScanScreen', 'api_scan_fallback', { source });
        if (uploadedImage) {
          setLatestScanStatus('failed');
          setLatestScanFailure({
            status: 'failed',
            rejectionType: 'ai_failed',
            rejectionReason: 'Okyo could not analyze this photo. Try uploading a clearer food photo.',
          });
          setLatestScanResult(null);
<<<<<<< ours
          setLatestScanRecipes([]);
=======
          setLatestScanRecipe(null);
>>>>>>> theirs
        } else {
          setLatestScanStatus('success');
          setLatestScanFailure(null);
          setLatestScanResult(defaultScanResult);
<<<<<<< ours
          setLatestScanRecipes([]);
=======
          setLatestScanRecipe(getSafeRecipeForMode(selectedMode));
>>>>>>> theirs
        }
        setSelectedScanImage(getPreviewImageMetadata(image));
        setLatestAiDebugMetadata({
          aiSource: 'fallback_ai',
          fallbackReason: 'mobile_api_unavailable',
          confidence: defaultScanResult.confidence,
        });
      });
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        uiLog('ScanScreen', 'camera_permission_denied');
        Alert.alert(
          'Camera permission needed',
          'Okyo needs camera permission to take a food photo. You can allow camera access in Settings or use Upload From Photos instead.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.55,
      });

      if (result.canceled || result.assets.length === 0) {
        uiLog('ScanScreen', 'camera_cancelled');
        return;
      }

      startScan('camera', getImageMetadata(result.assets[0], 'camera'));
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
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.55,
      });

      if (result.canceled || result.assets.length === 0) {
        uiLog('ScanScreen', 'photo_picker_cancelled');
        return;
      }

      startScan('photos', getImageMetadata(result.assets[0], 'photos'));
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

  return (
    <ScreenScaffold
      title="Scan a meal"
      body="Take a photo or choose one from your library. Okyo will estimate the homemade dupe and savings."
    >
      <View style={styles.cameraCard}>
        <Text style={styles.cameraIcon}>OK</Text>
        <Text style={styles.cameraText}>Ready for a real meal photo</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton onPress={takePhoto}>Take Photo</PrimaryButton>
        <SecondaryButton onPress={uploadFromPhotos}>Upload From Photos</SecondaryButton>
        <SecondaryButton onPress={tryDemoScan}>Try Demo Scan</SecondaryButton>
      </View>
    </ScreenScaffold>
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

function getImageMetadata(asset: ImagePicker.ImagePickerAsset, source: ScanSource): ScanImageMetadata {
  const mimeType = asset.mimeType ?? getMimeTypeFromFileName(asset.fileName) ?? 'image/jpeg';
  const dataUrl = getImageDataUrl(asset.base64, mimeType);
  const dataUrlSizeBytes = dataUrl ? getUtf8SizeBytes(dataUrl) : undefined;
  const shouldSendDataUrl = dataUrl && dataUrlSizeBytes !== undefined && dataUrlSizeBytes <= maxImageDataUrlBytes;

  return {
    fileName: asset.fileName ?? undefined,
    height: asset.height,
    mimeType,
    placeholder: false,
    sizeBytes: asset.fileSize ?? undefined,
    dataUrl: shouldSendDataUrl ? dataUrl : undefined,
    dataUrlSizeBytes,
    source,
    uri: asset.uri,
    width: asset.width,
    conversionError: shouldSendDataUrl
      ? undefined
      : dataUrl
        ? 'image_payload_too_large'
        : 'image_base64_missing',
  };
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

function isRealUploadedImage(source: ScanSource, image?: ScanImageMetadata) {
  return Boolean(
    image &&
    !image.placeholder &&
    source !== 'mock' &&
<<<<<<< ours
    (image.uri || image.dataUrl || image.fileName || image.width || image.height || image.sizeBytes),
=======
    (image.uri || image.dataUrl || image.fileName || image.width || image.height || image.sizeBytes || image.dataUrlSizeBytes),
>>>>>>> theirs
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
  if (result.rejectionReason) {
    return result.rejectionReason;
  }
  if (result.rejectionType === 'not_food') {
    return "This doesn't look like a restaurant meal.";
  }
  if (result.rejectionType === 'unclear_image') {
    return 'Try uploading a clearer food photo.';
  }

  return 'Okyo could not analyze this photo. Try uploading a clearer food photo.';
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 20,
  },
  cameraCard: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 150,
    justifyContent: 'center',
    marginTop: 20,
  },
  cameraIcon: {
    color: colors.coral,
    fontSize: 44,
    fontWeight: '900',
  },
  cameraText: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    textTransform: 'uppercase',
  },
});
