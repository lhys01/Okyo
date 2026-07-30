import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from './types.js';
import {
  getCurrentGeneratedRecipe,
  getGeneratedRecipe,
  getGeneratedRecipeRevisionMetadata,
  StaleRecipeRevisionError,
  storeGeneratedRecipe,
  storeGeneratedRecipeRevision,
} from './store.js';

function recipe(id: string): Recipe {
  return {
    id,
    scanResultId: `scan-${id}`,
    title: 'Test Recipe',
    mode: 'Normal',
    description: 'A test recipe.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    totalTimeMinutes: 15,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 5,
    estimatedSavings: 8,
    ingredients: [{ name: 'test ingredient', quantity: '1 cup' }],
    steps: ['Prepare the test ingredient.'],
    structuredSteps: [{
      title: 'Prepare',
      text: 'Prepare the test ingredient.',
      ingredientsUsed: ['test ingredient'],
      toolsUsed: ['bowl'],
    }],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Test estimate.',
    equipment: ['bowl'],
    nutritionEstimate: {
      calories: 100,
      proteinGrams: 5,
      carbohydratesGrams: 12,
      fatGrams: 4,
    },
  };
}

test('successful corrections create immutable unique source revisions', () => {
  const original = recipe(`source-${Date.now()}`);
  storeGeneratedRecipe(original);

  const second = storeGeneratedRecipeRevision(original.id, {
    ...original,
    title: 'Updated Recipe',
  });
  const third = storeGeneratedRecipeRevision(second.recipe.id, {
    ...second.recipe,
    title: 'Updated Again',
  });

  assert.notEqual(second.recipe.id, original.id);
  assert.notEqual(third.recipe.id, second.recipe.id);
  assert.equal(second.parentRevisionId, original.id);
  assert.equal(third.parentRevisionId, second.recipe.id);
  assert.equal(second.rootRevisionId, original.id);
  assert.equal(third.rootRevisionId, original.id);
  assert.equal(getGeneratedRecipe(original.id)?.title, original.title);
  assert.equal(getGeneratedRecipe(second.recipe.id)?.title, 'Updated Recipe');
  assert.equal(getCurrentGeneratedRecipe(third.recipe.id)?.title, 'Updated Again');
  assert.equal(getGeneratedRecipeRevisionMetadata(original.id)?.supersededBy, second.recipe.id);
});

test('a stale source revision cannot commit or become the current correction base', () => {
  const original = recipe(`stale-${Date.now()}`);
  storeGeneratedRecipe(original);
  storeGeneratedRecipeRevision(original.id, { ...original, title: 'Current Recipe' });

  assert.throws(
    () => getCurrentGeneratedRecipe(original.id),
    (error: unknown) => error instanceof StaleRecipeRevisionError,
  );
  assert.throws(
    () => storeGeneratedRecipeRevision(original.id, { ...original, title: 'Late Response' }),
    (error: unknown) => error instanceof StaleRecipeRevisionError,
  );
  assert.equal(getGeneratedRecipe(original.id)?.title, original.title);
});
