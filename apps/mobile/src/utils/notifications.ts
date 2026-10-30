import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { resolveGroceryReminderAction } from './groceryReminderDecision';
import { shouldLoadNotifications } from './notificationRuntime';

export const GROCERY_REMINDER_ID = 'okyo-grocery-reminder';
export const COOKING_REMINDER_ID = 'okyo-cooking-step-reminder';

type NotificationsModule = typeof import('expo-notifications');
let notificationsModulePromise: Promise<NotificationsModule> | null = null;
let notificationHandlerConfigured = false;

/**
 * expo-notifications evaluates its device-token auto-registration module as a
 * side effect of the package import. That module reads iOS Keychain state,
 * which is unavailable on a Simulator and can surface as a red-screen error.
 * Keep the import lazy and skip it on simulators while preserving the normal
 * permission/token flow on physical devices.
 */
export function canUseDeviceNotifications(): boolean {
  return shouldLoadNotifications(Platform.OS, Device.isDevice);
}

export function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!canUseDeviceNotifications()) return Promise.resolve(null);
  notificationsModulePromise ??= import('expo-notifications').then((notifications) => {
    if (!notificationHandlerConfigured) {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      notificationHandlerConfigured = true;
    }
    return notifications;
  });
  return notificationsModulePromise;
}

/** Schedules one local alert for the estimated end of the active step. */
export async function syncCookingStepReminder(input: {
  enabled: boolean;
  stepTitle?: string;
  remainingSeconds?: number;
}): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  let permissionGranted = false;
  try {
    permissionGranted = (await Notifications.getPermissionsAsync()).granted === true;
  } catch {
    permissionGranted = false;
  }

  if (!input.enabled || !permissionGranted || !input.stepTitle || !input.remainingSeconds) {
    await Notifications.cancelScheduledNotificationAsync(COOKING_REMINDER_ID).catch(() => undefined);
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(COOKING_REMINDER_ID).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: COOKING_REMINDER_ID,
    content: {
      title: 'Time to check your step',
      body: `The estimated time for ${input.stepTitle} is up. Check if it’s ready.`,
      data: { kind: 'cooking-step-timer' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.ceil(input.remainingSeconds)),
    },
  }).catch(() => undefined);
}

export async function clearCookingStepReminder(): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(COOKING_REMINDER_ID).catch(() => undefined);
}

// ponytail: fixed 4h delay, and we only (re)arm it when none of ours is
// already pending — so adding a second recipe to the list doesn't keep
// pushing the reminder out. Swap the trigger for a calendar "next 9am"
// type if product wants a fixed time of day.
const GROCERY_REMINDER_DELAY_SECONDS = 4 * 60 * 60;

// Keeps the local grocery reminder in step with the world: schedules one when
// the user has an unfinished list and opted in, cancels it once that stops
// being true. Never prompts for permission — a denied/undetermined permission
// simply means no reminder. All expo calls are guarded so a missing native
// module (tests, web) is a no-op rather than a throw.
export async function syncGroceryReminder(input: {
  hasGroceryItems: boolean;
  remindersEnabled: boolean;
}): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  let permissionGranted = false;
  try {
    const status = await Notifications.getPermissionsAsync();
    permissionGranted = status.granted === true;
  } catch {
    permissionGranted = false;
  }

  let alreadyScheduled = false;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    alreadyScheduled = scheduled.some((entry) => entry.identifier === GROCERY_REMINDER_ID);
  } catch {
    alreadyScheduled = false;
  }

  const action = resolveGroceryReminderAction({
    hasGroceryItems: input.hasGroceryItems,
    remindersEnabled: input.remindersEnabled,
    permissionGranted,
    alreadyScheduled,
  });

  if (action === 'cancel') {
    await Notifications.cancelScheduledNotificationAsync(GROCERY_REMINDER_ID).catch(() => undefined);
    return;
  }

  if (action === 'schedule') {
    await Notifications.scheduleNotificationAsync({
      identifier: GROCERY_REMINDER_ID,
      content: {
        title: 'Your Okyo grocery list is waiting',
        body: 'Grab what you need and knock out that recipe.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: GROCERY_REMINDER_DELAY_SECONDS,
      },
    }).catch(() => undefined);
  }
}

/** Removes the only local notification Okyo schedules when local data is erased. */
export async function clearGroceryReminder(): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(GROCERY_REMINDER_ID).catch(() => undefined);
}
