import * as FileSystem from 'expo-file-system/legacy';
import { Paths } from 'expo-file-system';

import type { ScanImageMetadata } from '../api/types';
import { copyToManagedScanImages } from './scanImageStorageCore';

export {
  copyToManagedScanImages,
  isManagedScanImageUri,
} from './scanImageStorageCore';

// Copies a real user scan photo from the OS cache to the app's permanent
// Documents directory so the image survives cold restarts and cache eviction.
// Returns the original image unchanged if the copy fails or is unnecessary.
export async function copyToDocuments(image: ScanImageMetadata): Promise<ScanImageMetadata> {
  const managedDirectoryUri = `${Paths.document.uri}okyo-scan-images/`;
  return copyToManagedScanImages(image, {
    copyFile: (from, to) => FileSystem.copyAsync({ from, to }),
    ensureDirectory: (uri) => FileSystem.makeDirectoryAsync(uri, { intermediates: true }),
    getFileInfo: (uri) => FileSystem.getInfoAsync(uri),
    managedDirectoryUri,
    now: Date.now,
  });
}
