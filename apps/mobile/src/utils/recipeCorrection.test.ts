import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import type { Recipe } from '../mocks';

import {
  buildCorrectionRequest,
  canSubmitCorrection,
  getCorrectionErrorMessage,
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

test('Lighter then Healthier then More Protein builds each request from the latest recipe revision', () => {
  const lighter = { ...currentRecipe, id: 'provider-lighter', sourceRecipeId: 'provider-lighter', title: 'Lighter Rice Bowl' } as Recipe;
  const healthier = { ...lighter, id: 'provider-healthier', sourceRecipeId: 'provider-healthier', title: 'Healthier Rice Bowl' } as Recipe;
  const healthierRequest = buildCorrectionRequest({
    correctionNote: 'Make it healthier',
    currentRecipe: lighter,
    expectedSourceRecipeId: getRecipeCorrectionSourceId(lighter),
    mode: 'Normal',
  });
  assert.equal(healthierRequest.currentRecipe, lighter);
  assert.equal(healthierRequest.expectedSourceRecipeId, 'provider-lighter');

  const proteinRequest = buildCorrectionRequest({
    correctionNote: 'Add more protein',
    currentRecipe: healthier,
    expectedSourceRecipeId: getRecipeCorrectionSourceId(healthier),
    mode: 'Normal',
  });
  assert.equal(proteinRequest.currentRecipe, healthier);
  assert.equal(proteinRequest.expectedSourceRecipeId, 'provider-healthier');
});

test('multiple text corrections advance the source revision without losing the prior recipe state', () => {
  const first = { ...currentRecipe, id: 'text-correction-1', sourceRecipeId: 'text-correction-1', title: 'Tofu Rice Bowl' } as Recipe;
  const second = { ...first, id: 'text-correction-2', sourceRecipeId: 'text-correction-2', title: 'Lighter Tofu Rice Bowl' } as Recipe;
  const request = buildCorrectionRequest({
    correctionNote: 'Keep it under 20 minutes',
    currentRecipe: second,
    expectedSourceRecipeId: getRecipeCorrectionSourceId(second),
    mode: 'Normal',
  });

  assert.equal(request.currentRecipe?.title, 'Lighter Tofu Rice Bowl');
  assert.equal(request.expectedSourceRecipeId, 'text-correction-2');
});

test('failed corrections leave a retryable non-empty note and the retry error is actionable', () => {
  const error = { status: 503, code: 'recipe_correction_unavailable' };
  assert.equal(getCorrectionErrorMessage(error), 'Okyo’s kitchen is busy right now. Try again in a minute.');
  assert.equal(canSubmitCorrection('Make it healthier'), true);
});

test('the recipe editor submits on the keyboard action and refuses empty submissions', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/RecipeEditCard.tsx'), 'utf8');
  assert.match(source, /returnKeyType="send"/);
  assert.match(source, /blurOnSubmit/);
  assert.match(source, /onSubmitEditing=\{\(\) => \{ if \(canSubmit && !isCorrecting\) onSubmitCorrection\(\); \}\}/);
  assert.doesNotMatch(source, /\n\s*multiline(?:\s|\n)/);
  assert.equal(canSubmitCorrection('  '), false);
});

test('editor cancellation aborts the in-flight request and invalidates its response', () => {
  const oldRequest = 'correction-before-cancel';
  const requestAfterRetry = 'correction-after-retry';
  assert.equal(isCurrentCorrectionRequest(oldRequest, null), false);
  assert.equal(isCurrentCorrectionRequest(oldRequest, requestAfterRetry), false);
  assert.equal(isCurrentCorrectionRequest(requestAfterRetry, requestAfterRetry), true);
});

test('a slow response from a replaced request cannot overwrite the newer correction', async () => {
  let finishSlowRequest!: (value: string) => void;
  const slowResponse = new Promise<string>((resolvePromise) => { finishSlowRequest = resolvePromise; });
  let latestRequestId: string | null = 'slow-request';
  const applied: string[] = [];
  const slowCompletion = slowResponse.then((value) => {
    if (isCurrentCorrectionRequest('slow-request', latestRequestId)) applied.push(value);
  });

  latestRequestId = 'replacement-request';
  applied.push('newer recipe');
  finishSlowRequest('stale recipe');
  await slowCompletion;

  assert.deepEqual(applied, ['newer recipe']);
});

test('both result and detail correction flows pass cancellation signals and use current recipe revisions', () => {
  const result = readFileSync(resolve(process.cwd(), 'src/screens/ResultSummaryScreen.tsx'), 'utf8');
  const detail = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');
  assert.match(result, /correctScanRecipe\(sourceRecipeId, \{[\s\S]*?\}, abortController\.signal\)/);
  assert.match(result, /sourceRecipe: selectedRecipe/);
  assert.doesNotMatch(result, /getRecipePresentationVariant\(/);
  assert.match(detail, /currentRecipe: recipe, expectedSourceRecipeId: sourceId/);
  assert.match(detail, /\}, abortController\.signal\)/);
  assert.match(detail, /correctionInFlightRef\.current/);
  assert.doesNotMatch(detail, /getRecipePresentationVariant\(/);
});
