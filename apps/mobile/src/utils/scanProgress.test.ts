import assert from 'node:assert/strict';
import test from 'node:test';

import { getScanProgress, INITIAL_SCAN_PROGRESS_STATE, nextScanProgress } from './scanProgress';

test('progress does not reach 100 during server analysis', () => {
  assert.equal(getScanProgress({ hasPreparedImage: true, hasValidatedRecipe: false, status: 'pending' }), 0.62);
  assert.equal(getScanProgress({ hasPreparedImage: true, hasValidatedRecipe: false, status: 'success' }), 0.32);
});

test('progress reaches 100 only after a validated successful response', () => {
  assert.equal(getScanProgress({ hasPreparedImage: true, hasValidatedRecipe: true, status: 'success' }), 1);
  assert.equal(getScanProgress({ hasPreparedImage: true, hasValidatedRecipe: true, status: 'partial' }), 0.32);
});

test('failed scans stop below completion', () => {
  assert.equal(getScanProgress({ hasPreparedImage: true, hasValidatedRecipe: false, status: 'failed' }), 0.86);
  assert.equal(getScanProgress({ hasPreparedImage: true, hasValidatedRecipe: false, status: 'rejected' }), 0.86);
});

// ─── nextScanProgress: monotonic, session-scoped progress ───────────────────

test('progress never decreases during one session', () => {
  const sessionId = 'session-1';
  let state = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: sessionId,
    status: 'pending',
  });
  assert.ok(state.value > 0);

  // A later update reporting a "lower" raw target (e.g. a stale re-render)
  // must not pull the animated value backwards.
  const regressed = nextScanProgress({
    hasPreparedImage: false,
    hasValidatedRecipe: false,
    previous: state,
    scanSessionId: sessionId,
    status: 'pending',
  });
  assert.ok(regressed.value >= state.value);
});

test('progress never loops back to 0 mid-session', () => {
  const sessionId = 'session-2';
  let state = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: sessionId,
    status: 'pending',
  });

  for (let i = 0; i < 5; i += 1) {
    state = nextScanProgress({
      hasPreparedImage: true,
      hasValidatedRecipe: false,
      previous: state,
      scanSessionId: sessionId,
      status: 'pending',
    });
    assert.notEqual(state.value, 0);
  }
});

test('rotating status messages do not reset progress (same session, same inputs)', () => {
  const sessionId = 'session-3';
  const first = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: sessionId,
    status: 'pending',
  });

  // Message rotation does not touch scanSessionId/status/hasPreparedImage —
  // recomputing progress with the same session id must be a no-op.
  const afterMessageChange = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: first,
    scanSessionId: sessionId,
    status: 'pending',
  });
  assert.equal(afterMessageChange.value, first.value);
  assert.equal(afterMessageChange.scanSessionId, first.scanSessionId);
});

test('the same session does not recreate the progress animation', () => {
  const sessionId = 'session-4';
  const state = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: sessionId,
    status: 'pending',
  });
  const repeated = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: state,
    scanSessionId: sessionId,
    status: 'pending',
  });
  assert.deepEqual(repeated, state);
});

test('a new scanSessionId resets progress to 0 once', () => {
  const finished = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: true,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: 'session-5',
    status: 'success',
  });
  assert.equal(finished.value, 1);

  const retry = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: finished,
    scanSessionId: 'session-6',
    status: 'pending',
  });
  assert.equal(retry.scanSessionId, 'session-6');
  assert.ok(retry.value < finished.value);
});

test('failure freezes progress below completion', () => {
  const state = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: false,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: 'session-7',
    status: 'failed',
  });
  assert.equal(state.value, 0.86);
  assert.ok(state.value < 1);
});

test('a validated success reaches exactly 1, once', () => {
  const state = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: true,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: 'session-8',
    status: 'success',
  });
  assert.equal(state.value, 1);
});

test('pending progress is always capped below 1 even if a stale target claims completion', () => {
  const state = nextScanProgress({
    hasPreparedImage: true,
    hasValidatedRecipe: true,
    previous: INITIAL_SCAN_PROGRESS_STATE,
    scanSessionId: 'session-9',
    status: 'pending',
  });
  assert.ok(state.value < 1);
});
