import * as FileSystem from 'expo-file-system/legacy';
import { Paths } from 'expo-file-system';

import type { ScanImageMetadata } from '../api/types';
import { measureMobileScanStage } from './scanTelemetry';

// Copies a real user scan photo from the OS cache to the app's permanent
// Documents directory so the image survives cold restarts and cache eviction.
// Returns the original image unchanged if the copy fails or is unnecessary.
export async function copyToDocuments(
  image: ScanImageMetadata,
  options: { requestId?: string } = {},
): Promise<ScanImageMetadata> {
  if (
    image.placeholder ||
    !image.uri ||
    !image.uri.startsWith('file:') ||
    image.uri.includes('/okyo-scan-images/')
  ) {
    return image;
  }

  try {
    const copy = async () => {
      const dir = `${Paths.document.uri}okyo-scan-images/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const ext = image.mimeType === 'image/png' ? 'png' : 'jpg';
      const permanentUri = `${dir}scan-${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: image.uri!, to: permanentUri });
      return { ...image, uri: permanentUri };
    };
    return options.requestId
      ? await measureMobileScanStage(options.requestId, 'image_copy', copy)
      : await copy();
  } catch {
    return image;
  }
}
