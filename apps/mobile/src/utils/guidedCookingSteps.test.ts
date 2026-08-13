import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { buildGuidedCookingSteps, getGuidedIngredientChipLabel } from './guidedCookingSteps';

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

test('ingredient chips retain real recipe quantities without inventing missing amounts', () => {
  assert.equal(getGuidedIngredientChipLabel({ name: 'flour', quantity: '2 cups' }), '2 cups flour');
  assert.equal(getGuidedIngredientChipLabel({ name: 'Dough', quantity: '' }), 'Dough');
});

test('a busy step keeps all resolved quantities and equipment for wrapping chips', () => {
  const recipe = recipeWithSteps();
  recipe.ingredients = [
    { name: 'flour', quantity: '2 cups' },
    { name: 'butter', quantity: '1/2 cup' },
    { name: 'sugar', quantity: '2 tbsp' },
    { name: 'salt', quantity: '1/4 tsp' },
    { name: 'cream', quantity: '1/4 cup' },
    { name: 'lemon juice', quantity: '1 tsp' },
  ];
  recipe.structuredSteps = [{
    title: 'Mix',
    text: 'Combine the filling ingredients.',
    ingredientsUsed: recipe.ingredients.map((ingredient) => ingredient.name),
    toolsUsed: ['mixing bowl', 'whisk'],
  }];

  const [step] = buildGuidedCookingSteps(recipe);

  assert.deepEqual(step?.ingredientsUsed.map(getGuidedIngredientChipLabel), [
    '2 cups flour',
    '1/2 cup butter',
    '2 tbsp sugar',
    '1/4 tsp salt',
    '1/4 cup cream',
    '1 tsp lemon juice',
  ]);
  assert.deepEqual(step?.toolsUsed, ['mixing bowl', 'whisk']);
});

test('protein safety guidance stays with the relevant current step', () => {
  const recipe = recipeWithSteps();
  recipe.structuredSteps = [
    { title: 'Prepare fries', text: 'Spread frozen fries on a baking sheet.', safetyNote: 'Ground beef or turkey should reach 160°F / 71°C inside.' },
    { title: 'Grill beef patty', text: 'Season and grill the beef patty.', safetyNote: 'Ground beef or turkey should reach 160°F / 71°C inside.' },
  ];
  const steps = buildGuidedCookingSteps(recipe);
  assert.equal(steps[0]?.safetyNote, undefined);
  assert.equal(steps[1]?.safetyNote, 'Ground beef or turkey should reach 160°F / 71°C inside.');
});
