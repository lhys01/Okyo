import type { ScanImageMetadata } from '../api/types';

export type PickedImageAssetPreview = {
  uri: string;
  mimeType?: string | null;
  width: number;
  height: number;
};

/** A local-only preview contract, available before expensive image processing starts. */
export function createPickedImagePreview(
  asset: PickedImageAssetPreview,
  source: NonNullable<ScanImageMetadata['source']>,
): ScanImageMetadata {
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    width: asset.width,
    height: asset.height,
    source,
    placeholder: false,
  };
}

/**
 * Keep the device-owned preview reference separate from the privacy-sanitized
 * image metadata returned by the API. The API response cannot contain the
 * local URI because that path must never leave the device.
 */
export function getScanPreviewImageMetadata(
  localImage: ScanImageMetadata | null | undefined,
  apiImage?: ScanImageMetadata | null,
): ScanImageMetadata | null {
  const selected = hasUsableLocalImage(localImage)
    ? localImage
    : apiImage && !apiImage.placeholder
      ? apiImage
      : null;
  if (!selected) return null;

  const { dataUrl: _dataUrl, ...preview } = selected;
  return preview;
}

export function hasUsableLocalImage(image: ScanImageMetadata | null | undefined): image is ScanImageMetadata & { uri: string } {
  return Boolean(
    image &&
    !image.placeholder &&
    typeof image.uri === 'string' &&
    image.uri.trim().length > 0,
  );
}
