import type { ScanImageMetadata } from '../api/types';

export type ScanImageStorageDependencies = {
  copyFile: (from: string, to: string) => Promise<void>;
  ensureDirectory: (uri: string) => Promise<void>;
  getFileInfo: (uri: string) => Promise<{ exists: boolean; isDirectory?: boolean }>;
  managedDirectoryUri: string;
  now: () => number;
  uniqueSuffix: () => string;
};

export async function copyToManagedScanImages(
  image: ScanImageMetadata,
  dependencies: ScanImageStorageDependencies,
): Promise<ScanImageMetadata> {
  if (image.placeholder || !image.uri) return image;

  try {
    if (isManagedScanImageUri(image.uri, dependencies.managedDirectoryUri)) {
      const fileInfo = await dependencies.getFileInfo(image.uri);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        return image;
      }
    }

    await dependencies.ensureDirectory(dependencies.managedDirectoryUri);
    const ext = image.mimeType === 'image/png' ? 'png' : 'jpg';
    const permanentUri = `${ensureTrailingSlash(dependencies.managedDirectoryUri)}scan-${dependencies.now()}-${dependencies.uniqueSuffix()}.${ext}`;
    await dependencies.copyFile(image.uri, permanentUri);
    return { ...image, uri: permanentUri };
  } catch {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Okyo ImageTrace]', {
        stage: 'copyToDocuments_failed_fallback_to_processed_uri',
        hasSourceUri: Boolean(image.uri),
      });
    }
    return image;
  }
}

export function isManagedScanImageUri(uri: string, managedDirectoryUri: string): boolean {
  return uri.startsWith(ensureTrailingSlash(managedDirectoryUri));
}

export function isManagedScanImageOwnedBySession(uri: string, managedDirectoryUri: string, scanSessionId: string): boolean {
  return isManagedScanImageUri(uri, managedDirectoryUri) && uri.includes(`-${scanSessionId}.`);
}

function ensureTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}
