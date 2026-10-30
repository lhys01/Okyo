import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { useOkyoStore } from '../state/useOkyoStore';
import { requestPermissionWithNotice } from '../privacy/requestPermissionWithNotice';
import { preparePickedImage } from '../utils/scanImageProcessing';
import { createPickedImagePreview } from '../utils/scanImageReference';
import { startScan } from '../utils/scanController';
import { HOME_UPLOAD_TARGET_SCREEN, shouldStartPickedUpload } from '../utils/scanControllerUtils';
import { uiLog } from '../utils/uiDebug';

export type PickedScanSource = 'camera' | 'photos';

type Navigator = { navigate: (screen: string, params?: unknown) => void } | undefined;

/**
 * Starts a scan from the camera or the photo library.
 *
 * Extracted so the global Scan FAB and the Home first-use CTA share one
 * implementation — the CTA performs a real scan rather than a second, drifting
 * copy of the same flow.
 */
export function useStartPickedScan(navigator: Navigator, reasonPrefix = 'Home') {
  const inFlight = useRef(false);

  return useCallback(
    async (source: PickedScanSource) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        if (source === 'camera') {
          const permission = await requestPermissionWithNotice(
            'camera',
            ImagePicker.getCameraPermissionsAsync,
            ImagePicker.requestCameraPermissionsAsync,
          );
          if (permission !== 'granted') {
            uiLog(reasonPrefix, 'camera_permission_denied');
            if (permission === 'denied') {
              Alert.alert('Camera permission needed', 'You can allow camera access in Settings or use Upload instead.');
            }
            return;
          }
        }
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 });
        const assets = result.assets ?? [];
        if (!shouldStartPickedUpload(result.canceled, assets.length) || !assets[0]) return;
        const asset = assets[0];
        const image = createPickedImagePreview(asset, source);
        await startScan({
          image,
          prepareImage: () => preparePickedImage(asset, source),
          mode: useOkyoStore.getState().selectedMode,
          navigateToAnalysis: (scanSessionId) => navigator?.navigate(HOME_UPLOAD_TARGET_SCREEN, { scanSessionId }),
          reason: source === 'camera' ? `${reasonPrefix}.takePhoto` : `${reasonPrefix}.uploadPhoto`,
          source,
        });
      } catch {
        uiLog(reasonPrefix, source === 'camera' ? 'camera_open_failed' : 'photo_library_open_failed');
        Alert.alert(
          source === 'camera' ? 'Camera unavailable' : 'Photo upload unavailable',
          source === 'camera'
            ? 'Okyo could not open the camera. Use Upload instead.'
            : 'Okyo could not open your photo library. Try again.',
        );
      } finally {
        inFlight.current = false;
      }
    },
    [navigator, reasonPrefix],
  );
}
