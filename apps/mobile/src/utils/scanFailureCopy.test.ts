import assert from 'node:assert/strict';
import test from 'node:test';

import { getInlineFailureCopy, getScanFailureCategory } from './scanFailureCopy';

test('a hung request past the safety window always categorizes as a timeout', () => {
  assert.equal(
    getScanFailureCategory({ isTimeout: true, rejectionType: 'not_food', status: 'failed', usable: false }),
    'network_timeout',
  );
});

test('a network-flavored rejection reason categorizes as a timeout even without the timeout flag', () => {
  assert.equal(
    getScanFailureCategory({
      isTimeout: false,
      rejectionReason: 'Okyo could not reach the scanner. Check the API server and try again.',
      status: 'failed',
      usable: false,
    }),
    'network_timeout',
  );
});

test('rejection type maps directly to the matching category', () => {
  assert.equal(
    getScanFailureCategory({ isTimeout: false, rejectionType: 'not_food', status: 'rejected', usable: false }),
    'not_food',
  );
  assert.equal(
    getScanFailureCategory({ isTimeout: false, rejectionType: 'unclear_image', status: 'failed', usable: false }),
    'unclear_image',
  );
});

test('a partial status with no usable recipe is an unreliable result, not a generic failure', () => {
  assert.equal(
    getScanFailureCategory({ isTimeout: false, status: 'partial', usable: false }),
    'unreliable_result',
  );
});

test('a claimed success with no usable recipe is a malformed response', () => {
  assert.equal(
    getScanFailureCategory({ isTimeout: false, status: 'success', usable: false }),
    'malformed_response',
  );
});

test('a plain ai_failed rejection with no other signal falls back to generic', () => {
  assert.equal(
    getScanFailureCategory({ isTimeout: false, rejectionType: 'ai_failed', status: 'failed', usable: false }),
    'generic',
  );
});

test('inline failure copy never leaks provider names, codes, or raw errors', () => {
  const forbidden = /openrouter|railway|\b\d{3}\b|stack|status code/i;
  const categories = ['unclear_image', 'not_food', 'unreliable_result', 'network_timeout', 'malformed_response', 'generic'] as const;
  for (const category of categories) {
    const photoCopy = getInlineFailureCopy(category, false);
    const descriptionCopy = getInlineFailureCopy(category, true);
    assert.equal(forbidden.test(photoCopy.title), false, `${category} photo title leaked internals`);
    assert.equal(forbidden.test(photoCopy.body), false, `${category} photo body leaked internals`);
    assert.equal(forbidden.test(descriptionCopy.title), false, `${category} description title leaked internals`);
    assert.equal(forbidden.test(descriptionCopy.body), false, `${category} description body leaked internals`);
  }
});

test('description failure copy never uses photo-recognition language', () => {
  const photoWords = /\bphoto\b|\bimage\b|\bpicture\b/i;
  const categories = ['unclear_image', 'not_food', 'unreliable_result', 'network_timeout', 'malformed_response', 'generic'] as const;
  for (const category of categories) {
    const copy = getInlineFailureCopy(category, true);
    assert.equal(photoWords.test(copy.title), false, `${category} description title used photo language`);
  }
});
