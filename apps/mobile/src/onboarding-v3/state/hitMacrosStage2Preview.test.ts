import test from 'node:test';
import assert from 'node:assert/strict';
import { isHitMacrosStage2PreviewEnabled } from './hitMacrosStage2Preview';
test('stage 2 macros preview requires both development mode and explicit opt-in, and cannot be enabled by release builds', () => {
  assert.equal(isHitMacrosStage2PreviewEnabled(false, 'true'), false);
  assert.equal(isHitMacrosStage2PreviewEnabled(true, 'false'), false);
  assert.equal(isHitMacrosStage2PreviewEnabled(true, 'true'), true);
  assert.equal(isHitMacrosStage2PreviewEnabled(false, undefined), false);
});
