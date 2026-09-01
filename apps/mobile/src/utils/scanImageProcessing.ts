import * as ImageManipulator from 'expo-image-manipulator';
import type * as ImagePicker from 'expo-image-picker';
import type { ScanImageMetadata, ScanSource } from '../api/types';

export async function preparePickedImage(asset: ImagePicker.ImagePickerAsset, source: ScanSource): Promise<ScanImageMetadata> {
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    asset.width > 1400 ? [{ resize: { width: 1400 } }] : [],
    { base64: true, compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  );
  const mimeType = 'image/jpeg';
  const dataUrl = result.base64 ? `data:${mimeType};base64,${result.base64}` : undefined;
  return {
    dataUrl,
    dataUrlSizeBytes: dataUrl?.length,
    fileName: asset.fileName ?? `okyo-${Date.now()}.jpg`,
    height: result.height,
    mimeType,
    sizeBytes: asset.fileSize,
    source,
    uri: result.uri,
    width: result.width,
  };
}

// Required by the restored onboarding ScanInputScreen / FirstScanEntryScreen,
// which import this helper. Standalone (no error-class dependency).
export function getScanImageProcessingErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.name === 'ScanImageProcessingError' ? error.message : fallback;
}
