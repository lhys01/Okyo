import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCoverImageFrame,
  mapNormalizedRect,
  onboarding2HitTargets,
  ONBOARDING2_SOURCE_SIZE,
} from './onboarding2Layout';

test('approved onboarding2 source dimensions are explicit and immutable', () => {
  assert.deepEqual(ONBOARDING2_SOURCE_SIZE, { width: 852, height: 1847 });
  assert.equal(Object.isFrozen(ONBOARDING2_SOURCE_SIZE), true);
  assert.equal(Object.isFrozen(onboarding2HitTargets), true);
});

test('cover layout fills standard, small, and large iPhones without letterboxing', () => {
  for (const container of [
    { width: 375, height: 667 },
    { width: 393, height: 852 },
    { width: 430, height: 932 },
  ]) {
    const frame = getCoverImageFrame(container.width, container.height);
    assert.ok(frame.left <= container.width);
    assert.ok(frame.top <= container.height);
    assert.ok(frame.left + frame.width >= container.width - Number.EPSILON);
    assert.ok(frame.top + frame.height >= container.height - Number.EPSILON);
    assert.ok(Math.abs(frame.width / frame.height - 852 / 1847) < 0.000001);
  }
});

test('cover scale and centered crop offsets use deterministic source geometry', () => {
  const frame = getCoverImageFrame(393, 852);
  const scale = Math.max(393 / 852, 852 / 1847);
  assert.equal(frame.width, 852 * scale);
  assert.equal(frame.height, 1847 * scale);
  assert.equal(frame.left, (393 - frame.width) / 2);
  assert.equal(frame.top, (852 - frame.height) / 2);
  assert.ok(frame.top >= 0);
  const seFrame = getCoverImageFrame(375, 667);
  assert.ok(seFrame.top < 0, 'SE crops vertically instead of letterboxing horizontally');
  assert.ok(Math.abs(frame.top) < 0.000001);
});

test('native hit targets map from normalized source coordinates into the rendered image frame', () => {
  const frame = getCoverImageFrame(393, 852);
  const mapped = mapNormalizedRect(frame, onboarding2HitTargets.getStarted);
  assert.equal(mapped.left, frame.left + frame.width * onboarding2HitTargets.getStarted.x);
  assert.equal(mapped.top, frame.top + frame.height * onboarding2HitTargets.getStarted.y);
  assert.equal(mapped.width, frame.width * onboarding2HitTargets.getStarted.width);
  assert.equal(mapped.height, frame.height * onboarding2HitTargets.getStarted.height);
  assert.equal(mapped.left, frame.left + frame.width * onboarding2HitTargets.getStarted.x);
  assert.equal(mapped.top, frame.top + frame.height * onboarding2HitTargets.getStarted.y);
});

test('all normalized overlays stay within the source image and retain useful touch height', () => {
  const smallFrame = getCoverImageFrame(375, 667);
  for (const rect of Object.values(onboarding2HitTargets)) {
    assert.ok(rect.x >= 0 && rect.y >= 0);
    assert.ok(rect.x + rect.width <= 1);
    assert.ok(rect.y + rect.height <= 1);
    assert.ok(mapNormalizedRect(smallFrame, rect).height >= 44);
  }
});
