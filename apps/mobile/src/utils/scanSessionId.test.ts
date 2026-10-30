import assert from 'node:assert/strict';
import test from 'node:test';

import { createScanSessionId } from './scanSessionId';

test('createScanSessionId includes the source', () => {
  assert.match(createScanSessionId('camera'), /^scan-camera-/);
  assert.match(createScanSessionId('photos'), /^scan-photos-/);
  assert.match(createScanSessionId('description'), /^scan-description-/);
});

test('createScanSessionId produces a unique id on every call (retry never reuses the failed session id)', () => {
  const ids = new Set(Array.from({ length: 50 }, () => createScanSessionId('camera')));
  assert.equal(ids.size, 50);
});
