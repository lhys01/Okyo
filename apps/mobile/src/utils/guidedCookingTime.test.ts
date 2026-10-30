import assert from 'node:assert/strict';
import test from 'node:test';

import { formatFinishByTime, getRemainingGuidedCookingMinutes, hasUsableRecipeTimingData } from './guidedCookingTime';

test('remaining cooking time includes the active and upcoming steps and preserves a larger recipe total', () => {
  assert.equal(getRemainingGuidedCookingMinutes([5, 12, 7], 1, 30), 25);
  assert.equal(getRemainingGuidedCookingMinutes([5, 12, 7], 0, 10), 24);
});

test('remaining cooking time safely handles invalid estimates and indexes', () => {
  assert.equal(getRemainingGuidedCookingMinutes([4, Number.NaN, -2], 1, 8), 4);
  assert.equal(getRemainingGuidedCookingMinutes([4, 6], 20, 0), null);
  assert.equal(getRemainingGuidedCookingMinutes([], 0, Number.NaN), null);
  assert.equal(formatFinishByTime(Number.NaN, 12), 'Finish time unavailable');
  assert.equal(formatFinishByTime(Date.now(), null), 'Finish time unavailable');
});

test('finish-by time uses a fake clock and rolls over the hour and midnight', () => {
  const lateEvening = new Date(2026, 8, 27, 23, 50, 0, 0).getTime();
  assert.equal(formatFinishByTime(lateEvening, 25), 'Finish by 12:15');

  const midday = new Date(2026, 8, 27, 11, 55, 0, 0).getTime();
  assert.equal(formatFinishByTime(midday, 30), 'Finish by 12:25');
});

test('recipe timing availability rejects missing or invalid durations', () => {
  assert.equal(hasUsableRecipeTimingData(null), false);
  assert.equal(hasUsableRecipeTimingData({ totalTimeMinutes: Number.NaN, steps: ['Mix ingredients.'] }), false);
  assert.equal(hasUsableRecipeTimingData({ structuredSteps: [{ text: 'Bake', elapsedMinutes: -1 }] }), false);
  assert.equal(hasUsableRecipeTimingData({ totalTimeMinutes: 24 }), true);
  assert.equal(hasUsableRecipeTimingData({ steps: ['Bake for 30 minutes.'] }), true);
  assert.equal(hasUsableRecipeTimingData({ structuredSteps: [{ text: 'Mix', timeEstimate: '5 min' }] }), true);
});
