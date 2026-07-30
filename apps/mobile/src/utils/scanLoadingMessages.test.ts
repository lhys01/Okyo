import assert from 'node:assert/strict';
import test from 'node:test';

import { FIRST_SCAN_STATUS_MESSAGE, SCAN_STATUS_MESSAGE_POOL, createDescriptionStatusSequence, createScanStatusSequence, createStatusSequenceForScan } from './scanLoadingMessages';

test('each scan starts with the exact identifying message', () => {
  assert.equal(FIRST_SCAN_STATUS_MESSAGE, 'Identifying the dish');
  assert.equal(createScanStatusSequence(() => 0)[0], FIRST_SCAN_STATUS_MESSAGE);
});

test('each scan randomizes 99 remaining messages without repeats', () => {
  const sequence = createScanStatusSequence(() => 0.5);

  assert.equal(SCAN_STATUS_MESSAGE_POOL.length, 99);
  assert.equal(sequence.length, 100);
  assert.equal(new Set(sequence).size, 100);
  assert.deepEqual(new Set(sequence.slice(1)), new Set(SCAN_STATUS_MESSAGE_POOL));
});

test('description scans use a compact recipe-construction sequence', () => {
  assert.deepEqual(createDescriptionStatusSequence(() => 0), [
    'Understanding your idea',
    'Building the ingredient list',
    'Estimating servings',
    'Shaping the recipe',
    'Checking the steps',
  ]);
});

test('loading sequence source changes never leak the previous flow first message', () => {
  assert.equal(createStatusSequenceForScan('description', () => 0)[0], 'Understanding your idea');
  assert.equal(createStatusSequenceForScan('photos', () => 0)[0], 'Identifying the dish');
  assert.equal(createStatusSequenceForScan('camera', () => 0)[0], 'Identifying the dish');
});

test('a new session can create a newly shuffled sequence for the same source', () => {
  const firstSession = createStatusSequenceForScan('camera', () => 0);
  const secondSession = createStatusSequenceForScan('camera', () => 0.5);

  assert.equal(firstSession[0], 'Identifying the dish');
  assert.equal(secondSession[0], 'Identifying the dish');
  assert.notDeepEqual(firstSession, secondSession);
});
