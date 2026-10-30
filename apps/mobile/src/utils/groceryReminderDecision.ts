// Pure decision for the local "you have an unfinished grocery list" reminder.
// Kept dependency-free so it is trivially testable; the expo-notifications IO
// lives in utils/notifications.ts.

export type GroceryReminderAction = 'schedule' | 'cancel' | 'noop';

export function resolveGroceryReminderAction(input: {
  hasGroceryItems: boolean;
  remindersEnabled: boolean;
  permissionGranted: boolean;
  alreadyScheduled: boolean;
}): GroceryReminderAction {
  const wanted = input.hasGroceryItems && input.remindersEnabled && input.permissionGranted;
  if (!wanted) {
    return input.alreadyScheduled ? 'cancel' : 'noop';
  }
  return input.alreadyScheduled ? 'noop' : 'schedule';
}
