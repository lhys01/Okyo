import assert from 'node:assert/strict';
import test from 'node:test';

import { PRIMARY_TABS } from './primaryTabs';

test('V1 exposes exactly four primary tabs in the approved order', () => {
  assert.deepEqual(PRIMARY_TABS.map((tab) => tab.title), ['Home', 'Grocery', 'Saved', 'Settings']);
  assert.equal(PRIMARY_TABS.length, 4);
});
