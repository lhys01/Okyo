import assert from 'node:assert/strict';
import test from 'node:test';

import { DESCRIPTION_LOADING_MESSAGES, IMAGE_LOADING_MESSAGES, pickLoadingMessage } from './loadingMessages';

test('image-mode loading always starts with "Identifying the dish" (retry restarts here)', () => {
  assert.equal(IMAGE_LOADING_MESSAGES[0], 'Identifying the dish');
  assert.equal(pickLoadingMessage(IMAGE_LOADING_MESSAGES, 0), 'Identifying the dish');
});

test('description-mode loading always starts with "Reading your idea"', () => {
  assert.equal(DESCRIPTION_LOADING_MESSAGES[0], 'Reading your idea');
  assert.equal(pickLoadingMessage(DESCRIPTION_LOADING_MESSAGES, 0), 'Reading your idea');
});

test('image message pool has close to 100 entries and every entry is non-empty', () => {
  assert.ok(IMAGE_LOADING_MESSAGES.length >= 90, `expected a large rotating pool, got ${IMAGE_LOADING_MESSAGES.length}`);
  for (const message of IMAGE_LOADING_MESSAGES) {
    assert.ok(message.trim().length > 0);
  }
});

test('description-mode messages never use image-recognition language', () => {
  const forbiddenWords = ['photo', 'image', 'picture', 'scan'];
  for (const message of DESCRIPTION_LOADING_MESSAGES) {
    const lower = message.toLowerCase();
    for (const word of forbiddenWords) {
      assert.ok(!lower.includes(word), `"${message}" should not contain "${word}"`);
    }
  }
});

test('pickLoadingMessage wraps around instead of throwing once the index exceeds the pool length', () => {
  const pool = ['a', 'b', 'c'];
  assert.equal(pickLoadingMessage(pool, 3), 'a');
  assert.equal(pickLoadingMessage(pool, 4), 'b');
  assert.equal(pickLoadingMessage(pool, 100), pool[100 % pool.length]);
});

test('pickLoadingMessage returns an empty string for an empty pool instead of throwing', () => {
  assert.equal(pickLoadingMessage([], 0), '');
});
