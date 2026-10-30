import assert from 'node:assert/strict';
import test from 'node:test';

import { canCommitScanResult, createScanCancellation } from './scanCancellation';

test('a cancelled scan aborts its request and cannot commit a late result', () => {
  const cancellation = createScanCancellation();
  let abortEvents = 0;
  cancellation.signal.addEventListener('abort', () => { abortEvents += 1; });

  assert.equal(canCommitScanResult({
    activeScanSessionId: 'scan-1',
    incomingScanSessionId: 'scan-1',
    signal: cancellation.signal,
  }), true);

  cancellation.cancel();

  assert.equal(cancellation.signal.aborted, true);
  assert.equal(abortEvents, 1);
  assert.equal(canCommitScanResult({
    activeScanSessionId: 'scan-1',
    incomingScanSessionId: 'scan-1',
    signal: cancellation.signal,
  }), false);
});

test('a result from an older scan session cannot commit to a newer active session', () => {
  const cancellation = createScanCancellation();

  assert.equal(canCommitScanResult({
    activeScanSessionId: 'scan-2',
    incomingScanSessionId: 'scan-1',
    signal: cancellation.signal,
  }), false);
});
