import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addScanAggregateDuration,
  createScanAggregateTiming,
  getScanAggregateTimingEvent,
  logScanAggregateTiming,
  recordLogicalProviderCall,
  recordProviderAttempt,
  recordRepairReasons,
  setScanRecipeContract,
} from './scanTelemetry.js';

test('aggregate timing reports every required scan stage and provider count', () => {
  const timing = createScanAggregateTiming({
    requestId: 'scan-aggregate-test',
    startedAt: 1_000,
  });
  addScanAggregateDuration(timing, 'vision', 6_424);
  addScanAggregateDuration(timing, 'recipe', 10_827);
  addScanAggregateDuration(timing, 'repair', 2_100);
  addScanAggregateDuration(timing, 'persistence', 375);
  recordLogicalProviderCall(timing);
  recordLogicalProviderCall(timing);
  recordLogicalProviderCall(timing);
  recordProviderAttempt(timing);
  recordProviderAttempt(timing);
  recordProviderAttempt(timing);
  recordRepairReasons(timing, 'step_missing_time_or_completion_cue,step_uses_unlisted_ingredients');
  recordRepairReasons(timing, 'step_uses_unlisted_ingredients');
  setScanRecipeContract(timing, 'full-core-v2');

  assert.deepEqual(getScanAggregateTimingEvent(timing, 'success', 21_000), {
    requestId: 'scan-aggregate-test',
    visionMs: 6_424,
    recipeMs: 10_827,
    repairMs: 2_100,
    persistenceMs: 375,
    totalMs: 20_000,
    logicalProviderCalls: 3,
    providerAttempts: 3,
    recipeContract: 'full-core-v2',
    repairReasons: [
      'step_missing_time_or_completion_cue',
      'step_uses_unlisted_ingredients',
    ],
    status: 'success',
  });
});

test('aggregate timing emits exactly once with its request ID', () => {
  const originalLog = console.log;
  const events: unknown[][] = [];
  console.log = (...args: unknown[]) => { events.push(args); };
  try {
    const timing = createScanAggregateTiming({ requestId: 'scan-once-test' });
    logScanAggregateTiming(timing, 'success');
    logScanAggregateTiming(timing, 'failure');
  } finally {
    console.log = originalLog;
  }

  assert.equal(events.length, 1);
  assert.equal(events[0][0], '[scan_aggregate_timing]');
  assert.equal((events[0][1] as { requestId: string }).requestId, 'scan-once-test');
});
