import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRemainingScanMs,
  getScanDeadlineMs,
  ScanCancelledError,
  ScanDeadlineExceededError,
  throwIfScanCancelled,
  waitForScanDelay,
} from './scanDeadline.js';

test('scan deadline is bounded below the mobile timeout', () => {
  const previous = process.env.AI_SCAN_DEADLINE_MS;
  process.env.AI_SCAN_DEADLINE_MS = '999999';
  assert.equal(getScanDeadlineMs(), 58_000);
  process.env.AI_SCAN_DEADLINE_MS = '100';
  assert.equal(getScanDeadlineMs(), 5_000);
  if (previous === undefined) delete process.env.AI_SCAN_DEADLINE_MS;
  else process.env.AI_SCAN_DEADLINE_MS = previous;
});

test('throwIfScanCancelled preserves the server cancellation reason', () => {
  const controller = new AbortController();
  const reason = new ScanCancelledError();
  controller.abort(reason);
  assert.throws(() => throwIfScanCancelled(controller.signal), (error) => error === reason);
});

test('expired deadlines fail immediately', () => {
  assert.equal(getRemainingScanMs(Date.now() - 1), 0);
  assert.throws(
    () => throwIfScanCancelled(undefined, Date.now() - 1),
    ScanDeadlineExceededError,
  );
});

test('retry waits are cancellable', async () => {
  const controller = new AbortController();
  const waiting = waitForScanDelay(1_000, controller.signal);
  controller.abort(new ScanCancelledError());
  await assert.rejects(waiting, ScanCancelledError);
});
