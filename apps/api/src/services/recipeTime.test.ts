import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveRecipeStepTime, deriveRecipeTimeline, hasUnspecifiedPassiveWait } from './recipeTime.js';

test('hour-long passive steps retain elapsed time separately from active time', () => {
  assert.deepEqual(deriveRecipeStepTime('Refrigerate the dough for 1 hour.', 1), { activeMinutes: 0, passiveMinutes: 60, elapsedMinutes: 60 });
  assert.deepEqual(deriveRecipeStepTime('Marinate for 2 hours.'), { activeMinutes: 0, passiveMinutes: 120, elapsedMinutes: 120 });
  assert.deepEqual(deriveRecipeStepTime('Let the croissants rise for 1 hour.', 1), { activeMinutes: 0, passiveMinutes: 60, elapsedMinutes: 60 });
  assert.deepEqual(deriveRecipeStepTime('Let rise for 45–60 minutes.'), { activeMinutes: 0, passiveMinutes: 53, elapsedMinutes: 53 });
});

test('repeated chilling periods are multiplied by the stated repeat count', () => {
  const time = deriveRecipeStepTime('Repeat this process 3 times, chilling for 30 minutes between each fold.', 30);
  assert.equal(time.activeMinutes, 0);
  assert.equal(time.passiveMinutes, 90);
  assert.equal(time.elapsedMinutes, 90);
});

test('word and digit repetition forms count additional occurrences correctly', () => {
  assert.equal(deriveRecipeStepTime('Refrigerate for 30 minutes; repeat twice more.').elapsedMinutes, 90);
  assert.equal(deriveRecipeStepTime('Refrigerate for 30 minutes; repeat three more times.').elapsedMinutes, 120);
  assert.equal(deriveRecipeStepTime('Refrigerate for 30 minutes; repeat 2 more times.').elapsedMinutes, 90);
  assert.equal(deriveRecipeStepTime('Refrigerate for 30 minutes; repeat twice.').elapsedMinutes, 60);
  assert.equal(deriveRecipeStepTime('Refrigerate for 30 minutes; repeat for 3 total rounds.').elapsedMinutes, 90);
});

test('repetition does not multiply unrelated active durations', () => {
  const time = deriveRecipeStepTime('Mix for 5 minutes, refrigerate for 30 minutes, then repeat twice more.');
  assert.equal(time.activeMinutes, 5);
  assert.equal(time.passiveMinutes, 90);
  assert.equal(time.elapsedMinutes, 95);
});

test('valid structured timing remains authoritative for timeline aggregation', () => {
  const timeline = deriveRecipeTimeline([
    { text: 'Mix for 5 minutes.', activeMinutes: 5, passiveMinutes: 0, elapsedMinutes: 5 },
    { text: 'Refrigerate for 1 hour.', activeMinutes: 0, passiveMinutes: 60, elapsedMinutes: 60 },
  ]);
  assert.deepEqual(timeline, {
    times: [
      { activeMinutes: 5, passiveMinutes: 0, elapsedMinutes: 5 },
      { activeMinutes: 0, passiveMinutes: 60, elapsedMinutes: 60 },
    ],
    activeMinutes: 5,
    passiveMinutes: 60,
    elapsedMinutes: 65,
  });
});

test('croissant timeline cannot retain an impossible 79-minute total', () => {
  const timeline = deriveRecipeTimeline([
    { text: 'Refrigerate for 1 hour.', estimatedMinutes: 1 },
    { text: 'Repeat this process 3 times, chilling for 30 minutes between each fold.', estimatedMinutes: 30 },
    { text: 'Let rise for 1 hour.', estimatedMinutes: 1 },
    { text: 'Bake for 15–20 minutes.', estimatedMinutes: 18 },
  ]);
  assert.equal(timeline.elapsedMinutes, 228);
  assert.ok(Math.max(79, timeline.elapsedMinutes) > 79);
});

test('unattended baking is waiting rather than fake hands-on time', () => {
  assert.deepEqual(deriveRecipeStepTime('Bake for 15–20 minutes.', 18), { activeMinutes: 0, passiveMinutes: 18, elapsedMinutes: 18 });
  assert.deepEqual(deriveRecipeStepTime('Bake unattended for 18 minutes.'), { activeMinutes: 0, passiveMinutes: 18, elapsedMinutes: 18 });
});

test('active stovetop work and supervised baking remain hands-on or mixed', () => {
  assert.deepEqual(deriveRecipeStepTime('Stir continuously for 10 minutes.'), { activeMinutes: 10, passiveMinutes: 0, elapsedMinutes: 10 });
  assert.deepEqual(deriveRecipeStepTime('Sear for 4 minutes per side.'), { activeMinutes: 8, passiveMinutes: 0, elapsedMinutes: 8 });
  assert.deepEqual(deriveRecipeStepTime('Bake for 30 minutes, rotating the pan halfway through.'), { activeMinutes: 2, passiveMinutes: 28, elapsedMinutes: 30 });
});

test('repeated passive waits require an explicit duration', () => {
  for (const text of [
    'Repeat this process 3 times, chilling between folds.',
    'Repeat this process 3 times, chill between each fold.',
    'Repeat this process 3 times, refrigerate between folds.',
    'Repeat this process 3 times, rest between turns.',
    'Repeat this process 3 times, allow the dough to chill between rounds.',
  ]) {
    assert.equal(hasUnspecifiedPassiveWait(text), true, text);
  }
  assert.equal(hasUnspecifiedPassiveWait('Repeat this process 3 times, chilling for 30 minutes between folds.'), false);
});
