import assert from 'node:assert/strict';
import test from 'node:test';

import { openRouterRecipeOutputSchema, validateRecipeStructure } from './openRouterProvider.js';

function buildStep(index: number, overrides: Record<string, unknown> = {}) {
  return {
    stepNumber: index,
    title: `Step ${index}`,
    step: `Do action number ${index} for about ${index} minutes until golden.`,
    ingredients: ['olive oil'],
    tools: ['skillet'],
    ...overrides,
  };
}

function buildValidRecipe(stepCount = 6) {
  return {
    dishName: 'Creamy Tomato Pasta',
    title: 'Creamy Tomato Pasta',
    ingredients: ['8 oz rigatoni', '1 cup tomato sauce', '1/2 cup cream', '1/4 cup parmesan'],
    steps: Array.from({ length: stepCount }, (_, i) => buildStep(i + 1)),
  };
}

test('accepts a single structured recipe with the canonical step contract', () => {
  const parsed = openRouterRecipeOutputSchema.parse(buildValidRecipe());
  assert.deepEqual(validateRecipeStructure(parsed), []);
});

test('accepts legacy step field names (instruction/ingredientsUsed/toolsUsed)', () => {
  const legacy = {
    dishName: 'Legacy Dish',
    title: 'Legacy Dish',
    ingredients: ['1 cup flour'],
    steps: Array.from({ length: 5 }, (_, i) => ({
      stepNumber: i + 1,
      title: `Step ${i + 1}`,
      instruction: `Legacy instruction ${i + 1} for a few minutes.`,
      ingredientsUsed: ['flour'],
      toolsUsed: ['bowl'],
    })),
  };
  const parsed = openRouterRecipeOutputSchema.parse(legacy);
  assert.deepEqual(validateRecipeStructure(parsed), []);
});

test('rejects when steps is not an array', () => {
  const parsed = openRouterRecipeOutputSchema.parse({ dishName: 'X', title: 'X', steps: [] });
  // Empty steps -> too_few_steps + stepNumber edge handled (empty is valid array but too few).
  assert.ok(validateRecipeStructure(parsed).includes('too_few_steps'));
});

test('flags a step missing ingredients', () => {
  const recipe = buildValidRecipe();
  recipe.steps[2] = buildStep(3, { ingredients: [] });
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  assert.ok(validateRecipeStructure(parsed).includes('step_missing_ingredients'));
});

test('flags a step missing tools', () => {
  const recipe = buildValidRecipe();
  recipe.steps[1] = buildStep(2, { tools: [] });
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  assert.ok(validateRecipeStructure(parsed).includes('step_missing_tools'));
});

test('flags a step missing its instruction text', () => {
  const recipe = buildValidRecipe();
  recipe.steps[0] = buildStep(1, { step: '' });
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  assert.ok(validateRecipeStructure(parsed).includes('step_missing_instruction'));
});

test('flags non-sequential stepNumber', () => {
  const recipe = buildValidRecipe();
  recipe.steps[3] = buildStep(99); // gap in numbering
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  assert.ok(validateRecipeStructure(parsed).includes('stepNumber_not_sequential'));
});

test('flags missing stepNumber', () => {
  const recipe = buildValidRecipe();
  const broken = buildStep(4);
  delete (broken as Record<string, unknown>).stepNumber;
  recipe.steps[3] = broken;
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  assert.ok(validateRecipeStructure(parsed).includes('stepNumber_missing'));
});

test('output schema carries a single recipe (no per-mode keys)', () => {
  const parsed = openRouterRecipeOutputSchema.parse(buildValidRecipe());
  assert.equal('budget' in parsed, false);
  assert.equal('healthy' in parsed, false);
  assert.equal('restaurantCopy' in parsed, false);
  assert.ok(Array.isArray(parsed.steps));
});

test('output schema strips nutrition estimates from the recipe contract', () => {
  const parsed = openRouterRecipeOutputSchema.parse({
    ...buildValidRecipe(),
    nutritionEstimate: {
      calories: 520,
      proteinGrams: 35,
      carbohydratesGrams: 48,
      fatGrams: 20,
    },
  });

  assert.equal('nutritionEstimate' in parsed, false);
});
