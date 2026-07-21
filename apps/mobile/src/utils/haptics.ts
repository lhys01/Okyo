import * as Haptics from 'expo-haptics';

// Central haptics vocabulary. Every meaningful tap gets acknowledged, but the
// grammar stays small so feedback reads as intentional:
//   tap      — ordinary presses and selections
//   confirm  — meaningful confirmations (save, add to grocery, start cooking)
//   success  — real completion moments (recipe done, share sent)
//   warning  — recoverable problems the user should notice
// All helpers swallow errors: haptics must never break an interaction, and on
// devices/settings without haptics these calls are silent no-ops.

function fireAndForget(promise: Promise<void>) {
  promise.catch(() => {
    // Haptics unavailable (simulator, disabled in settings) — intentionally silent.
  });
}

export const haptics = {
  tap() {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  confirm() {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  success() {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning() {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  selection() {
    fireAndForget(Haptics.selectionAsync());
  },
};
