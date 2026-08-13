import assert from 'node:assert/strict';
import test from 'node:test';

import { getSplashMarkSize, SPLASH_MARK_MAX_WIDTH } from './splashLayout';

test('splash mascot is responsive, centered by its parent, and capped on large phones', () => {
  const small = getSplashMarkSize(375);
  const standard = getSplashMarkSize(393);
  const large = getSplashMarkSize(430);
  const tablet = getSplashMarkSize(1024);

  assert.equal(small.width, 375 * 0.24);
  assert.equal(standard.width, 393 * 0.24);
  assert.equal(large.width, SPLASH_MARK_MAX_WIDTH);
  assert.equal(tablet.width, SPLASH_MARK_MAX_WIDTH);
  assert.ok(small.width < 143 && standard.width < 143 && large.width < 143);
  assert.equal(small.width / small.height, 143 / 132);
  assert.equal(standard.width / standard.height, 143 / 132);
});
