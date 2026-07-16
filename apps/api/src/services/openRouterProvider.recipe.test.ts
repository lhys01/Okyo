import assert from 'node:assert/strict';
import test from 'node:test';

import type { FoodImageAnalysis } from './aiService.js';
import {
  normalizeFullRecipeOutput,
  openRouterRecipeOutputSchema,
  validateRecipeStructure,
} from './openRouterProvider.js';

function buildStep(index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: `Step ${index}`,
    step: `Heat the olive oil for ${index} minutes until golden.`,
    ...overrides,
  };
}

function buildValidRecipe(stepCount = 6): {
  dishName: string;
  title: string;
  ingredients: string[];
  equipment?: string[];
  steps: Record<string, unknown>[];
} {
  return {
    dishName: 'Creamy Tomato Pasta',
    title: 'Creamy Tomato Pasta',
    ingredients: [
      '8 oz rigatoni',
      '1 cup tomato sauce',
      '1/2 cup cream',
      '1/4 cup parmesan',
      '2 tbsp olive oil',
    ],
    steps: Array.from({ length: stepCount }, (_, i) => buildStep(i + 1)),
  };
}

test('accepts a single structured recipe without derivable step metadata', () => {
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

test('normalization derives missing step numbers, phases, ingredient arrays, and tool arrays locally', () => {
  const recipe = buildValidRecipe();
  recipe.equipment = ['skillet'];
  recipe.steps[2] = buildStep(3, {
    title: '',
    step: 'Heat the olive oil in the skillet for 3 minutes until golden.',
    ingredients: [],
    tools: [],
    stepNumber: 99,
    phase: 6,
  });
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  const normalized = normalizeFullRecipeOutput(parsed, {
    dishName: 'Creamy Tomato Pasta',
    broadDishCategory: 'pasta/noodles',
    detectedComponents: [],
  } as unknown as FoodImageAnalysis);
  const step = normalized.steps[2];
  assert.equal(typeof step === 'object' && step.stepNumber, 3);
  assert.ok(typeof step === 'object' && step.phase !== undefined);
  assert.deepEqual(typeof step === 'object' && step.ingredients, ['olive oil']);
  assert.deepEqual(typeof step === 'object' && step.tools, ['skillet']);
  assert.ok(typeof step === 'object' && step.title.length > 0);
  assert.deepEqual(validateRecipeStructure(normalized), []);
});

test('flags a step missing its instruction text', () => {
  const recipe = buildValidRecipe();
  recipe.steps[0] = buildStep(1, { step: '' });
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  assert.ok(validateRecipeStructure(parsed).includes('step_missing_instruction'));
});

test('step numbers are not part of provider validation', () => {
  const recipe = buildValidRecipe();
  recipe.steps[3] = buildStep(99); // gap in numbering
  const parsed = openRouterRecipeOutputSchema.parse(recipe);
  assert.deepEqual(validateRecipeStructure(parsed), []);
});

test('output schema carries a single recipe (no per-mode keys)', () => {
  const parsed = openRouterRecipeOutputSchema.parse(buildValidRecipe());
  assert.equal('budget' in parsed, false);
  assert.equal('healthy' in parsed, false);
  assert.equal('restaurantCopy' in parsed, false);
  assert.ok(Array.isArray(parsed.steps));
});

test('normalizes a single substitution string into an array', () => {
  const parsed = openRouterRecipeOutputSchema.parse({
    ...buildValidRecipe(),
    substitutions: '  Use Greek yogurt instead of sour cream.  ',
  });

  assert.deepEqual(parsed.substitutions, ['Use Greek yogurt instead of sour cream.']);
});

test('preserves an array of substitution strings', () => {
  const substitutions = ['Use tofu instead of chicken.', 'Swap spinach for kale.'];
  const parsed = openRouterRecipeOutputSchema.parse({
    ...buildValidRecipe(),
    substitutions,
  });

  assert.deepEqual(parsed.substitutions, substitutions);
});

test('converts an array of substitution objects into strings', () => {
  const parsed = openRouterRecipeOutputSchema.parse({
    ...buildValidRecipe(),
    substitutions: [
      {
        ingredient: 'sour cream',
        substitute: 'Greek yogurt',
        note: 'Use the same amount.',
      },
      {
        from: 'spinach',
        to: 'kale',
        description: 'Cook it a little longer.',
      },
    ],
  });

  assert.deepEqual(parsed.substitutions, [
    'sour cream: Greek yogurt Use the same amount.',
    'spinach: kale Cook it a little longer.',
  ]);
});

test('normalizes an empty substitution string into an empty array', () => {
  const parsed = openRouterRecipeOutputSchema.parse({
    ...buildValidRecipe(),
    substitutions: '',
  });

  assert.deepEqual(parsed.substitutions, []);
});
