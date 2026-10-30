import assert from 'node:assert/strict';
import test from 'node:test';

import {
  executeIdempotent,
  IdempotencyConflictError,
  clearUserIdempotencyCache,
  idempotencyScope,
  resetIdempotencyForTests,
} from './idempotency.js';
import { runWithRequestContext } from '../observability/requestContext.js';

test('joins a matching in-flight request rather than executing twice', async () => {
  resetIdempotencyForTests();
  let calls = 0;
  let release!: () => void;
  const operation = async () => {
    calls += 1;
    await new Promise<void>((resolve) => { release = resolve; });
    return { value: 'completed' };
  };
  const input = { key: 'scan_session_123', scope: 'anon:test', fingerprintSource: { dish: 'pasta' }, operation };
  const first = executeIdempotent(input);
  const second = executeIdempotent(input);
  release();
  assert.deepEqual(await first, { value: 'completed' });
  assert.deepEqual(await second, { value: 'completed' });
  assert.equal(calls, 1);
});

test('rejects an idempotency key reused with a different body', async () => {
  resetIdempotencyForTests();
  await executeIdempotent({
    key: 'scan_session_456',
    scope: 'anon:test',
    fingerprintSource: { dish: 'pasta' },
    operation: async () => 'first',
  });
  await assert.rejects(
    () => executeIdempotent({
      key: 'scan_session_456',
      scope: 'anon:test',
      fingerprintSource: { dish: 'ramen' },
      operation: async () => 'second',
    }),
    IdempotencyConflictError,
  );
});

test('account cleanup removes only that user’s short-lived idempotent result', async () => {
  resetIdempotencyForTests();
  let aCalls = 0;
  let bCalls = 0;
  const runFor = (owner: string, operation: () => Promise<string>) => runWithRequestContext(
    { requestId: `request-${owner}`, anonId: null, ownerKey: `user:${owner}` },
    () => executeIdempotent({
      key: 'same_request_key_123',
      scope: idempotencyScope(null, '127.0.0.1'),
      fingerprintSource: { scan: true },
      operation,
    }),
  );
  await runFor('delete-a', async () => { aCalls++; return 'a'; });
  await runFor('keep-b', async () => { bCalls++; return 'b'; });
  clearUserIdempotencyCache('delete-a');
  clearUserIdempotencyCache('delete-a');
  assert.equal(await runFor('delete-a', async () => { aCalls++; return 'a-new'; }), 'a-new');
  assert.equal(await runFor('keep-b', async () => { bCalls++; return 'b-new'; }), 'b');
  assert.equal(aCalls, 2);
  assert.equal(bCalls, 1);
});
