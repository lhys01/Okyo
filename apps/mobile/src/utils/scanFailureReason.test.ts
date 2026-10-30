import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyScanErrorMessage,
  classifyScanFailure,
  classifyScanRejection,
  getScanFailureCopy,
} from './scanFailureReason';

test('classifyScanErrorMessage detects network/timeout errors', () => {
  assert.equal(classifyScanErrorMessage(new Error('Network request failed')), 'network_timeout');
  assert.equal(classifyScanErrorMessage(new Error('The request timed out')), 'network_timeout');
  assert.equal(classifyScanErrorMessage(new Error('Aborted')), 'network_timeout');
});

test('classifyScanErrorMessage falls back to malformed_response for unknown errors', () => {
  assert.equal(classifyScanErrorMessage(new Error('Unexpected token in JSON')), 'malformed_response');
  assert.equal(classifyScanErrorMessage('not an error object'), 'malformed_response');
});

test('classifyScanRejection maps rejectionType directly', () => {
  assert.equal(classifyScanRejection('not_food', undefined), 'not_food');
  assert.equal(classifyScanRejection('unclear_image', undefined), 'unclear_image');
});

test('classifyScanRejection reads reasonText for cases rejectionType cannot express', () => {
  assert.equal(classifyScanRejection('ai_failed', 'This photo was too large to scan.'), 'unclear_image');
  assert.equal(classifyScanRejection('ai_failed', 'Okyo could not reach the scanner. Check your connection.'), 'network_timeout');
  assert.equal(classifyScanRejection('ai_failed', 'Okyo could not build a reliable recipe from this photo.'), 'unreliable_result');
});

test('classifyScanRejection defaults unrecognized ai_failed reasons to malformed_response', () => {
  assert.equal(classifyScanRejection('ai_failed', 'Something unexpected happened.'), 'malformed_response');
});

test('classifyScanFailure prefers a live error over a stored failure', () => {
  const storedFailure = { rejectionType: 'not_food' as const, rejectionReason: 'not food' };
  assert.equal(classifyScanFailure(storedFailure, new Error('network request failed')), 'network_timeout');
});

test('classifyScanFailure with no failure and no error is malformed_response (safety-net timeout case)', () => {
  assert.equal(classifyScanFailure(null), 'malformed_response');
  assert.equal(classifyScanFailure(undefined), 'malformed_response');
});

test('getScanFailureCopy image mode uses the exact spec copy for every reason', () => {
  assert.deepEqual(getScanFailureCopy('unclear_image', 'image', 'Luna'), {
    title: 'Luna couldn’t read this one',
    body: 'Try a clearer photo with the whole dish visible.',
  });
  assert.deepEqual(getScanFailureCopy('not_food', 'image', 'Luna'), {
    title: 'Luna couldn’t read this one',
    body: 'This doesn’t look like a meal yet.',
  });
  assert.deepEqual(getScanFailureCopy('unreliable_result', 'image', 'Luna'), {
    title: 'Luna couldn’t read this one',
    body: 'Okyo couldn’t build a reliable recipe from this photo.',
  });
  assert.deepEqual(getScanFailureCopy('network_timeout', 'image', 'Luna'), {
    title: 'Luna couldn’t read this one',
    body: 'Okyo lost the connection. Try once more.',
  });
  assert.deepEqual(getScanFailureCopy('malformed_response', 'image', 'Luna'), {
    title: 'Luna couldn’t read this one',
    body: 'Okyo couldn’t finish this recipe. Try another photo.',
  });
});

test('getScanFailureCopy description mode never mentions photos or images', () => {
  const reasons = ['unclear_image', 'not_food', 'unreliable_result', 'network_timeout', 'malformed_response'] as const;
  for (const reason of reasons) {
    const copy = getScanFailureCopy(reason, 'description');
    const combined = `${copy.title} ${copy.body}`.toLowerCase();
    assert.ok(!combined.includes('photo'), `description-mode copy for ${reason} must not mention "photo": "${combined}"`);
    assert.ok(!combined.includes('image'), `description-mode copy for ${reason} must not mention "image": "${combined}"`);
  }
});

test('getScanFailureCopy defaults to image mode when no mode is given', () => {
  assert.equal(getScanFailureCopy('not_food').title, 'Your fox couldn’t read this one');
});
