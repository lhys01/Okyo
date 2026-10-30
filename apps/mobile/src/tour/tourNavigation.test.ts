import assert from 'node:assert/strict';
import test from 'node:test';

import { getTourNavigationTarget } from './tourNavigation';

test('Grocery and Liked are dispatched through the root MainTabs route, never as root routes', () => {
  assert.deepEqual(getTourNavigationTarget('GroceryListScreen'), { name: 'MainTabs', params: { screen: 'GroceryListScreen' } });
  assert.deepEqual(getTourNavigationTarget('LibraryScreen'), { name: 'MainTabs', params: { screen: 'LibraryScreen' } });
});

test('Home uses the same canonical nested route and a targetless step does not navigate', () => {
  assert.deepEqual(getTourNavigationTarget('HomeScreen'), { name: 'MainTabs', params: { screen: 'HomeScreen' } });
  assert.equal(getTourNavigationTarget(null), null);
});
