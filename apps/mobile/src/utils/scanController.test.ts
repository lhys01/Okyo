import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getFreshDescribeMealResetState,
  getAnalysisScreenOutcome,
  getSafeTerminalScanStatus,
  getHomeResetState,
  HOME_UPLOAD_TARGET_SCREEN,
  isCurrentScanSession,
  shouldStartPickedUpload,
} from './scanControllerUtils';

test('fresh scan navigation resets to Home without retaining a completed Result route', () => {
  assert.deepEqual(getHomeResetState(), {
    index: 0,
    routes: [{ name: 'MainTabs', params: { screen: 'HomeScreen' } }],
  });
  assert.deepEqual(getFreshDescribeMealResetState(), {
    index: 1,
    routes: [
      { name: 'MainTabs', params: { screen: 'HomeScreen' } },
      { name: 'DescribeMealScreen', params: undefined },
    ],
  });
});

test('fresh description retries preserve the new input while keeping Home underneath', () => {
  assert.deepEqual(getFreshDescribeMealResetState('a tofu bowl'), {
    index: 1,
    routes: [
      { name: 'MainTabs', params: { screen: 'HomeScreen' } },
      { name: 'DescribeMealScreen', params: { initialDescription: 'a tofu bowl' } },
    ],
  });
});

test('cancelled Home uploads stay on Home and selected uploads target analysis directly', () => {
  assert.equal(shouldStartPickedUpload(true, 0), false);
  assert.equal(shouldStartPickedUpload(false, 0), false);
  assert.equal(shouldStartPickedUpload(false, 1), true);
  assert.equal(HOME_UPLOAD_TARGET_SCREEN, 'AnalysisLoadingScreen');
});

test('upload handoff commits only the active session', () => {
  assert.equal(isCurrentScanSession('scan-photos-2', 'scan-photos-1'), false);
  assert.equal(isCurrentScanSession('scan-photos-2', 'scan-photos-2'), true);
  assert.equal(isCurrentScanSession(null, 'scan-photos-1'), false);
});

test('scan status mapping does not treat every non-partial response as success', () => {
  assert.equal(getSafeTerminalScanStatus({ status: 'success', scan: undefined, recipe: undefined }), 'failed');
  assert.equal(getSafeTerminalScanStatus({ status: 'rejected', scan: undefined, recipe: undefined }), 'rejected');
  assert.equal(getSafeTerminalScanStatus({ status: 'partial', scan: undefined, recipe: undefined }), 'failed');
});

test('AnalysisLoadingScreen stays pending until a terminal status arrives', () => {
  assert.equal(getAnalysisScreenOutcome({ status: null, usable: false, hasResult: false }), 'pending');
  assert.equal(getAnalysisScreenOutcome({ status: 'pending', usable: false, hasResult: false }), 'pending');
});

test('only a usable successful result navigates to ResultSummaryScreen', () => {
  assert.equal(getAnalysisScreenOutcome({ status: 'success', usable: true, hasResult: true }), 'success');
  assert.equal(getAnalysisScreenOutcome({ status: 'partial', usable: true, hasResult: true }), 'inline_failure');
});

test('failed, rejected, and unusable success/partial results resolve to an inline failure, never a navigation', () => {
  assert.equal(getAnalysisScreenOutcome({ status: 'failed', usable: false, hasResult: false }), 'inline_failure');
  assert.equal(getAnalysisScreenOutcome({ status: 'rejected', usable: false, hasResult: false }), 'inline_failure');
  assert.equal(getAnalysisScreenOutcome({ status: 'partial', usable: false, hasResult: true }), 'inline_failure');
  assert.equal(getAnalysisScreenOutcome({ status: 'success', usable: false, hasResult: true }), 'inline_failure');
  assert.equal(getAnalysisScreenOutcome({ status: 'success', usable: true, hasResult: false }), 'inline_failure');
});
