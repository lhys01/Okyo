import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { useOkyoStore } from '../state/useOkyoStore';
import { preparePickedImage } from '../utils/scanImageProcessing';
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
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            uiLog(reasonPrefix, 'camera_permission_denied');
            Alert.alert(
              'Camera permission needed',
              'Okyo needs camera permission to take a food photo. You can allow camera access in Settings or use Upload instead.',
            );
            return;
          }
        }
        if (source === 'photos') {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            uiLog(reasonPrefix, 'photo_library_permission_denied', { canAskAgain: permission.canAskAgain });
            Alert.alert(
              'Photo access needed',
              permission.canAskAgain
                ? 'Okyo needs photo access to choose a food photo. Allow access when prompted, then try again.'
                : 'Okyo needs photo access to choose a food photo. Enable Photos access for Okyo in iPhone Settings, then try again.',
            );
            return;
          }
        }
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, base64: false, mediaTypes: ['images'], quality: 1 });
        const assets = result.assets ?? [];
        if (!shouldStartPickedUpload(result.canceled, assets.length) || !assets[0]) return;
        const image = await preparePickedImage(assets[0], source);
        await startScan({
          image,
          mode: useOkyoStore.getState().selectedMode,
          navigateToAnalysis: (scanSessionId) => navigator?.navigate(HOME_UPLOAD_TARGET_SCREEN, { scanSessionId }),
          reason: source === 'camera' ? `${reasonPrefix}.takePhoto` : `${reasonPrefix}.uploadPhoto`,
          source,
        });
      } catch (error) {
        uiLog(reasonPrefix, source === 'camera' ? 'camera_open_failed' : 'photo_library_open_failed', { error: String(error) });
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
