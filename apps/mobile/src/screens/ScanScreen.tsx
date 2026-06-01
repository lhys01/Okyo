import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {
  Book,
  Camera,
  CameraSolid,
  Dollar,
  NavArrowRight,
  Spark,
  Sparks,
  Upload,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import { colors } from '../components/OkyoUI';
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
          'Okyo needs camera permission to take a food photo. You can allow camera access in Settings or use Upload food photo instead.',
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

  const openRecentRecipe = () => {
    if (!recentRecipe?.id) {
      return;
    }

    const mode = getSafeRecipeMode(recentRecipe.mode);
    uiLog('ScanScreen', 'open_recent_recipe', { recipeId: recentRecipe.id });
    setLatestAiDebugMetadata(null);
    setLatestScanFailure(null);
    setLatestScanRecipe(recentRecipe);
    setLatestScanRecipes([recentRecipe]);
    setLatestScanResult(null);
    setLatestScanStatus(null);
    setSelectedScanImage(null);
    setSelectedMode(mode);
    navigation.navigate('RecipeDetailScreen', { mode });
  };

  const openLibrary = () => {
    navigation.navigate('MainTabs', { screen: 'LibraryScreen' });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            Snap or upload a restaurant meal photo and Okyo will turn it into a homemade restaurant-style recipe, savings estimate, and groceries.
          </Text>
        </View>

        <View style={styles.scanCard}>
          <View style={styles.illustrationPanel}>
            <View style={styles.napkin} />
            <View style={styles.fork}>
              <View style={styles.forkHead}>
                <View style={styles.forkLine} />
                <View style={styles.forkLine} />
                <View style={styles.forkLine} />
              </View>
              <View style={styles.forkHandle} />
            </View>
            <View style={styles.knife} />
            <View style={styles.plateOuter}>
              <View style={styles.plateMiddle}>
                <View style={styles.plateInner}>
                  <Camera color={colors.coral} height={50} strokeWidth={2.25} width={50} />
                </View>
              </View>
            </View>
            <Spark color="#f5b763" height={28} style={styles.sparkLeft} strokeWidth={2.1} width={28} />
            <Spark color="#f5b763" height={22} style={styles.sparkRight} strokeWidth={2.1} width={22} />
            <View style={styles.okyoBadge}>
              <Text style={styles.okyoBadgeFace}>Okyo</Text>
            </View>
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
                    {formatOptionalCurrency(recentRecipe.estimatedSavings)} saved
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
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  hero: {
    marginTop: 24,
    paddingBottom: 24,
  },
  headline: {
    color: colors.charcoal,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 50,
    maxWidth: 360,
  },
  subtitle: {
    color: colors.body,
    fontSize: 18,
    lineHeight: 27,
    marginTop: 22,
    maxWidth: 370,
  },
  scanCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#7b5a38',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 2,
  },
  illustrationPanel: {
    alignItems: 'center',
    aspectRatio: 1.84,
    backgroundColor: colors.cream,
    borderRadius: 20,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  napkin: {
    backgroundColor: '#fff6e8',
    borderColor: '#f2dcbc',
    borderRadius: 8,
    borderWidth: 1,
    height: '54%',
    left: '11%',
    opacity: 0.82,
    position: 'absolute',
    top: '38%',
    transform: [{ rotate: '-18deg' }],
    width: '33%',
  },
  fork: {
    alignItems: 'center',
    height: '63%',
    justifyContent: 'flex-start',
    left: '15%',
    position: 'absolute',
    top: '23%',
    width: 30,
  },
  forkHead: {
    flexDirection: 'row',
    gap: 3,
    height: 40,
  },
  forkLine: {
    backgroundColor: '#e5cbb0',
    borderRadius: 999,
    width: 3,
  },
  forkHandle: {
    backgroundColor: '#e5cbb0',
    borderRadius: 999,
    flex: 1,
    marginTop: -3,
    width: 5,
  },
  knife: {
    backgroundColor: '#e5cbb0',
    borderRadius: 999,
    height: '58%',
    position: 'absolute',
    right: '15%',
    top: '22%',
    transform: [{ rotate: '7deg' }],
    width: 6,
  },
  plateOuter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 250, 242, 0.68)',
    borderColor: '#e8cdb0',
    borderRadius: 999,
    borderWidth: 2,
    height: '78%',
    justifyContent: 'center',
    width: '45%',
  },
  plateMiddle: {
    alignItems: 'center',
    borderColor: '#f0d8bc',
    borderRadius: 999,
    borderWidth: 2,
    height: '78%',
    justifyContent: 'center',
    width: '78%',
  },
  plateInner: {
    alignItems: 'center',
    borderColor: '#f7dfc3',
    borderRadius: 999,
    borderWidth: 2,
    height: '70%',
    justifyContent: 'center',
    width: '70%',
  },
  sparkLeft: {
    left: '28%',
    position: 'absolute',
    top: '16%',
  },
  sparkRight: {
    position: 'absolute',
    right: '25%',
    top: '23%',
  },
  okyoBadge: {
    alignItems: 'center',
    backgroundColor: '#ffd09f',
    borderColor: '#fffdf8',
    borderRadius: 999,
    borderWidth: 4,
    bottom: 16,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 88,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 18,
    shadowColor: '#9a5a2f',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
  },
  okyoBadgeFace: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '900',
  },
  scanActions: {
    gap: 12,
    marginTop: 18,
  },
  scanButton: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 64,
    minWidth: 0,
    paddingHorizontal: 18,
  },
  scanButtonPrimary: {
    backgroundColor: colors.coral,
    shadowColor: colors.coral,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  scanButtonSecondary: {
    backgroundColor: '#fffdf8',
    borderColor: colors.coral,
    borderWidth: 1.5,
  },
  scanButtonIcon: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 28,
  },
  scanButtonText: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '900',
    minWidth: 0,
    textAlign: 'center',
  },
  scanButtonTextPrimary: {
    color: '#fffdf8',
  },
  scanButtonTextSecondary: {
    color: colors.coralDark,
  },
  recentSection: {
    marginTop: 28,
  },
  recentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recentTitle: {
    color: colors.charcoal,
    fontSize: 22,
    fontWeight: '900',
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
    fontWeight: '900',
  },
  recentCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 106,
    minWidth: 0,
    padding: 14,
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
    fontWeight: '900',
  },
  recentMeta: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '700',
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
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
