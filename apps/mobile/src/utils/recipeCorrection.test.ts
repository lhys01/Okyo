import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCorrectionRequest,
  canSubmitCorrection,
  isCurrentCorrectionRequest,
  validateCorrectionNote,
} from './recipeCorrection';

test('correction text is trimmed and validated', () => {
  assert.equal(validateCorrectionNote('  These are lamb chops, not chicken.  '), null);
  assert.equal(canSubmitCorrection('  These are lamb chops, not chicken.  '), true);
});

test('empty correction does not submit', () => {
  assert.notEqual(validateCorrectionNote(''), null);
  assert.notEqual(validateCorrectionNote('   '), null);
  assert.equal(canSubmitCorrection(''), false);
  assert.equal(canSubmitCorrection('   '), false);
});

test('an overly long correction does not submit', () => {
  const tooLong = 'a'.repeat(400);
  assert.notEqual(validateCorrectionNote(tooLong), null);
  assert.equal(canSubmitCorrection(tooLong), false);
});

test('building the request payload includes the exact "lamb chops, not chicken" example text', () => {
  const request = buildCorrectionRequest({
    correctionNote: 'These are lamb chops, not chicken.',
    mode: 'Restaurant Copy',
  });
  assert.equal(request.correctionNote, 'These are lamb chops, not chicken.');
  assert.ok(request.correctionNote.includes('lamb chops, not chicken'));
});

test('building the request payload trims whitespace from the note and dish name override', () => {
  const request = buildCorrectionRequest({
    correctionNote: '  Lamb chops, not chicken.  ',
    dishNameOverride: '  Lamb Chops  ',
    mode: 'Budget',
  });
  assert.equal(request.correctionNote, 'Lamb chops, not chicken.');
  assert.equal(request.dishNameOverride, 'Lamb Chops');
  assert.equal(request.mode, 'Budget');
});

test('an empty dish name override is omitted from the request payload', () => {
  const request = buildCorrectionRequest({
    correctionNote: 'Lamb chops, not chicken.',
    dishNameOverride: '   ',
    mode: 'Restaurant Copy',
  });
  assert.equal('dishNameOverride' in request, false);
});

test('a stale pre-correction response is ignored by the race guard', () => {
  const firstRequestId = 'correction-1';
  const secondRequestId = 'correction-2';
  // The second correction fired after the first, so it is now "latest".
  assert.equal(isCurrentCorrectionRequest(firstRequestId, secondRequestId), false);
  assert.equal(isCurrentCorrectionRequest(secondRequestId, secondRequestId), true);
});

test('the race guard rejects any response once no request is in flight', () => {
  assert.equal(isCurrentCorrectionRequest('correction-1', null), false);
});
