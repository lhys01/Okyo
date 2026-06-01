import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import { PrimaryButton, SecondaryButton, colors } from '../components/OkyoUI';
import { defaultScanResult, getSafeRecipeForMode, getSafeRecipeMode, type Recipe, type RecipeMode } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';

type ScanNavigation = NativeStackNavigationProp<RootStackParamList, 'ScanScreen'>;

const maxImageDataUrlBytes = 2_750_000;

export function ScanScreen() {
  const navigation = useNavigation<ScanNavigation>();
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanRecipes = useOkyoStore((state) => state.setLatestScanRecipes);
  const setLatestScanStatus = useOkyoStore((state) => state.setLatestScanStatus);
  const setLatestScanFailure = useOkyoStore((state) => state.setLatestScanFailure);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const setSelectedScanImage = useOkyoStore((state) => state.setSelectedScanImage);
  const setLatestAiDebugMetadata = useOkyoStore((state) => state.setLatestAiDebugMetadata);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);

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
          const scanRecipes = status === 'success' ? getScanRecipes(result) : [];
          const selectedRecipe = status === 'success'
            ? getScanRecipeForMode(scanRecipes, selectedMode, result.recipe)
            : null;
          setLatestScanStatus(status);
          setLatestScanFailure(null);
          setLatestScanResult(result.scan);
          setLatestScanRecipes(scanRecipes);
          setLatestScanRecipe(selectedRecipe);
        } else {
          const failureStatus = status === 'rejected' || status === 'failed' ? status : 'failed';
          setLatestScanStatus(failureStatus);
          setLatestScanFailure({
            status: failureStatus,
            rejectionType: result.rejectionType ?? 'ai_failed',
            rejectionReason: getScanFailureReason(result),
          });
          setLatestScanResult(null);
          setLatestScanRecipes([]);
          setLatestScanRecipe(null);
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
          setLatestScanRecipes([]);
          setLatestScanRecipe(null);
        } else {
          const demoRecipes = getDemoRecipes();
          setLatestScanStatus('success');
          setLatestScanFailure(null);
          setLatestScanResult(defaultScanResult);
          setLatestScanRecipes(demoRecipes);
          setLatestScanRecipe(getScanRecipeForMode(demoRecipes, selectedMode));
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

  const recentRecipe = savedRecipes.length > 0 ? savedRecipes[0] : null;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Logo and Kiko */}
        <View style={styles.headerTop}>
          <Text style={styles.headerLabel}>Scan</Text>
          <View style={styles.kikoPadding}>
            <Text style={styles.kiko}>🦊</Text>
          </View>
        </View>

        {/* Headline Section */}
        <View style={styles.headlineSection}>
          <View style={styles.headlineRow}>
            <Text style={styles.headlineBlack}>Scan </Text>
            <Text style={styles.headlineOrange}>any meal</Text>
          </View>
          <Text style={styles.subtitle}>Get a homemade swap, savings, and cooking steps.</Text>
        </View>

        {/* Main Food Image Card */}
          <View style={styles.foodImageCard}>
            <View style={styles.cornerBracketTL} />
            <View style={styles.cornerBracketTR} />

          <View style={styles.imagePlaceholder}>
            <Text style={styles.cameraOverlayIcon}>📷</Text>
          </View>

          <Text style={styles.addMealPhotoText}>Add a meal photo</Text>
          <Text style={styles.centerDishText}>Center your dish or choose one from your library.</Text>

          <View style={styles.cornerBracketBL} />
          <View style={styles.cornerBracketBR} />
        </View>

        {/* Primary Action - Take Photo */}
        <View style={styles.primaryButtonWrapper}>
          <PrimaryButton onPress={takePhoto}>📷 Take Photo</PrimaryButton>
        </View>

        {/* Secondary Actions */}
        <View style={styles.secondaryActionsSection}>
          <SecondaryButton onPress={uploadFromPhotos}>📁 Upload from Photos</SecondaryButton>
        </View>

        {/* Demo Link */}
        <Pressable onPress={tryDemoScan} style={styles.demoLinkContainer}>
          <Text style={styles.demoLinkText}>Try demo scan</Text>
        </Pressable>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
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

function getDemoRecipes() {
  return defaultScanResult.modes.map((mode) => getSafeRecipeForMode(mode));
}

function getScanRecipeForMode(
  recipes: Recipe[],
  mode: RecipeMode,
  fallbackRecipe: Recipe | null | undefined = null,
) {
  return recipes.find((recipe) => recipe.mode === mode) ?? fallbackRecipe ?? null;
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  headerLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  kikoPadding: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kiko: {
    fontSize: 56,
  },
  headlineSection: {
    marginBottom: 28,
  },
  headlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  headlineBlack: {
    color: colors.charcoal,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 46,
  },
  headlineOrange: {
    color: colors.coral,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 46,
  },
  subtitle: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 24,
  },
  foodImageCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerBracketTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.coral,
  },
  cornerBracketTR: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.coral,
  },
  cornerBracketBL: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.coral,
  },
  cornerBracketBR: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.coral,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: colors.cream,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cameraOverlayIcon: {
    fontSize: 64,
    opacity: 0.7,
  },
  addMealPhotoText: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  centerDishText: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButtonWrapper: {
    marginBottom: 14,
  },
  secondaryActionsSection: {
    gap: 12,
    marginBottom: 18,
  },
  demoLinkContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  demoLinkText: {
    color: colors.body,
    fontSize: 15,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 20,
  },
});
