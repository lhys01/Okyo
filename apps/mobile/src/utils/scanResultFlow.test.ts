import assert from 'node:assert/strict';
import test from 'node:test';

import type { CreateScanResult } from '../api/types';
import type { Recipe, ScanResult } from '../mocks';
import { createMockScan } from '../api/client';
import {
  commitSuccessfulScan,
  getCanonicalScanRecipeId,
  getEmptyCanonicalRecipeCollections,
  resolveCanonicalRecipe,
} from '../state/canonicalRecipes';
import { getAnalysisScreenOutcome, getSafeTerminalScanStatus, getScanResultNavigationTarget } from './scanControllerUtils';
import { runScanRequestPipeline } from './scanRequestPipeline';

const recipe: Recipe = {
  id: 'api-recipe-1',
  scanResultId: 'api-scan-1',
  title: 'Crispy Fish Tacos',
  mode: 'Normal',
  description: 'An inspired-by fish taco recipe.',
  prepTimeMinutes: 10,
  cookTimeMinutes: 15,
  servings: 2,
  difficulty: 'Easy',
  estimatedHomemadeCost: 9,
  estimatedSavings: 7,
  ingredients: [{ name: 'white fish', quantity: '8 oz' }],
  steps: ['Cook the fish in a skillet until flaky.'],
  substitutions: [],
  pantryNote: '',
  confidenceNote: 'Estimates may vary.',
};

const scan: ScanResult = {
  id: 'api-scan-1',
  dishName: 'Fish tacos',
  restaurantStyle: 'Taco shop inspired',
  restaurantPrice: 16,
  homemadeCost: 9,
  estimatedSavings: 7,
  confidence: 0.83,
  matchScore: 0.8,
  difficulty: 'Easy',
  modes: ['Normal'],
  recipeId: recipe.id,
  groceryListId: 'grocery-1',
  shareCardId: 'share-1',
};

test('a 29.6-second HTTP 201 result with an API-valid recipe completes store commit and targets that result', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const originalFetch = globalThis.fetch;
  const result: CreateScanResult = { status: 'success', source: 'photos', scan, recipe };
  const signal = new AbortController().signal;
  let settled = false;
  globalThis.fetch = async () => new Promise<Response>((resolve) => {
    setTimeout(() => resolve(new Response(JSON.stringify({ ok: true, data: result }), { status: 201 })), 29_600);
  });

  try {
    const pipelinePromise = runScanRequestPipeline({
      prepare: async () => 'selected nonprivate test image',
      persist: async (image) => image,
      upload: () => createMockScan({ source: 'photos', mode: 'Normal' }, {
        idempotencyKey: 'scan-photos-test-session-1',
        requestId: 'scan-photos-test-session-1',
        signal,
      }),
      isCurrent: () => true,
      signal,
    }).then((pipelineResult) => { settled = true; return pipelineResult; });

    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false, 'the client must remain pending while the server finishes its recipe retry');
    context.mock.timers.tick(29_599);
    assert.equal(settled, false);
    context.mock.timers.tick(1);
    await new Promise<void>((resolve) => setImmediate(resolve));

    const pipelineResult = await pipelinePromise;
    assert.equal(pipelineResult.kind, 'success');
    if (pipelineResult.kind !== 'success') return;
    assert.equal(getSafeTerminalScanStatus(pipelineResult.result), 'success');
    assert.deepEqual(pipelineResult.result.scan, scan);
    assert.deepEqual(pipelineResult.result.recipe, recipe);

    const scanSessionId = 'scan-photos-test-session-1';
    const recipeId = getCanonicalScanRecipeId(scanSessionId);
    const collections = commitSuccessfulScan(getEmptyCanonicalRecipeCollections(), {
      activeScanSessionId: scanSessionId,
      scanSessionId,
      status: 'success',
      source: 'photos',
      scan: pipelineResult.result.scan,
      recipe: pipelineResult.result.recipe,
      image: null,
      selectedMode: 'Normal',
    });
    const committedRecipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
    assert.ok(committedRecipe, 'the successful response must become the active canonical recipe');
    assert.equal(committedRecipe.title, recipe.title);
    assert.equal(getAnalysisScreenOutcome({ status: 'success', usable: true, hasResult: true }), 'success');
    assert.deepEqual(getScanResultNavigationTarget(committedRecipe.id, scanSessionId), {
      screen: 'ResultSummaryScreen',
      params: { recipeId, scanSessionId },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
