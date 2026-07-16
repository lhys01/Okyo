import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeRequestId } from './requestContext.js';

test('a valid mobile request ID remains canonical', () => {
  const requestId = 'scan-camera-1720000000000-abcd12';
  assert.equal(normalizeRequestId(requestId), requestId);
});

test('invalid request IDs are replaced without reflecting unsafe input', () => {
  const requestId = normalizeRequestId('bad request id with spaces');
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.notEqual(requestId, 'bad request id with spaces');
});
