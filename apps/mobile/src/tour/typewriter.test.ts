import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFoxIntroduction } from './tourSteps';

import { completeTourTypewriter, getRevealedCharacterCount, getTourTypewriterDuration, TOUR_TYPEWRITER_MAX_MS, TOUR_TYPEWRITER_MIN_MS } from './typewriter';

test('a one-line tour message completes in the intended readable range', () => {
  const message = 'Tap a day to plan your week.';
  const duration = getTourTypewriterDuration(message);
  assert.ok(duration >= TOUR_TYPEWRITER_MIN_MS && duration <= 250, `${duration}ms should be about 150–250ms`);
});

test('a two-line tour message stays below the maximum duration', () => {
  const message = 'Tap + to scan, upload, or describe a dish.';
  assert.ok(getTourTypewriterDuration(message) <= TOUR_TYPEWRITER_MAX_MS);
  assert.ok(getTourTypewriterDuration(message) <= 400);
});

test('tapping the guide text immediately reveals the complete message', () => {
  const message = 'Recipes picked for you appear here.';
  assert.ok(getRevealedCharacterCount(message, 30) < message.length);
  assert.equal(completeTourTypewriter(message), message);
});

test('Reduce Motion reveals the full guide copy on its first frame', () => {
  const message = 'Save recipes here so they’re easy to find.';
  assert.equal(getRevealedCharacterCount(message, 0, true), message.length);
});

test('a later frame cannot reveal more than the active message length', () => {
  const message = buildFoxIntroduction();
  assert.equal(getRevealedCharacterCount(message, 9999), message.length);
});
