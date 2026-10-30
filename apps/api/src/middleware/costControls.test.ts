import assert from 'node:assert/strict';
import test from 'node:test';

import { AiDailyCapExceededError, reserveGlobalAiProviderCall, resetCostControlsForTests } from './costControls.js';

test('provider call reservation enforces the configured shared daily cap', async () => {
  const previous = process.env.AI_DAILY_REQUEST_CAP;
  process.env.AI_DAILY_REQUEST_CAP = '1';
  resetCostControlsForTests();
  try {
    await reserveGlobalAiProviderCall();
    await assert.rejects(reserveGlobalAiProviderCall(), AiDailyCapExceededError);
  } finally {
    resetCostControlsForTests();
    if (previous === undefined) delete process.env.AI_DAILY_REQUEST_CAP;
    else process.env.AI_DAILY_REQUEST_CAP = previous;
  }
});
