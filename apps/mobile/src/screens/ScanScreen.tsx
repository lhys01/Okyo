import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { createMockScan } from '../api/client';
import type { AiDebugMetadata, CreateScanResult, ScanImageMetadata, ScanSource } from '../api/types';
import { PrimaryButton, SecondaryButton, colors } from '../components/OkyoUI';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { defaultScanResult, getSafeRecipeMode } from '../mocks';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';

export function ScanScreen() {
  const navigation = useNavigation();
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setSelectedScanImage = useOkyoStore((state) => state.setSelectedScanImage);
  const setLatestAiDebugMetadata = useOkyoStore((state) => state.setLatestAiDebugMetadata);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);

  const useMockScan = (source: ScanSource, image?: ScanImageMetadata) => {
    uiLog('ScanScreen', 'mock_scan', { source, hasImage: Boolean(image?.uri), placeholder: image?.placeholder });
    track(analyticsEvents.SCAN_STARTED, { screen: 'ScanScreen', source });
    track(analyticsEvents.PHOTO_UPLOADED, { screen: 'ScanScreen', source });
    setLatestScanResult(defaultScanResult);
    setSelectedScanImage(image ?? null);
    setLatestAiDebugMetadata(null);
    navigation.navigate('AnalysisLoadingScreen' as never);

    createMockScan({ image, mode: selectedMode, source })
      .then((result) => {
        setLatestScanResult(result.scan);
        setSelectedScanImage(result.image ?? image ?? null);
        setLatestAiDebugMetadata(getAiDebugMetadata(result));
        if (result.recipe?.mode) {
          setSelectedMode(getSafeRecipeMode(result.recipe.mode));
        }
        uiLog('ScanScreen', 'api_scan_success', { scanId: result.scan.id, source });
      })
      .catch((error) => {
        track(analyticsEvents.RESULT_ERROR, {
          errorMessage: error instanceof Error ? error.message : 'Mock API scan failed.',
          screen: 'ScanScreen',
          source,
        });
        uiLog('ScanScreen', 'api_scan_fallback', { source });
        setLatestScanResult(defaultScanResult);
        setSelectedScanImage(image ?? null);
        setLatestAiDebugMetadata({
          aiSource: 'fallback_ai',
          fallbackReason: 'mobile_api_unavailable',
          confidence: defaultScanResult.confidence,
        });
      });
  };

  const takePhoto = () => {
    useMockScan('camera', createPlaceholderImage('camera'));
  };

  const uploadFromPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (result.canceled || result.assets.length === 0) {
        uiLog('ScanScreen', 'photo_picker_cancelled');
        useMockScan('photos', createPlaceholderImage('photos'));
        return;
      }

      useMockScan('photos', getImageMetadata(result.assets[0], 'photos'));
    } catch (error) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: error instanceof Error ? error.message : 'Image picker failed.',
        screen: 'ScanScreen',
        source: 'photos',
      });
      uiLog('ScanScreen', 'photo_picker_fallback');
      useMockScan('photos', createPlaceholderImage('photos'));
    }
  };

  return (
    <ScreenScaffold
      title="Scan a meal"
      body="Take a photo or choose one from your library. Okyo will estimate the homemade dupe and savings."
    >
      <View style={styles.cameraCard}>
        <Text style={styles.cameraIcon}>OK</Text>
        <Text style={styles.cameraText}>Mock scan ready</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton onPress={takePhoto}>Take Photo</PrimaryButton>
        <SecondaryButton onPress={uploadFromPhotos}>Upload From Photos</SecondaryButton>
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
  return {
    fileName: asset.fileName ?? undefined,
    height: asset.height,
    mimeType: asset.mimeType ?? undefined,
    placeholder: false,
    sizeBytes: asset.fileSize ?? undefined,
    source,
    uri: asset.uri,
    width: asset.width,
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
