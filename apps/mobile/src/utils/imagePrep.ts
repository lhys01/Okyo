import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import type { ScanImageMetadata, ScanSource } from '../api/types';
import { requestPermissionWithNotice } from '../privacy/requestPermissionWithNotice';
import { SANITIZED_SCAN_UPLOAD_FILE_NAME, sanitizeJpegBase64ForUpload } from './imageUploadPrivacy';
import { copyToDocuments } from './scanImageStorage';
import { uiLog } from './uiDebug';
import { getScanImageResize } from './scanImageSizing';

// A full camera frame can be 8–20 MB. Vision quality is retained at this
// resolution for a single plated dish while keeping mobile upload and API heap
// pressure bounded. This affects only the bytes sent to the scanner, never the
// visible preview retained on-device.
const maxImageDataUrlBytes = 2_500_000;
const maxProcessedImageDimension = 1280;

export type PickedImageOutcome =
  | { kind: 'picked'; image: ScanImageMetadata }
  | { kind: 'cancelled' }
  | { kind: 'permission_denied' }
  | { kind: 'unavailable' };

export async function captureFromCamera(): Promise<PickedImageOutcome> {
  try {
    const permission = await requestPermissionWithNotice(
      'camera',
      ImagePicker.getCameraPermissionsAsync,
      ImagePicker.requestCameraPermissionsAsync,
    );
    if (permission !== 'granted') {
      uiLog('imagePrep', 'camera_permission_denied');
      if (permission === 'denied') Alert.alert('Camera permission needed', 'You can allow camera access in Settings or upload a photo instead.');
      return { kind: 'permission_denied' };
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      uiLog('imagePrep', 'camera_cancelled');
      return { kind: 'cancelled' };
    }

    const image = await getImageMetadata(result.assets[0], 'camera');
    return { kind: 'picked', image: await copyToDocuments(image) };
  } catch {
    uiLog('imagePrep', 'camera_unavailable');
    Alert.alert(
      'Camera unavailable',
      'Camera isn’t available in this simulator. Try uploading a photo instead.',
    );
    return { kind: 'unavailable' };
  }
}

export async function pickFromLibrary(): Promise<PickedImageOutcome> {
  try {
    // The system picker grants access to the selected item, so Okyo does not
    // request broad photo-library permission.
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      uiLog('imagePrep', 'photo_picker_cancelled');
      return { kind: 'cancelled' };
    }

    const image = await getImageMetadata(result.assets[0], 'photos');
    return { kind: 'picked', image: await copyToDocuments(image) };
  } catch {
    uiLog('imagePrep', 'photo_picker_error');
    Alert.alert(
      'Photo upload unavailable',
      'Okyo could not open your photo library. Try again.',
    );
    return { kind: 'unavailable' };
  }
}

export async function getImageMetadata(asset: ImagePicker.ImagePickerAsset, source: ScanSource): Promise<ScanImageMetadata> {
  const processed = await getProcessedImage(asset);
  const dataUrl = getImageDataUrl(processed.base64, processed.mimeType);
  const dataUrlSizeBytes = dataUrl ? getUtf8SizeBytes(dataUrl) : undefined;
  const shouldSendDataUrl = Boolean(dataUrl && dataUrlSizeBytes !== undefined && dataUrlSizeBytes <= maxImageDataUrlBytes);

  return {
    fileName: getProcessedFileName(asset.fileName),
    height: processed.height ?? asset.height,
    mimeType: processed.mimeType,
    placeholder: false,
    sizeBytes: asset.fileSize ?? undefined,
    dataUrl: shouldSendDataUrl ? dataUrl : undefined,
    dataUrlSizeBytes,
    source,
    uri: processed.uri ?? asset.uri,
    width: processed.width ?? asset.width,
    conversionError: shouldSendDataUrl
      ? undefined
      : dataUrl
        ? 'image_payload_too_large'
        : processed.conversionError ?? 'image_base64_missing',
  };
}

type ProcessedImage = {
  base64?: string;
  height?: number;
  mimeType: string;
  uri?: string;
  width?: number;
  conversionError?: string;
};

// Progressively compresses/downsizes the photo until it fits under the API's
// payload limit. Real restaurant photos taken on modern phones routinely start
// well above that limit, so a single fixed compression pass isn't reliable.
async function getProcessedImage(asset: ImagePicker.ImagePickerAsset): Promise<ProcessedImage> {
  const attempts = [
    { compress: 0.78, maxDimension: maxProcessedImageDimension },
    { compress: 0.64, maxDimension: 1120 },
    { compress: 0.52, maxDimension: 960 },
    { compress: 0.42, maxDimension: 800 },
    { compress: 0.34, maxDimension: 680 },
    { compress: 0.28, maxDimension: 560 },
  ];
  let latestResult: ProcessedImage | null = null;

  for (const attempt of attempts) {
    try {
      const resize = getScanImageResize(asset.width, asset.height, attempt.maxDimension);
      const actions: ImageManipulator.Action[] = resize ? [{ resize }] : [];
      const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        base64: true,
        compress: attempt.compress,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const sanitizedBase64 = sanitizeJpegBase64ForUpload(result.base64);
      const dataUrl = getImageDataUrl(sanitizedBase64, 'image/jpeg');
      const dataUrlSizeBytes = dataUrl ? getUtf8SizeBytes(dataUrl) : undefined;

      latestResult = {
        // Only the sanitized bytes may move into the metadata object below;
        // that object is the source of the outbound `dataUrl`.
        base64: sanitizedBase64,
        height: result.height,
        mimeType: 'image/jpeg',
        uri: result.uri,
        width: result.width,
        conversionError: dataUrl ? undefined : result.base64 ? 'image_metadata_sanitization_failed' : 'image_base64_missing',
      };

      if (dataUrl && dataUrlSizeBytes !== undefined && dataUrlSizeBytes <= maxImageDataUrlBytes) {
        return latestResult;
      }
    } catch {
      latestResult = {
        height: asset.height,
        mimeType: asset.mimeType ?? getMimeTypeFromFileName(asset.fileName) ?? 'image/jpeg',
        uri: asset.uri,
        width: asset.width,
        conversionError: 'image_processing_failed',
      };
    }
  }

  return latestResult ?? {
    height: asset.height,
    mimeType: asset.mimeType ?? getMimeTypeFromFileName(asset.fileName) ?? 'image/jpeg',
    uri: asset.uri,
    width: asset.width,
    conversionError: 'image_processing_failed',
  };
}

export function getProcessedFileName(_fileName: string | null | undefined) {
  // Original camera and library filenames can be identifying. The scanner only
  // needs one generic name for its freshly encoded, sanitized JPEG payload.
  return SANITIZED_SCAN_UPLOAD_FILE_NAME;
}

export function getImageDataUrl(base64: string | null | undefined, mimeType: string) {
  const cleanBase64 = typeof base64 === 'string' ? base64.trim() : '';
  if (!cleanBase64) {
    return undefined;
  }

  return `data:${mimeType};base64,${cleanBase64}`;
}

export function getUtf8SizeBytes(value: string) {
  return value.length;
}

export function getMimeTypeFromFileName(fileName: string | null | undefined) {
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

export function getPreviewImageMetadata(image: ScanImageMetadata | undefined): ScanImageMetadata | null {
  if (!image) {
    return null;
  }

  const { dataUrl: _dataUrl, ...previewImage } = image;
  return previewImage;
}
