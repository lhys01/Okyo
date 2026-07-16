import assert from 'node:assert/strict';
import test from 'node:test';

import { getUploadFailureReasonFromError } from './scanErrorMessage.js';

test('authenticated quota denial has stable user-facing copy', () => {
  const message = getUploadFailureReasonFromError(apiError(
    'scan_limit_reached',
    'internal cap detail must not be shown',
    429,
  ));
  assert.equal(message, 'Okyo has reached its daily scan limit. Try again tomorrow.');
});

test('sanitized quota infrastructure failure has retry-friendly copy', () => {
  const message = getUploadFailureReasonFromError(apiError(
    'capacity_unavailable',
    'database detail must not be shown',
    503,
  ));
  assert.equal(message, 'Okyo could not reach the scanner. Please try again in a moment.');
});

test('existing rate-limit and generic scan failures remain supported', () => {
  assert.equal(
    getUploadFailureReasonFromError(apiError('rate_limit_exceeded', 'rate limited', 429)),
    'Too many scan requests. Please wait a moment before trying again.',
  );
  assert.equal(
    getUploadFailureReasonFromError(new Error('Failed to fetch')),
    'Okyo could not reach the scanner. Check the API server and try again.',
  );
});

test('mobile timeout and connection failures have distinct honest copy', () => {
  assert.equal(
    getUploadFailureReasonFromError(Object.assign(new Error('timed out'), {
      name: 'ScanRequestTimeoutError',
    })),
    'This scan took too long. Try again with a clear, well-lit food photo.',
  );
  assert.equal(
    getUploadFailureReasonFromError(Object.assign(new Error('offline'), {
      name: 'ScanConnectionError',
    })),
    'Okyo could not reach the scanner. Check your connection and try again.',
  );
});

test('server scan deadline uses the timeout copy', () => {
  assert.equal(
    getUploadFailureReasonFromError(apiError('scan_timeout', 'internal timeout detail', 504)),
    'This scan took too long. Try again with a clear, well-lit food photo.',
  );
});

function apiError(code: string, message: string, httpStatus: number) {
  return Object.assign(new Error(message), { name: 'ApiError', code, httpStatus });
}
