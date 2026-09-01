import { Alert } from 'react-native';

import { recordConsent } from './consentLedger';
import {
  permissionNotices,
  shouldShowPermissionNotice,
  type PermissionNoticeKind,
  type PermissionStatusLike,
} from './permissionNotices';

/**
 * Shows Okyo's own explanation, then — only if the user chooses to continue —
 * calls the OS permission request. The notice is presented exactly when the OS
 * prompt would appear for the first time (`shouldShowPermissionNotice`), so a
 * user who has already answered is never asked twice.
 *
 * `Alert.alert` is used deliberately instead of a custom modal: it is the
 * platform-native dialog, so VoiceOver announces it as an alert, Dynamic Type
 * applies, focus moves correctly, and both buttons are equally reachable
 * without Okyo re-implementing any of that. The refusal is a plain button of
 * the same weight as Continue — never a styled-down "no thanks".
 */
export type PermissionNoticeResult = 'granted' | 'denied' | 'declined_notice';

type Deps = {
  alert?: typeof Alert.alert;
  recordChoice?: typeof recordConsent;
};

export async function requestPermissionWithNotice(
  kind: PermissionNoticeKind,
  getStatus: () => Promise<PermissionStatusLike>,
  requestPermission: () => Promise<PermissionStatusLike>,
  deps: Deps = {},
): Promise<PermissionNoticeResult> {
  const alert = deps.alert ?? Alert.alert;
  const recordChoice = deps.recordChoice ?? recordConsent;
  const notice = permissionNotices[kind];

  let current: PermissionStatusLike | null = null;
  try {
    current = await getStatus();
  } catch {
    // Treat an unreadable status as "not yet asked" — showing the explanation
    // one extra time is the safe direction to fail in.
    current = null;
  }

  if (current?.granted) return 'granted';

  if (shouldShowPermissionNotice(current)) {
    const wantsToContinue = await new Promise<boolean>((resolve) => {
      alert(
        notice.title,
        notice.body,
        [
          { text: notice.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
          { text: notice.continueLabel, onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

    if (!wantsToContinue) {
      await recordChoice(kind, 'refused');
      return 'declined_notice';
    }
  }

  const result = await requestPermission();
  await recordChoice(kind, result.granted ? 'granted' : 'refused');
  return result.granted ? 'granted' : 'denied';
}
