import assert from 'node:assert/strict';
import test from 'node:test';

import { consumeInitialScanAction, getScanSourceForInitialAction } from './scanEntry';

test('Home Upload consumes a fresh photo action and resets the route param', () => {
  const consumed = consumeInitialScanAction({ initialAction: 'photos' });

  assert.equal(consumed.action, 'photos');
  assert.equal(getScanSourceForInitialAction(consumed.action), 'photos');
  assert.equal(consumed.params?.initialAction, undefined);
});

test('Home Take photo consumes a fresh camera action and resets the route param', () => {
  const consumed = consumeInitialScanAction({ initialAction: 'camera' });

  assert.equal(consumed.action, 'camera');
  assert.equal(getScanSourceForInitialAction(consumed.action), 'camera');
  assert.equal(consumed.params?.initialAction, undefined);
});

test('a consumed initial action cannot run again after the route is reset', () => {
  const first = consumeInitialScanAction({ initialAction: 'photos' });
  const second = consumeInitialScanAction(first.params);

  assert.equal(second.action, null);
});

test('picker cancellation leaves no action that could reopen an old result', () => {
  const consumed = consumeInitialScanAction({ initialAction: 'photos' });

  assert.equal(consumed.params?.initialAction, undefined);
  assert.equal(consumeInitialScanAction(consumed.params).action, null);
});
