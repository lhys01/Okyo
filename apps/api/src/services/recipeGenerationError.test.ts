import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRecipeFailureApiError,
  RecipeGenerationError,
  RecipeValidationError,
} from './recipeGenerationError.js';

test('known recipe failures map to stable non-generic API errors', () => {
  assert.deepEqual(getRecipeFailureApiError(new RecipeGenerationError('openrouter_timeout')), {
    status: 502,
    code: 'recipe_generation_failed',
    message: 'Okyo could not generate the recipe. Please try again.',
  });
  assert.deepEqual(getRecipeFailureApiError(new RecipeValidationError(['missing_safety_poultry'])), {
    status: 502,
    code: 'recipe_validation_failed',
    message: 'Okyo could not produce a safe, cookable recipe. Please try again.',
  });
  assert.equal(getRecipeFailureApiError(new Error('unrelated')), null);
});
