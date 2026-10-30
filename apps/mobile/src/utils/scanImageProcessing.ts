import type * as ImagePicker from 'expo-image-picker';
import type { ScanImageMetadata, ScanSource } from '../api/types';
import { getImageMetadata } from './imagePrep';

export async function preparePickedImage(asset: ImagePicker.ImagePickerAsset, source: ScanSource): Promise<ScanImageMetadata> {
  return getImageMetadata(asset, source);
}

// Required by the restored onboarding ScanInputScreen / FirstScanEntryScreen,
// which import this helper. Standalone (no error-class dependency).
export function getScanImageProcessingErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.name === 'ScanImageProcessingError' ? error.message : fallback;
}
