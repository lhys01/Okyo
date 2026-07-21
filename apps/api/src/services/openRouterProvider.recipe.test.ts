import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiConfig } from '../config/aiConfig.js';
import type { FoodImageAnalysis } from './aiService.js';
import {
  generateRecipeWithOpenRouter,
  normalizeRecipeProviderOutputShape,
  openRouterRecipeOutputSchema,
  OpenRouterProviderError,
  recipeArrayFieldDefinitions,
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

function collectZodArrayPaths(schema: unknown, path = ''): string[] {
  const node = unwrapZod(schema);
  const def = (node as { _def?: Record<string, unknown> })._def;
  if (!def) return [];
  const typeName = def.typeName;

  if (typeName === 'ZodArray') {
    const child = def.type;
    return [
      path,
      ...collectZodArrayPaths(child, path),
    ].filter(Boolean);
  }

  if (typeName === 'ZodObject') {
    const rawShape = def.shape;
    const shape = typeof rawShape === 'function' ? rawShape() as Record<string, unknown> : rawShape as Record<string, unknown>;
    return Object.entries(shape).flatMap(([key, child]) => collectZodArrayPaths(child, path ? `${path}.${key}` : key));
  }

  if (typeName === 'ZodUnion') {
    const options = Array.isArray(def.options) ? def.options : [];
    const optionTypes = options.map((option) => (unwrapZod(option) as { _def?: { typeName?: unknown } })._def?.typeName);
    if (optionTypes.includes('ZodString') && optionTypes.includes('ZodArray')) {
      return [];
    }
    return [...new Set(options.flatMap((option) => collectZodArrayPaths(option, path)))];
  }

  return [];
}

function unwrapZod(schema: unknown): unknown {
  let current = schema;
  for (let i = 0; i < 8; i += 1) {
    const def = (current as { _def?: Record<string, unknown> })._def;
    if (!def) return current;
    const next = def.innerType ?? def.schema;
    if (!next) return current;
    current = next;
  }
  return current;
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

test('recipe provider output normalization recovers generic string and object array shapes', async () => {
  const cases: Array<{
    name: string;
    analysis: Partial<FoodImageAnalysis>;
    mutate: (recipe: ReturnType<typeof buildValidRecipe>) => Record<string, unknown>;
    assertOutput: (output: Awaited<ReturnType<typeof generateRecipeWithOpenRouter>>) => void;
  }> = [
    {
      name: 'Sushi Platter substitutions string',
      analysis: { dishName: 'Sushi Platter', broadDishCategory: 'mixed platter' },
      mutate: (recipe) => ({
        ...recipe,
        dishName: 'Sushi Platter',
        title: 'Sushi Platter',
        substitutions: 'Use cooked shrimp instead of raw fish.',
      }),
      assertOutput: (output) => {
        assert.deepEqual(output.substitutions, ['Use cooked shrimp instead of raw fish.']);
      },
    },
    {
      name: 'Pasta equipment string',
      analysis: { dishName: 'Tomato Pasta', broadDishCategory: 'pasta/noodles' },
      mutate: (recipe) => ({
        ...recipe,
        dishName: 'Tomato Pasta',
        title: 'Tomato Pasta',
        equipment: 'large pot, skillet, tongs',
      }),
      assertOutput: (output) => {
        assert.deepEqual(output.equipment, ['large pot', 'skillet', 'tongs']);
      },
    },
    {
      name: 'Soup step tools string',
      analysis: { dishName: 'Tomato Soup', broadDishCategory: 'soup/stew' },
      mutate: (recipe) => ({
        ...recipe,
        dishName: 'Tomato Soup',
        title: 'Tomato Soup',
        steps: recipe.steps.map((step, index) => index === 0 ? { ...step, tools: 'pot, ladle' } : step),
      }),
      assertOutput: (output) => {
        const firstStep = output.steps[0];
        assert.deepEqual(typeof firstStep === 'object' && firstStep.tools, ['pot', 'ladle']);
      },
    },
    {
      name: 'Dessert spice pairings newline text',
      analysis: { dishName: 'Chocolate Cake', broadDishCategory: 'dessert' },
      mutate: (recipe) => ({
        ...recipe,
        dishName: 'Chocolate Cake',
        title: 'Chocolate Cake',
        spicePairings: 'cinnamon\nespresso powder\ncinnamon\n',
      }),
      assertOutput: (output) => {
        assert.deepEqual(output.spicePairings, ['cinnamon', 'espresso powder']);
      },
    },
    {
      name: 'Sandwich ingredientGroups singleton object',
      analysis: { dishName: 'Club Sandwich', broadDishCategory: 'mixed platter' },
      mutate: (recipe) => ({
        ...recipe,
        dishName: 'Club Sandwich',
        title: 'Club Sandwich',
        ingredientGroups: { component: 'sandwich', items: '2 slices bread\n3 oz turkey\n2 leaves lettuce' },
      }),
      assertOutput: (output) => {
        assert.equal(output.ingredientGroups.length, 1);
        assert.deepEqual(output.ingredientGroups[0].items, ['2 slices bread', '3 oz turkey', '2 leaves lettuce']);
      },
    },
    {
      name: 'General plated meal step ingredients string',
      analysis: { dishName: 'Grilled Chicken Plate', broadDishCategory: 'grilled meat' },
      mutate: (recipe) => ({
        ...recipe,
        dishName: 'Grilled Chicken Plate',
        title: 'Grilled Chicken Plate',
        steps: recipe.steps.map((step, index) => index === 1 ? { ...step, ingredients: 'olive oil, tomato sauce' } : step),
      }),
      assertOutput: (output) => {
        const secondStep = output.steps[1];
        assert.deepEqual(typeof secondStep === 'object' && secondStep.ingredients, ['olive oil', 'tomato sauce']);
      },
    },
  ];

  for (const testCase of cases) {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return providerResponse(testCase.mutate(buildValidRecipe(6)));
    };
    try {
      const output = await generateRecipeWithOpenRouter({
        analysis: analysis(testCase.analysis),
        config: testConfig,
        mode: 'Restaurant Copy',
      });

      assert.equal(calls, 1, testCase.name);
      assert.deepEqual(validateRecipeStructure(output), [], testCase.name);
      testCase.assertOutput(output);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('drink steps singleton object normalizes before strict content validation', () => {
  const normalized = normalizeRecipeProviderOutputShape({
    ...buildValidRecipe(6),
    dishName: 'Berry Smoothie',
    title: 'Berry Smoothie',
    steps: buildStep(1, {
      title: 'Blend Smoothie',
      step: 'Blend berries and milk for 1 minute until smooth.',
      ingredients: 'berries, milk',
      tools: 'blender',
    }),
  });

  const parsed = openRouterRecipeOutputSchema.parse(normalized);
  assert.equal(parsed.steps.length, 1);
  assert.deepEqual(typeof parsed.steps[0] === 'object' && parsed.steps[0].ingredients, ['berries', 'milk']);
  assert.deepEqual(typeof parsed.steps[0] === 'object' && parsed.steps[0].tools, ['blender']);
  assert.deepEqual(validateRecipeStructure(parsed), ['too_few_steps']);
});

test('all recipe schema array fields are covered by the shared normalizer map', () => {
  const schemaArrayPaths = collectZodArrayPaths(openRouterRecipeOutputSchema)
    .filter((path) => !path.includes('*'));
  const normalizedPaths = recipeArrayFieldDefinitions.map((definition) => definition.path).sort();

  assert.deepEqual(schemaArrayPaths.sort(), normalizedPaths);
});

test('recipe repair rejects a changed response when the final recipe is still invalid', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const initial = buildValidRecipe(6);
  initial.dishName = 'Unresolved Repair Pasta';
  initial.title = 'Unresolved Repair Pasta';
  initial.ingredients = ['8 oz rigatoni', '1 cup tomato sauce', '1 tbsp olive oil', '1/2 cup cream', '1/4 cup parmesan'];
  initial.steps = initial.steps.slice(0, 3);
  const repaired = structuredClone(initial);

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
        /too_few_steps/.test(error.failure.openRouterErrorMessage ?? ''),
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deterministic repair preserves Shrimp Fettuccine Alfredo ingredients without a model repair call', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const initial = {
    ...buildValidRecipe(8),
    description: 'A creamy inspired-by restaurant pasta with shrimp.',
  };
  initial.dishName = 'Shrimp Fettuccine Alfredo';
  initial.title = 'Shrimp Fettuccine Alfredo';
  initial.ingredients = [
    '8 oz fettuccine pasta',
    '12 oz shrimp, peeled and deveined',
    '2 tbsp unsalted butter',
    '1 tbsp olive oil',
    '3 cloves garlic, minced',
    '1 cup heavy cream',
    '1/2 cup grated parmesan cheese',
    '1/2 tsp kosher salt',
    '1/4 tsp black pepper',
    '2 tbsp chopped parsley',
  ];
  initial.steps = [
    buildStep(1, { title: 'Boil Pasta', step: 'Boil fettuccine pasta in salted water for 10 minutes until al dente.', ingredients: ['fettuccine pasta', 'salt', 'water'], tools: ['large pot'] }),
    buildStep(2, { title: 'Season Shrimp', step: 'Pat shrimp dry and season with salt and black pepper for 1 minute.', ingredients: ['shrimp', 'salt', 'black pepper'], tools: ['paper towels', 'bowl'] }),
    buildStep(3, { title: 'Sear Shrimp', step: 'Sear shrimp in olive oil for 3 minutes until pink and just firm.', ingredients: ['shrimp', 'olive oil'], tools: ['skillet'] }),
    buildStep(4, { title: 'Melt Butter', step: 'Melt butter with garlic for 1 minute until fragrant.', ingredients: ['butter', 'garlic'], tools: ['skillet'] }),
    buildStep(5, { title: 'Build Sauce', step: 'Simmer heavy cream for 3 minutes until lightly thickened.', ingredients: ['heavy cream'], tools: ['skillet'] }),
    buildStep(6, { title: 'Add Cheese', step: 'Whisk parmesan cheese into the cream for 1 minute until smooth.', ingredients: ['parmesan cheese', 'heavy cream'], tools: ['whisk'] }),
    buildStep(7, { title: 'Toss Pasta', step: 'Toss fettuccine pasta and shrimp in Alfredo sauce for 2 minutes until coated.', ingredients: ['fettuccine pasta', 'shrimp', 'heavy cream', 'parmesan cheese'], tools: ['tongs'] }),
    buildStep(8, { title: 'Finish Bowl', step: 'Top with parsley and black pepper, then serve hot.', ingredients: ['parsley', 'black pepper'], tools: ['serving bowl'] }),
  ];
  initial.steps[6] = buildStep(7, {
    title: 'Toss Pasta',
    step: 'Cook until done.',
    ingredients: ['fettuccine pasta', 'shrimp', 'heavy cream', 'parmesan cheese'],
    tools: ['tongs'],
  });

  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(initial);
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({
        dishName: 'Shrimp Fettuccine Alfredo',
        broadDishCategory: 'pasta/noodles',
        visibleIngredients: ['fettuccine pasta', 'shrimp', 'cream sauce'],
        likelyIngredients: ['butter', 'garlic', 'parmesan cheese', 'salt', 'black pepper', 'parsley'],
        visibleComponents: {
          protein: 'shrimp',
          sauce: 'Alfredo sauce',
          baseStarch: 'fettuccine pasta',
          vegetables: '',
          toppingsGarnish: 'parsley',
          cookingMethod: 'boiled pasta and sauteed shrimp',
        },
      }),
      config: testConfig,
      mode: 'Restaurant Copy',
    });

    assert.equal(calls, 1);
    assert.ok(output.ingredients.length >= initial.ingredients.length);
    for (const expected of ['fettuccine', 'shrimp', 'butter', 'olive oil', 'garlic', 'heavy cream', 'parmesan', 'salt', 'black pepper']) {
      assert.ok(
        output.ingredients.some((ingredient) => ingredient.toLowerCase().includes(expected)),
        `missing ${expected}`,
      );
    }
    assert.deepEqual(validateRecipeStructure(output), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
