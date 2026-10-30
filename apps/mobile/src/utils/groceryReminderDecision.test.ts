import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveGroceryReminderAction } from './groceryReminderDecision';

test('schedules only when wanted and nothing of ours is pending', () => {
  assert.equal(
    resolveGroceryReminderAction({ hasGroceryItems: true, remindersEnabled: true, permissionGranted: true, alreadyScheduled: false }),
    'schedule',
  );
  assert.equal(
    resolveGroceryReminderAction({ hasGroceryItems: true, remindersEnabled: true, permissionGranted: true, alreadyScheduled: true }),
    'noop',
  );
});

test('cancels a pending reminder once any precondition drops', () => {
  for (const drop of [
    { hasGroceryItems: false },
    { remindersEnabled: false },
    { permissionGranted: false },
  ]) {
    assert.equal(
      resolveGroceryReminderAction({ hasGroceryItems: true, remindersEnabled: true, permissionGranted: true, alreadyScheduled: true, ...drop }),
      'cancel',
    );
  }
});

test('does nothing when not wanted and nothing is pending', () => {
  assert.equal(
    resolveGroceryReminderAction({ hasGroceryItems: false, remindersEnabled: false, permissionGranted: false, alreadyScheduled: false }),
    'noop',
  );
});
