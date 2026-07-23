import * as FileSystem from 'expo-file-system/legacy';
import { Paths } from 'expo-file-system';

import type { ScanImageMetadata } from '../api/types';

// Copies a real user scan photo from the OS cache to the app's permanent
// Documents directory so the image survives cold restarts and cache eviction.
// Returns the original image unchanged if the copy fails or is unnecessary.
export async function copyToDocuments(image: ScanImageMetadata): Promise<ScanImageMetadata> {
  if (image.placeholder || !image.uri) return image;

  try {
    const dir = `${Paths.document.uri}okyo-scan-images/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = image.mimeType === 'image/png' ? 'png' : 'jpg';
    const permanentUri = `${dir}scan-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: image.uri, to: permanentUri });
    return { ...image, uri: permanentUri };
  } catch (error) {
    if (__DEV__) console.warn('[Okyo ImageTrace]', { stage: 'copyToDocuments_failed_fallback_to_processed_uri', uri: image.uri, error: String(error) });
    return image;
  }
}
