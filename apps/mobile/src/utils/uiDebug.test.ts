import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeImageTraceFields } from './uiDebug';

test('image diagnostics keep safe stage flags but never return paths, filenames, IDs, or error text', () => {
  const safe = sanitizeImageTraceFields({
    stage: 'picker_asset_received',
    source: 'photos',
    fileExists: true,
    usingFallback: false,
    uri: 'file:///private/photo.jpg',
    imageUri: 'file:///private/photo.jpg',
    fileName: 'personal-photo.jpg',
    scanSessionId: 'internal-session-id',
    error: 'failed to load file:///private/photo.jpg',
  });

  assert.deepEqual(safe, {
    stage: 'picker_asset_received',
    source: 'photos',
    fileExists: true,
    usingFallback: false,
  });
});
