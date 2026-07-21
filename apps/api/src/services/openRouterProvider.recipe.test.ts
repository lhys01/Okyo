import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiConfig } from '../config/aiConfig.js';
import type { FoodImageAnalysis } from './aiService.js';
import {
  generateRecipeWithOpenRouter,
  openRouterRecipeOutputSchema,
  OpenRouterProviderError,
  validateRecipeStructure,
} from './openRouterProvider.js';

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
    ingredients: ['8 oz rigatoni', '1 cup tomato sauce', '1/2 cup cream', '1/4 cup parmesan', '1 tbsp olive oil'],
    steps: Array.from({ length: stepCount }, (_, i) => buildStep(i + 1)),
  };
}

const testConfig: AiConfig = {
  enabled: true,
  provider: 'openrouter',
  openRouterApiKey: 'sk-test',
  openRouterVisionModel: 'openai/gpt-4o-mini',
  openRouterTextModel: 'openai/gpt-4o-mini',
  timeoutMs: 1000,
  maxOutputTokens: 4096,
  fableEnabled: false,
  fableModel: 'anthropic/claude-fable-5',
  isFableActive: false,
};

function analysis(overrides: Partial<FoodImageAnalysis> = {}): FoodImageAnalysis {
  return {
    candidateScanId: `test-${Math.random().toString(36).slice(2)}`,
    aiSource: 'openrouter_ai',
    dishName: 'Creamy Tomato Pasta',
    cuisine: 'Restaurant-style',
    restaurantStyle: 'Restaurant-style',
    scanState: 'clear_food',
    broadDishCategory: 'pasta/noodles',
    confidence: 0.82,
    confidenceReason: 'Test fixture.',
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['pasta', 'tomato sauce'],
    likelyIngredients: ['olive oil', 'salt'],
    possibleDishNames: [],
    visibleComponents: {
      protein: '',
      sauce: 'tomato sauce',
      baseStarch: 'pasta',
      vegetables: '',
      toppingsGarnish: '',
      cookingMethod: 'boiled',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 6,
    matchScore: 8,
    difficulty: 'Easy',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    notes: [],
    detectedComponents: [],
    ...overrides,
  };
}

function providerResponse(recipe: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      message: { content: JSON.stringify(recipe) },
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
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

test('recipe generation adds quantified water when cooking steps require it', async () => {
  const originalFetch = globalThis.fetch;
  const recipe = buildValidRecipe(6);
  recipe.dishName = 'Water Closure Tomato Pasta';
  recipe.title = 'Water Closure Tomato Pasta';
  recipe.ingredients = [
    '8 oz spaghetti',
    '2 tbsp olive oil',
    '3 cloves garlic',
    '1 cup tomato sauce',
    '1/2 tsp salt',
  ];
  recipe.steps[0] = buildStep(1, {
    title: 'Boil Water',
    step: 'Bring water to a rolling boil in a large pot for 8 minutes.',
    ingredients: ['water'],
    tools: ['large pot'],
  });

  globalThis.fetch = async () => providerResponse(recipe);
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Water Closure Tomato Pasta' }),
      config: testConfig,
      mode: 'Restaurant Copy',
    });

    assert.ok(output.ingredients.includes('8 cups water'));
    assert.deepEqual(
      typeof output.steps[0] === 'object' && output.steps[0].ingredients,
      ['water'],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recipe generation corrects unsafe poultry internal temperatures', async () => {
  const originalFetch = globalThis.fetch;
  const chicken = buildValidRecipe(6);
  chicken.dishName = 'Lemon Chicken';
  chicken.title = 'Lemon Chicken';
  chicken.ingredients = ['1 lb chicken breasts', '1 tbsp olive oil', '1/2 tsp salt', '1 lemon', '1 garlic clove'];
  chicken.steps = [
    buildStep(1, { title: 'Pat Chicken', step: 'Pat the chicken dry for 1 minute.', ingredients: ['chicken'], tools: ['paper towels'] }),
    buildStep(2, { title: 'Heat Oil', step: 'Heat olive oil in a skillet for 2 minutes until shimmering.', ingredients: ['olive oil'], tools: ['skillet'] }),
    buildStep(3, { title: 'Season Chicken', step: 'Season chicken with salt and garlic for 1 minute.', ingredients: ['chicken', 'salt', 'garlic'], tools: ['bowl'] }),
    buildStep(4, {
      title: 'Cook Chicken',
      step: 'Cook chicken for 6 minutes until it reaches 145°F / 63°C in the center.',
      ingredients: ['chicken'],
      tools: ['skillet', 'instant-read thermometer'],
      safetyNote: 'Chicken should reach 145°F / 63°C inside.',
    }),
    buildStep(5, { title: 'Add Lemon', step: 'Squeeze lemon over chicken for 30 seconds until glossy.', ingredients: ['lemon', 'chicken'], tools: ['tongs'] }),
    buildStep(6, { title: 'Rest Chicken', step: 'Rest chicken for 5 minutes before slicing.', ingredients: ['chicken'], tools: ['plate'] }),
  ];

  globalThis.fetch = async () => providerResponse(chicken);
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({
        dishName: 'Lemon Chicken',
        broadDishCategory: 'grilled poultry',
        visibleIngredients: ['chicken', 'lemon'],
        likelyIngredients: ['olive oil', 'salt'],
      }),
      config: testConfig,
      mode: 'Restaurant Copy',
    });
    const text = JSON.stringify(output.steps);

    assert.match(text, /165°F/);
    assert.match(text, /74°C/);
    assert.doesNotMatch(text, /145°F|63°C/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recipe repair rejects a changed response when the final recipe is still invalid', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const initial = buildValidRecipe(6);
  initial.dishName = 'Unresolved Repair Pasta';
  initial.title = 'Unresolved Repair Pasta';
  initial.ingredients = ['8 oz rigatoni', '1 cup tomato sauce', '1 tbsp olive oil', '1/2 cup cream', '1/4 cup parmesan'];
  initial.steps[1] = buildStep(2, {
    step: 'Cook until done.',
  });
  const repaired = structuredClone(initial);
  repaired.steps[1] = buildStep(2, {
    step: 'Cook until done in the skillet.',
  });

  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1 ? initial : repaired);
  };
  try {
    await assert.rejects(
      generateRecipeWithOpenRouter({
        analysis: analysis({ dishName: 'Unresolved Repair Pasta' }),
        config: testConfig,
        mode: 'Restaurant Copy',
      }),
      (error: unknown) => error instanceof OpenRouterProviderError &&
        error.failure.reason === 'openrouter_invalid_schema' &&
        /vague_step/.test(error.failure.openRouterErrorMessage ?? ''),
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
