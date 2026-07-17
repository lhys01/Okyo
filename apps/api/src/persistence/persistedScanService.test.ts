import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiScanSuccessResult } from '../services/aiService.js';
import { RecipeValidationError } from '../services/recipeGenerationError.js';
import type { Recipe } from '../types.js';
import { runPersistedScan } from './persistedScanService.js';
import {
  PersistenceUnavailableError,
  type ScanRecipeRepository,
} from './scanRecipeRepository.js';

const userId = '162b7af3-e489-4cc9-8f11-09913a4b142a';
const durableId = 'a90e5c8c-ca41-4a53-8e4c-d331876a9d1a';

test('successful scan persists the trusted user lifecycle and only the normalized recipe', async () => {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const repository = recordingRepository(calls);
  const result = await runPersistedScan({
    userId,
    repository,
    idFactory: () => durableId,
    now: sequenceClock(1_000, 1_350, 1_400),
    generate: async () => makeScanResult(),
  });

  assert.equal(result.scan.id, durableId);
  assert.equal(result.recipe?.id, durableId);
  assert.equal(result.recipe?.scanResultId, durableId);
  assert.deepEqual(calls.map((call) => call.operation), [
    'createScanSession',
    'update:processing',
    'createGeneratedRecipe',
    'update:succeeded',
  ]);
  const persisted = calls[2].value as { userId: string; recipe: Recipe };
  assert.equal(persisted.userId, userId);
  assert.equal('userId' in persisted.recipe, false);
  assert.equal('ownerId' in persisted.recipe, false);
  assert.equal('imageDataUrl' in persisted.recipe, false);
  assert.equal('rawProviderResponse' in persisted.recipe, false);
});

test('database failure before generation does not fall back to in-memory success', async () => {
  let generated = false;
  const repository = recordingRepository([], { failCreateSession: true });
  await assert.rejects(runPersistedScan({
    userId,
    repository,
    idFactory: () => durableId,
    generate: async () => {
      generated = true;
      return makeScanResult();
    },
  }), PersistenceUnavailableError);
  assert.equal(generated, false);
});

test('AI failure records only a fixed sanitized category for the verified user', async () => {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const repository = recordingRepository(calls);
  const rawSecret = 'provider-payload-must-not-be-stored';
  await assert.rejects(runPersistedScan({
    userId,
    repository,
    idFactory: () => durableId,
    generate: async () => { throw new Error(`RECIPE_GENERATION_FAILED: ${rawSecret}`); },
  }));

  const failure = calls.at(-1)?.value as { userId: string; failureCategory: string };
  assert.equal(failure.userId, userId);
  assert.equal(failure.failureCategory, 'recipe_generation_failed');
  assert.equal(JSON.stringify(failure).includes(rawSecret), false);
});

test('typed recipe validation failure persists a stable non-generic category', async () => {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const repository = recordingRepository(calls);
  await assert.rejects(runPersistedScan({
    userId,
    repository,
    idFactory: () => durableId,
    generate: async () => {
      throw new RecipeValidationError(['missing_safety_poultry']);
    },
  }), RecipeValidationError);

  const failure = calls.at(-1)?.value as { failureCategory: string };
  assert.equal(failure.failureCategory, 'recipe_validation_failed');
});

test('recipe persistence failure rejects the scan instead of claiming success', async () => {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const repository = recordingRepository(calls, { failRecipe: true });
  let providerSpendAccounted = false;
  await assert.rejects(runPersistedScan({
    userId,
    repository,
    idFactory: () => durableId,
    generate: async (scanId) => {
      assert.equal(scanId, durableId);
      // Provider finalization occurs inside generation, before recipe storage.
      providerSpendAccounted = true;
      return makeScanResult();
    },
  }), PersistenceUnavailableError);
  assert.equal(providerSpendAccounted, true);
  assert.equal(calls.some((call) => call.operation === 'update:succeeded'), false);
  assert.equal(calls.at(-1)?.operation, 'update:failed');
});

test('food rejection records a rejected lifecycle without persisting a recipe', async () => {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const repository = recordingRepository(calls);
  await assert.rejects(runPersistedScan({
    userId,
    repository,
    idFactory: () => durableId,
    generate: async () => {
      throw Object.assign(new Error('friendly rejection'), { rejectionType: 'no_food_detected' });
    },
  }));
  assert.equal(calls.some((call) => call.operation === 'createGeneratedRecipe'), false);
  assert.equal(calls.at(-1)?.operation, 'update:rejected');
  const rejected = calls.at(-1)?.value as { failureCategory: string };
  assert.equal(rejected.failureCategory, 'no_food_detected');
});

function recordingRepository(
  calls: Array<{ operation: string; value: unknown }>,
  options: { failCreateSession?: boolean; failRecipe?: boolean } = {},
): ScanRecipeRepository {
  return {
    async createScanSession(value) {
      calls.push({ operation: 'createScanSession', value });
      if (options.failCreateSession) throw new PersistenceUnavailableError();
    },
    async updateScanSession(value) {
      calls.push({ operation: `update:${value.status}`, value });
    },
    async createGeneratedRecipe(value) {
      calls.push({ operation: 'createGeneratedRecipe', value });
      if (options.failRecipe) throw new PersistenceUnavailableError();
    },
    async findOwnedRecipe() { return null; },
  };
}

function makeScanResult(): AiScanSuccessResult {
  const recipe = {
    id: 'ai-test-bowl-restaurant-copy',
    scanResultId: 'temporary-scan',
    title: 'Test Bowl',
    mode: 'Restaurant Copy',
    description: 'A test recipe.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 5,
    estimatedSavings: 8,
    ingredients: [{ name: 'rice', quantity: '1 cup' }],
    steps: ['Cook the rice.'],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Test only.',
    userId: 'client-supplied-user',
    ownerId: 'client-supplied-owner',
    imageDataUrl: 'data:image/png;base64,secret-image',
    rawProviderResponse: { secret: true },
  } as Recipe & Record<string, unknown>;
  return {
    status: 'success',
    scan: {
      id: 'temporary-scan',
      dishName: 'Test Bowl',
      restaurantStyle: 'Cafe',
      restaurantPrice: 13,
      homemadeCost: 5,
      estimatedSavings: 8,
      confidence: 0.8,
      matchScore: 8,
      difficulty: 'Easy',
      modes: ['Restaurant Copy'],
      recipeId: recipe.id,
    },
    recipe,
    note: 'Test result.',
    aiSource: 'openrouter_ai',
    aiProvider: 'openrouter',
    visionModel: 'test-model',
    recipeModel: 'test-model',
    confidence: 0.8,
    scanState: 'clear_food',
    uploadedImage: true,
  };
}

function sequenceClock(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}
