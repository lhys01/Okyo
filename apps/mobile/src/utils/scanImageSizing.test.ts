import assert from 'node:assert/strict';
import test from 'node:test';

import { getScanImageResize } from './scanImageSizing';

test('bounds portrait photos by height while preserving aspect ratio', () => {
  assert.deepEqual(getScanImageResize(1179, 2556, 1280), { height: 1280 });
});

test('bounds wide photos by width while preserving aspect ratio', () => {
  assert.deepEqual(getScanImageResize(4000, 1200, 1280), { width: 1280 });
});

test('does not resize square or already-small images', () => {
  assert.equal(getScanImageResize(1024, 1024, 1280), null);
  assert.equal(getScanImageResize(800, 1200, 1280), null);
});
