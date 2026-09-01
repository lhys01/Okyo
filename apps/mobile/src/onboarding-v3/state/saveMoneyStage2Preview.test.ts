import test from 'node:test';
import assert from 'node:assert/strict';
import { isSaveMoneyStage2PreviewEnabled } from './saveMoneyStage2Preview';
test('stage 2 preview requires both development mode and explicit opt-in', () => {
  assert.equal(isSaveMoneyStage2PreviewEnabled(false, 'true'), false);
  assert.equal(isSaveMoneyStage2PreviewEnabled(true, 'false'), false);
  assert.equal(isSaveMoneyStage2PreviewEnabled(true, 'true'), true);
});
