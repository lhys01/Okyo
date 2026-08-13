import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIFICATION_PREFERENCES_KEY = 'okyo:notification-preferences:v1';

export type NotificationPreferences = {
  allowNotifications: boolean;
  cookingTimers: boolean;
  savedRecipeReminders: boolean;
  groceryReminders: boolean;
  weeklySavings: boolean;
  weeklyCooking: boolean;
  productUpdates: boolean;
  newFeatures: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = Object.freeze({
  allowNotifications: true,
  cookingTimers: true,
  savedRecipeReminders: false,
  groceryReminders: false,
  weeklySavings: false,
  weeklyCooking: false,
  productUpdates: false,
  newFeatures: false,
});

export async function readNotificationPreferences(): Promise<NotificationPreferences> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
  if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const value = JSON.parse(raw) as Partial<NotificationPreferences>;
    return Object.fromEntries(Object.entries(DEFAULT_NOTIFICATION_PREFERENCES).map(([key, fallback]) => [key, typeof value[key as keyof NotificationPreferences] === 'boolean' ? value[key as keyof NotificationPreferences] : fallback])) as NotificationPreferences;
  } catch { return { ...DEFAULT_NOTIFICATION_PREFERENCES }; }
}

export async function writeNotificationPreferences(value: NotificationPreferences) {
  await AsyncStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(value));
}
