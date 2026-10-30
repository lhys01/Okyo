import { syncGroceryReminder } from '../utils/notifications';
import { readNotificationPreferences } from './notificationPreferences';
import { useOkyoStore } from './useOkyoStore';

// Bridges app state -> the local grocery reminder. Notification preferences
// live in AsyncStorage (not the store), so the settings screen calls
// `resyncGroceryReminderNow()` after a change; the store subscription below
// covers the list itself going empty / non-empty.

async function runSync(): Promise<void> {
  const hasGroceryItems = (useOkyoStore.getState().groceryRecipeIds ?? []).length > 0;
  const prefs = await readNotificationPreferences();
  await syncGroceryReminder({
    hasGroceryItems,
    remindersEnabled: prefs.allowNotifications && prefs.groceryReminders,
  });
}

let lastHasItems: boolean | null = null;

export function startGroceryReminderSync(): () => void {
  lastHasItems = (useOkyoStore.getState().groceryRecipeIds ?? []).length > 0;
  void runSync();

  return useOkyoStore.subscribe((state) => {
    const hasItems = (state.groceryRecipeIds ?? []).length > 0;
    if (hasItems !== lastHasItems) {
      lastHasItems = hasItems;
      void runSync();
    }
  });
}

export function resyncGroceryReminderNow(): void {
  void runSync();
}
