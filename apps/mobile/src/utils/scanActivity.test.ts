import assert from 'node:assert/strict';
import test from 'node:test';

import { clearScanActivity, getScanActivitySnapshot, setScanActivity } from './scanActivity';

test('scan activity is session-scoped and an older completion cannot clear the newer phase', () => {
  setScanActivity('scan-one', 'preparing');
  setScanActivity('scan-two', 'uploading');
  clearScanActivity('scan-one');

  assert.deepEqual(getScanActivitySnapshot(), { scanSessionId: 'scan-two', phase: 'uploading' });
  clearScanActivity('scan-two');
  assert.equal(getScanActivitySnapshot(), null);
});
