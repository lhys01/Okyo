import * as Notifications from 'expo-notifications';

const OKYO_DAILY_REMINDER_ID = 'okyo-daily-reminder';

// Schedule a daily 6pm local notification reminding the user to cook.
// Silently does nothing if permission is denied.
export async function scheduleOkyoDailyReminder(): Promise<void> {
  const response = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  if ((response as any).granted !== true) {
    return;
  }

  // Cancel any existing reminder before re-scheduling to stay idempotent.
  await Notifications.cancelScheduledNotificationAsync(OKYO_DAILY_REMINDER_ID).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    identifier: OKYO_DAILY_REMINDER_ID,
    content: {
      title: 'What are you eating tonight? 🍳',
      body: 'Scan it and recreate it at home for way less.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 0,
    },
  });
}
