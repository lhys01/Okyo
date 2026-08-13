import assert from 'node:assert/strict';
import test from 'node:test';
import type { Recipe } from '../mocks';

import {
  buildCorrectionRequest,
  canSubmitCorrection,
  getRecipeCorrectionSourceId,
  isCurrentCorrectionRequest,
  validateCorrectionNote,
} from './recipeCorrection';

const currentRecipe = {
  id: 'source-recipe', scanResultId: 'scan-1', title: 'Rice Bowl', mode: 'Normal',
  description: 'A rice bowl.', prepTimeMinutes: 5, cookTimeMinutes: 15, servings: 2,
  difficulty: 'Easy', estimatedHomemadeCost: 8, estimatedSavings: 12,
  ingredients: [{ name: 'rice', quantity: '1 cup' }], steps: ['Cook the rice.'],
  substitutions: [], pantryNote: '', confidenceNote: 'Estimated.',
} satisfies Recipe;

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
    currentRecipe,
    expectedSourceRecipeId: 'source-1',
    mode: 'Normal',
  });
  assert.equal(request.correctionNote, 'These are lamb chops, not chicken.');
  assert.ok(request.correctionNote.includes('lamb chops, not chicken'));
});

test('building the request payload trims whitespace from the note and dish name override', () => {
  const request = buildCorrectionRequest({
    correctionNote: '  Lamb chops, not chicken.  ',
    currentRecipe,
    dishNameOverride: '  Lamb Chops  ',
    expectedSourceRecipeId: 'source-2',
    mode: 'Lighter',
  });
  assert.equal(request.correctionNote, 'Lamb chops, not chicken.');
  assert.equal(request.dishNameOverride, 'Lamb Chops');
  assert.equal(request.mode, 'Lighter');
  assert.equal(request.expectedSourceRecipeId, 'source-2');
});

test('an empty dish name override is omitted from the request payload', () => {
  const request = buildCorrectionRequest({
    correctionNote: 'Lamb chops, not chicken.',
    currentRecipe,
    dishNameOverride: '   ',
    expectedSourceRecipeId: 'source-3',
    mode: 'Normal',
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

test('sequential corrections always target the latest generated source recipe id', () => {
  assert.equal(
    getRecipeCorrectionSourceId({ id: 'canonical-recipe', sourceRecipeId: 'generated-correction-1' }),
    'generated-correction-1',
  );
  assert.equal(
    getRecipeCorrectionSourceId({ id: 'canonical-recipe', sourceRecipeId: 'generated-correction-2' }),
    'generated-correction-2',
  );
  assert.equal(getRecipeCorrectionSourceId({ id: 'canonical-recipe' }), 'canonical-recipe');
});
