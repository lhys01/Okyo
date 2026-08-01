import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { buildGuidedCookingSteps } from './guidedCookingSteps';

function recipeWithSteps(): Recipe {
  return {
    id: 'recipe-1',
    scanResultId: 'scan-1',
    title: 'Test Recipe',
    mode: 'Normal',
    description: 'A test recipe',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 4,
    estimatedSavings: 6,
    ingredients: [{ name: 'rice', quantity: '1 cup' }],
    steps: [],
    structuredSteps: [
      { title: 'Prep', text: 'Wash the rice.', phase: 1 },
      { title: 'Cook', text: 'Cook the rice for 20 minutes.', phase: 3, timeEstimate: '20 minutes' },
      { title: 'Finish', text: 'Season with salt.', phase: 5 },
      { title: 'Serve', text: 'Serve warm.', phase: 6 },
    ],
    substitutions: [],
    pantryNote: '',
    confidenceNote: '',
    cookingTerms: [{ term: 'steam', meaning: 'Cook with moist heat.' }],
    spicePairings: ['A pinch of salt brings the rice into focus.'],
  };
}

test('the shared builder gives every cooking surface the same sequence and step title', () => {
  const recipe = recipeWithSteps();
  const homeSequence = buildGuidedCookingSteps(recipe);
  const recipeStepsSequence = buildGuidedCookingSteps(recipe);

  assert.equal(homeSequence.length, recipeStepsSequence.length);
  assert.equal(homeSequence[3]?.title, recipeStepsSequence[3]?.title);
  assert.equal(homeSequence[3]?.title, 'Serve');
  assert.equal(homeSequence[1]?.estimatedMinutes, 20);
  assert.equal(homeSequence[0]?.tip, recipeStepsSequence[0]?.tip);
});

test('the shared builder derives cooking terms and pairings internally', () => {
  const recipe = recipeWithSteps();
  const sequence = buildGuidedCookingSteps(recipe);

  assert.ok(sequence.some((step) => step.tip?.title === 'Optional boost'));
  assert.equal(buildGuidedCookingSteps(recipe).length, sequence.length);
});
