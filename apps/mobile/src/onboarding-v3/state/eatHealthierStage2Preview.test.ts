import test from 'node:test';
import assert from 'node:assert/strict';
import { isEatHealthierStage2PreviewEnabled } from './eatHealthierStage2Preview';
test('stage 2 health preview requires both development mode and explicit opt-in, and cannot be enabled by release builds', () => {
  assert.equal(isEatHealthierStage2PreviewEnabled(false, 'true'), false);
  assert.equal(isEatHealthierStage2PreviewEnabled(true, 'false'), false);
  assert.equal(isEatHealthierStage2PreviewEnabled(true, 'true'), true);
  assert.equal(isEatHealthierStage2PreviewEnabled(false, undefined), false);
});
