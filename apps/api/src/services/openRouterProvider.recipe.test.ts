import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiConfig } from '../config/aiConfig.js';
import type { Recipe } from '../types.js';
import type { FoodImageAnalysis } from './aiService.js';
import {
  getMandatoryCorrectionRequirementsForPlan,
  getNutritionRequirementTargets,
  normalizeCorrectionText,
  parseCorrectionRequirements,
  evaluateNutritionRequirements,
  type CorrectionGenerationContext,
} from './correctionIntent.js';
import {
  askOkyoWithOpenRouter,
  generateRecipeEditWithOpenRouter,
  generateRecipeWithOpenRouter,
  normalizeRecipeProviderOutputShape,
  normalizeCorrectionPatchProviderOutput,
  parseCorrectionPatchProviderOutput,
  openRouterRecipeOutputSchema,
  OpenRouterProviderError,
  repairStepInstructionText,
  recipeArrayFieldDefinitions,
  validateRecipeStructure,
} from './openRouterProvider.js';
import { deriveDishAnatomy } from './dishAnatomy.js';
import type { FlavorPlan } from './flavorPlan.js';

test('dedicated correction patch schema accepts patch-only operation variants', () => {
  const parsed = parseCorrectionPatchProviderOutput({
    ingredientOperations: [
      { operation: 'remove', sourceIngredientId: ' ingredient-1 ', supportsRequirementIndexes: [] },
      { operation: 'add', result: { id: 'added-1', name: 'new component', quantity: '1 cup' }, supportsRequirementIndexes: [1] },
      { operation: 'replace', sourceIngredientId: 'ingredient-2', result: { name: 'updated component', quantity: '1/2 cup' }, supportsRequirementIndexes: [1] },
    ],
    stepOperations: [
      { operation: 'remove', sourceStepId: 'step-1' },
      { operation: 'add', result: { id: 'added-step-1', text: 'Use the new component.', ingredientReferences: ['added-1'] } },
    ],
    nutritionEstimate: { calories: '200', proteinGrams: '20', carbohydratesGrams: 10, fatGrams: 5 },
    metadataPatch: null,
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.ingredientOperations[0]?.sourceIngredientId, 'ingredient-1');
    assert.equal(parsed.data.nutritionEstimate?.calories, 200);
    assert.equal(parsed.data.metadataPatch, undefined);
  }
});

test('patch schema rejects operation-specific missing fields and normalizes missing arrays', () => {
  const empty = parseCorrectionPatchProviderOutput({});
  assert.equal(empty.success, true);
  if (empty.success) {
    assert.deepEqual(empty.data.ingredientOperations, []);
    assert.deepEqual(empty.data.stepOperations, []);
  }
  const invalid = parseCorrectionPatchProviderOutput({
    ingredientOperations: [{ operation: 'replace', result: { name: 'new component', quantity: '1 cup' } }],
  });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.ok(invalid.subcodes.includes('correction_patch_missing_source_id'));
});

test('normalizes generic operation aliases and inherits omitted source fields', () => {
  const source: Recipe = {
    id: 'source', scanResultId: 'scan', title: 'Test dish', mode: 'Normal', description: '',
    prepTimeMinutes: 5, cookTimeMinutes: 10, totalTimeMinutes: 15, servings: 2,
    difficulty: 'Easy', estimatedHomemadeCost: 1, estimatedSavings: 1,
    substitutions: [], pantryNote: '', confidenceNote: '',
    ingredients: [{ name: 'base component', quantity: '1 cup' }, { name: 'other component', quantity: '2 tbsp' }],
    steps: ['Mix base component.'],
    structuredSteps: [{ stepNumber: 1, title: 'Mix', text: 'Mix base component.', ingredientsUsed: ['base component'], toolsUsed: ['bowl'] } as any],
  };
  const parsed = parseCorrectionPatchProviderOutput({
    ingredientOperations: [
      { operation: 'swap', sourceIngredientId: ' ingredient-1 ', name: 'replacement component' },
      { operation: 'adjust_quantity', sourceIngredientId: 'ingredient-2', quantity: '4 tbsp' },
    ],
    stepOperations: [{ operation: 'update', sourceStepId: 'step-1', text: 'Mix the reduced-fat base component.' }],
  }, source);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.ingredientOperations[0]?.operation, 'replace');
    assert.equal(parsed.data.ingredientOperations[0]?.result.quantity, '1 cup');
    assert.equal(parsed.data.ingredientOperations[1]?.operation, 'change_quantity');
    assert.equal(parsed.data.ingredientOperations[1]?.result.name, 'other component');
    assert.equal(parsed.data.stepOperations[0]?.operation, 'replace');
    assert.equal(parsed.data.stepOperations[0]?.result.text, 'Mix the reduced-fat base component.');
  }
});

test('rejects genuinely unsupported correction operation aliases', () => {
  const parsed = parseCorrectionPatchProviderOutput({
    ingredientOperations: [{ operation: 'teleport', sourceIngredientId: 'ingredient-1', result: { name: 'x', quantity: '1 cup' } }],
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.ok(parsed.subcodes.includes('correction_patch_operation_invalid'));
});

test('step repair never invents generic durations or repeated suffixes', () => {
  for (const text of ['Chop 1 onion.', 'Mix the sauce.', 'Plate the rice.', 'Serve immediately.', 'Garnish with scallions.']) {
    const repaired = repairStepInstructionText(text, ['onion']);
    assert.equal(repaired, text);
    assert.doesNotMatch(repaired, /for 2 minutes|until hot and evenly coated|until fragrant or lightly browned/);
  }
  assert.equal(repairStepInstructionText('Bake the chicken for 25 minutes until golden.', ['chicken']), 'Bake the chicken for 25 minutes until golden.');
});

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

function buildEditSourceRecipe(): Recipe {
  return {
    id: 'source-edit-recipe',
    scanResultId: 'source-edit-scan',
    title: 'High Protein Oreo Dessert',
    mode: 'Normal',
    description: 'A yogurt dessert with Oreo cookies.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 0,
    totalTimeMinutes: 30,
    activeTimeMinutes: 10,
    passiveTimeMinutes: 20,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 6,
    estimatedSavings: 8,
    ingredients: [
      { name: 'Oreo cookies', quantity: '1 cup' },
      { name: 'Greek yogurt', quantity: '2 cups' },
    ],
    steps: ['Fold the Oreo cookies into the Greek yogurt.'],
    structuredSteps: [{
      title: 'Mix',
      text: 'Fold the Oreo cookies into the Greek yogurt.',
      ingredientsUsed: ['Oreo cookies', 'Greek yogurt'],
      toolsUsed: ['bowl'],
    }],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated recipe.',
    equipment: ['bowl'],
    nutritionEstimate: {
      calories: 400,
      proteinGrams: 25,
      carbohydratesGrams: 45,
      fatGrams: 12,
    },
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
    inputKind: 'prepared_dish',
    dishName: 'Creamy Tomato Pasta',
    cuisine: 'Homestyle',
    restaurantStyle: 'Homestyle',
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
    modes: ['Normal', 'Lighter', 'Healthier', 'More Protein'],
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

test('Ask Okyo keeps a valid answer when the provider returns an empty optional correction', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => providerResponse({
    answer: 'Use nutritional yeast for a dairy-free savory finish.',
    suggestedCorrection: '',
  });
  try {
    const result = await askOkyoWithOpenRouter({
      config: testConfig,
      question: 'What can I use instead of Parmesan?',
      recipe: buildEditSourceRecipe(),
      dietaryRestrictions: ['dairy-free'],
    });
    assert.deepEqual(result, { answer: 'Use nutritional yeast for a dairy-free savory finish.' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function correctionContext(
  note = 'Apply a relevant edit',
  focused = false,
): CorrectionGenerationContext {
  const plan = parseCorrectionRequirements(note);
  const intent = plan.requirements[0];
  const originalRecipe: Recipe = {
    id: 'source-revision',
    scanResultId: 'scan-revision',
    title: 'Savory Pasta',
    mode: 'Normal',
    description: 'A simple savory pasta.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 6,
    estimatedSavings: 10,
    ingredients: [
      { name: 'pasta', quantity: '8 oz' },
      { name: 'tomato sauce', quantity: '1 cup' },
      { name: 'cream', quantity: '1/2 cup' },
      { name: 'parmesan', quantity: '1/4 cup' },
      { name: 'olive oil', quantity: '1 tbsp' },
    ],
    steps: Array.from({ length: 6 }, (_, index) => `Complete step ${index + 1}.`),
    structuredSteps: Array.from({ length: 6 }, (_, index) => ({
      title: `Step ${index + 1}`,
      text: `Complete step ${index + 1}.`,
      ingredientsUsed: ['olive oil'],
      toolsUsed: ['skillet'],
    })),
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated recipe.',
    equipment: ['skillet'],
    nutritionEstimate: {
      calories: 520,
      proteinGrams: 18,
      carbohydratesGrams: 70,
      fatGrams: 19,
    },
  };
  return {
    note,
    normalizedNote: normalizeCorrectionText(note),
    intent,
    intents: plan.requirements,
    requirements: getMandatoryCorrectionRequirementsForPlan(plan.requirements, originalRecipe),
    nutritionRequirements: getNutritionRequirementTargets(originalRecipe, plan.requirements),
    originalRecipe,
    ...(focused
      ? {
          missedRequirements: ['The requested outcome was not applied.'],
          previousCandidate: originalRecipe,
        }
      : {}),
  };
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

test('rejects an empty instruction set without enforcing an arbitrary step count', () => {
  const parsed = openRouterRecipeOutputSchema.parse({ dishName: 'X', title: 'X', steps: [] });
  assert.deepEqual(validateRecipeStructure(parsed), ['no_usable_steps']);
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

test('output schema preserves valid nutrition estimates and rejects malformed values', () => {
  const parsed = openRouterRecipeOutputSchema.parse({
    ...buildValidRecipe(),
    nutritionEstimate: {
      calories: 520,
      proteinGrams: 35,
      carbohydratesGrams: 48,
      fatGrams: 20,
    },
  });

  assert.deepEqual(parsed.nutritionEstimate, {
    calories: 520,
    proteinGrams: 35,
    carbohydratesGrams: 48,
    fatGrams: 20,
  });
  for (const nutritionEstimate of [
    { calories: -1, proteinGrams: 1, carbohydratesGrams: 1, fatGrams: 1 },
    { calories: Number.NaN, proteinGrams: 1, carbohydratesGrams: 1, fatGrams: 1 },
    { calories: Number.POSITIVE_INFINITY, proteinGrams: 1, carbohydratesGrams: 1, fatGrams: 1 },
    { calories: 5001, proteinGrams: 1, carbohydratesGrams: 1, fatGrams: 1 },
  ]) {
    assert.throws(() => openRouterRecipeOutputSchema.parse({ ...buildValidRecipe(), nutritionEstimate }));
  }
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
      mode: 'Normal',
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
      mode: 'Normal',
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
        mode: 'Normal',
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
  assert.deepEqual(validateRecipeStructure(parsed), []);
});

test('permissive recipe normalization accepts common complete-recipe aliases', () => {
  const normalized = normalizeRecipeProviderOutputShape({
    recipeName: 'Creamy Seed Pasta',
    recipeDescription: 'A quick pantry pasta.',
    serves: 'Serves 4',
    tools: ['pot', 'bowl'],
    ingredients: [
      '8 oz pasta',
      { name: 'sunflower-seed butter', quantity: '1/2 cup' },
      { ingredient: 'black garlic', amount: '3 cloves' },
    ],
    instructions: [
      'Boil the pasta for 9 minutes.',
      { name: 'Make Sauce', description: 'Whisk the sunflower-seed butter with black garlic.' },
    ],
    nutrition: { calories: '420 kcal', protein: '18 g', carbs: '56 g', fat: '14 g' },
    prepTimeMinutes: 10,
    cookTime: '9 minutes',
    totalTimeMinutes: 19,
    unrelatedProviderField: { ignored: true },
  });

  const parsed = openRouterRecipeOutputSchema.parse(normalized);
  assert.equal(parsed.title, 'Creamy Seed Pasta');
  assert.equal(parsed.description, 'A quick pantry pasta.');
  assert.equal(parsed.servings, 4);
  assert.deepEqual(parsed.equipment, ['pot', 'bowl']);
  assert.deepEqual(parsed.ingredients, [
    '8 oz pasta',
    '1/2 cup sunflower-seed butter',
    '3 cloves black garlic',
  ]);
  assert.equal(parsed.steps.length, 2);
  assert.equal(parsed.steps[0], 'Boil the pasta for 9 minutes.');
  assert.equal(typeof parsed.steps[1] === 'object' && parsed.steps[1].step, 'Whisk the sunflower-seed butter with black garlic.');
  assert.equal(parsed.prepTime, '10');
  assert.equal(parsed.cookTime, '9 minutes');
  assert.equal(parsed.totalTime, '19');
  assert.deepEqual(parsed.nutritionEstimate, {
    calories: 420,
    proteinGrams: 18,
    carbohydratesGrams: 56,
    fatGrams: 14,
  });
  assert.equal('unrelatedProviderField' in parsed, false);
});

test('directions, macros, yield, and requiredEquipment normalize without optional metadata', () => {
  const parsed = openRouterRecipeOutputSchema.parse(normalizeRecipeProviderOutputShape({
    name: 'Simple Marinated Tofu',
    yield: '2 servings',
    requiredEquipment: ['bowl'],
    ingredients: [{ ingredient: 'tofu', amount: '12 oz' }],
    directions: [{ instruction: 'Marinate the tofu for 30 minutes.' }],
    macros: { calories: 260, protein: 24, carbohydrates: 10, fat: 14, fiber: 3 },
    prepTime: '5 minutes',
    totalTime: '35 minutes',
  }));

  assert.equal(parsed.title, 'Simple Marinated Tofu');
  assert.equal(parsed.servings, 2);
  assert.deepEqual(parsed.ingredients, ['12 oz tofu']);
  assert.equal(typeof parsed.steps[0] === 'object' && parsed.steps[0].step, 'Marinate the tofu for 30 minutes.');
  assert.deepEqual(typeof parsed.steps[0] === 'object' && parsed.steps[0].ingredients, []);
  assert.deepEqual(typeof parsed.steps[0] === 'object' && parsed.steps[0].tools, []);
  assert.deepEqual(parsed.nutritionEstimate, {
    calories: 260,
    proteinGrams: 24,
    carbohydratesGrams: 10,
    fatGrams: 14,
    fiberGrams: 3,
  });
});

test('the reproduced live edit shape normalizes ingredient objects inside component groups', () => {
  const parsed = openRouterRecipeOutputSchema.parse(normalizeRecipeProviderOutputShape({
    title: 'High Protein Chocolate Dessert',
    description: 'A chilled high-protein chocolate dessert.',
    servings: 2,
    difficulty: 'Easy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 0,
    totalTimeMinutes: 40,
    activeTimeMinutes: 10,
    passiveTimeMinutes: 30,
    ingredients: [
      { name: 'Greek yogurt', quantity: '2 cups' },
      { name: 'protein powder', quantity: '1/2 cup' },
    ],
    ingredientGroups: [{
      component: 'Dessert',
      items: [
        { name: 'Greek yogurt', quantity: '2 cups' },
        { ingredient: 'protein powder', amount: '1/2 cup' },
      ],
    }],
    equipment: ['mixing bowl'],
    steps: [{
      stepNumber: 1,
      phase: 2,
      title: 'Mix',
      step: 'Whisk the Greek yogurt and protein powder.',
      ingredients: ['Greek yogurt', 'protein powder'],
      tools: ['mixing bowl'],
      activeMinutes: 5,
      passiveMinutes: 0,
      elapsedMinutes: 5,
      timeEstimate: '5 minutes hands-on',
    }],
    nutritionEstimate: {
      calories: 320,
      proteinGrams: 38,
      carbohydratesGrams: 24,
      fatGrams: 8,
      fiberGrams: 3,
    },
  }));

  assert.deepEqual(parsed.ingredientGroups, [{
    component: 'Dessert',
    items: ['2 cups Greek yogurt', '1/2 cup protein powder'],
  }]);
  assert.deepEqual(parsed.ingredients, ['2 cups Greek yogurt', '1/2 cup protein powder']);
  assert.equal(parsed.prepTime, '10');
  assert.equal(parsed.totalTime, '40');
});

test('a normalizable complete edit uses one call and the edit-only 2048-token floor', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let requestedMaxTokens = 0;
  globalThis.fetch = async (_request, init) => {
    calls += 1;
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { max_tokens?: number }
      : {};
    requestedMaxTokens = body.max_tokens ?? 0;
    return providerResponse({
      title: 'High Protein Chocolate Dessert',
      prepTimeMinutes: 10,
      totalTimeMinutes: 40,
      ingredients: [
        { name: 'Greek yogurt', quantity: '2 cups' },
        { name: 'protein powder', quantity: '1/2 cup' },
      ],
      ingredientGroups: [{
        component: 'Dessert',
        items: [
          { name: 'Greek yogurt', quantity: '2 cups' },
          { name: 'protein powder', quantity: '1/2 cup' },
        ],
      }],
      steps: ['Whisk the Greek yogurt with protein powder and chill for 30 minutes.'],
    });
  };

  try {
    const output = await generateRecipeEditWithOpenRouter({
      analysis: analysis({ dishName: 'High Protein Oreo Dessert' }),
      config: { ...testConfig, maxOutputTokens: 1024 },
      currentRecipe: buildEditSourceRecipe(),
      editMessage: 'No Oreo and more protein',
    });
    assert.equal(calls, 1);
    assert.equal(requestedMaxTokens, 2048);
    assert.equal(output.title, 'High Protein Chocolate Dessert');
    assert.deepEqual(output.ingredientGroups[0]?.items, [
      '2 cups Greek yogurt',
      '1/2 cup protein powder',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('two non-recipe edit responses stop after one schema retry', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse({ message: 'I cannot provide a recipe.' });
  };

  try {
    await assert.rejects(
      generateRecipeEditWithOpenRouter({
        analysis: analysis({ dishName: 'High Protein Oreo Dessert' }),
        config: { ...testConfig, maxOutputTokens: 1024 },
        currentRecipe: buildEditSourceRecipe(),
        editMessage: 'No Oreo and more protein',
      }),
      (error: unknown) => error instanceof OpenRouterProviderError &&
        error.failure.reason === 'openrouter_invalid_schema',
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid optional nutrition is dropped instead of rejecting an otherwise usable recipe', () => {
  const parsed = openRouterRecipeOutputSchema.parse(normalizeRecipeProviderOutputShape({
    title: 'Simple Fruit Bowl',
    ingredients: ['1 cup berries'],
    steps: ['Place the berries in a bowl.'],
    nutrition: { protein: 2 },
  }));

  assert.equal(parsed.nutritionEstimate, undefined);
  assert.deepEqual(parsed.steps, ['Place the berries in a bowl.']);
});

test('all recipe schema array fields are covered by the shared normalizer map', () => {
  const schemaArrayPaths = collectZodArrayPaths(openRouterRecipeOutputSchema)
    .filter((path) => !path.includes('*'));
  const normalizedPaths = recipeArrayFieldDefinitions.map((definition) => definition.path).sort();

  assert.deepEqual(schemaArrayPaths.sort(), normalizedPaths);
});

test('a usable short recipe remains deliverable when optional repair cannot improve it', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const initial = { ...buildValidRecipe(6), description: '' };
  initial.dishName = 'Unresolved Repair Pasta';
  initial.title = 'Unresolved Repair Pasta';
  initial.description = 'A simple recipe using the main ingredient.';
  initial.ingredients = ['8 oz rigatoni', '1 cup tomato sauce', '1 tbsp olive oil', '1/2 cup cream', '1/4 cup parmesan'];
  initial.steps = initial.steps.slice(0, 3);
  const repaired = structuredClone(initial);

  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(calls === 1 ? initial : repaired);
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Unresolved Repair Pasta' }),
      config: testConfig,
      mode: 'Normal',
    });
    assert.equal(calls, 2);
    assert.equal(output.steps.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function filledCroissantAnalysis() {
  const base = analysis({
    dishName: 'Filled Fruit Croissant',
    broadDishCategory: 'dessert',
    visibleIngredients: ['croissant', 'fruit filling'],
    likelyIngredients: ['plum'],
    visibleComponents: {
      protein: '', sauce: 'plum jam', baseStarch: 'croissant', vegetables: '', toppingsGarnish: '', cookingMethod: 'baked',
    },
  });
  return { ...base, anatomy: deriveDishAnatomy(base) };
}

function filledCroissantRepairCandidate() {
  return {
    dishName: 'Filled Fruit Croissant',
    title: 'Plum-Filled Croissant',
    description: 'A flaky pastry with a bright plum center.',
    ingredients: ['1 sheet puff pastry', '1/2 cup plum jam', '1 tbsp sugar', '1 tsp lemon juice'],
    steps: [
      buildStep(1, { title: 'Cook Filling', step: 'Cook plum jam with sugar and lemon juice until glossy.', ingredients: ['plum jam', 'sugar', 'lemon juice'], tools: ['saucepan'] }),
      buildStep(2, { title: 'Cut Pastry', step: 'Cut puff pastry into triangles on a lightly floured board.', ingredients: ['puff pastry'], tools: ['chef knife', 'cutting board'] }),
      buildStep(3, { title: 'Cool Filling', step: 'Cool plum jam until no longer hot to the touch.', ingredients: ['plum jam'], tools: ['bowl'] }),
      buildStep(4, { title: 'Fill Pastry', step: 'Place plum jam on each pastry triangle before rolling.', ingredients: ['plum jam', 'puff pastry'], tools: ['spoon'] }),
      buildStep(5, { title: 'Assemble Croissants', step: 'Roll and seal each pastry triangle around the plum jam.', ingredients: ['puff pastry', 'plum jam'], tools: ['baking sheet'] }),
      buildStep(6, { title: 'Bake Pastry', step: 'Bake filled pastries until puffed and golden brown.', ingredients: ['puff pastry'], tools: ['oven'] }),
    ],
  };
}

test('a repairable missing-filling contract issue uses one focused quality repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const initial = { ...buildValidRecipe(6), dishName: 'Filled Fruit Croissant', title: 'Plain Croissant', ingredients: ['1 sheet puff pastry', '1 tbsp olive oil'] };
  const repaired = filledCroissantRepairCandidate();
  globalThis.fetch = async () => providerResponse(++calls === 1 ? initial : repaired);
  try {
    const output = await generateRecipeWithOpenRouter({ analysis: filledCroissantAnalysis(), config: testConfig, mode: 'Normal' });
    assert.equal(calls, 2);
    assert.equal(output.title, 'Plum-Filled Croissant');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a failed optional quality repair returns the original safe candidate', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const invalid = { ...buildValidRecipe(6), dishName: 'Filled Fruit Croissant', title: 'Plain Croissant', ingredients: ['1 sheet puff pastry', '1 tbsp olive oil'] };
  globalThis.fetch = async () => providerResponse(++calls === 1 ? invalid : invalid);
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: { ...filledCroissantAnalysis(), dishName: 'Filled Fruit Croissant Failed Repair' },
      config: testConfig,
      mode: 'Normal',
    });
    assert.equal(calls, 2);
    assert.equal(output.title, 'Plain Croissant');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('two- and three-step usable recipes are not rejected for being simple', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const candidates = [buildValidRecipe(2), buildValidRecipe(3)];
  globalThis.fetch = async () => providerResponse(candidates[calls++] ?? candidates.at(-1));
  try {
    const twoStep = await generateRecipeWithOpenRouter({ analysis: analysis({ dishName: 'Two Step Dessert' }), config: testConfig, mode: 'Normal' });
    const threeStep = await generateRecipeWithOpenRouter({ analysis: analysis({ dishName: 'Three Step Dessert' }), config: testConfig, mode: 'Normal' });
    assert.equal(twoStep.steps.length, 2);
    assert.equal(threeStep.steps.length, 3);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stale flavor metadata is a soft diagnostic and does not block delivery', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const stalePlan: FlavorPlan = {
    aromatics: [],
    coreSeasonings: [],
    balancingElements: [{ ingredient: 'granulated sugar', role: 'sweetness', quantity: '1 tbsp', stage: 'mixing' }],
    finishingElements: [],
  };
  const candidate = buildValidRecipe(3);
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(candidate);
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: `Simple Dessert ${Date.now()}`, flavorPlan: stalePlan }),
      config: testConfig,
      mode: 'Normal',
    });
    assert.equal(output.title, candidate.title);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function yeastCroissantAnalysis() {
  return analysis({
    dishName: 'Plain Butter Croissant',
    broadDishCategory: 'dessert',
    visibleIngredients: ['croissant dough', 'yeast', 'butter'],
    likelyIngredients: ['flour', 'butter'],
    visibleComponents: {
      protein: '', sauce: '', baseStarch: 'croissant dough', vegetables: '', toppingsGarnish: '', cookingMethod: 'baked',
    },
    mealDescription: 'A plain butter croissant with no filling',
  });
}

function yeastCroissantCandidate(includeProof = false) {
  const candidate = {
    ...buildValidRecipe(8),
    dishName: 'Plain Butter Croissant',
    title: 'Butter Croissant',
    ingredients: ['1 cup croissant dough', '1 tsp yeast', '2 tbsp butter', '1 cup flour', '1/2 tsp salt'],
    steps: [
      buildStep(1, { title: 'Mix Dough', step: 'Mix croissant dough with yeast and butter.', ingredients: ['croissant dough', 'yeast', 'butter'], tools: ['bowl'] }),
      buildStep(2, { title: 'Laminate Dough', step: 'Fold the croissant dough into layers with butter.', ingredients: ['croissant dough', 'butter'], tools: ['rolling pin'] }),
      buildStep(3, { title: 'Early Rise', step: 'Form the dough into a ball and let the dough rise for 60 minutes before shaping.', ingredients: ['croissant dough'], tools: ['bowl'] }),
      buildStep(4, { title: 'Shape Croissants', step: 'Shape the croissant dough into plain crescents.', ingredients: ['croissant dough'], tools: ['baking sheet'] }),
      ...(includeProof ? [buildStep(5, { title: 'Final Proof', step: 'Rest until puffy for 45 minutes.', ingredients: ['croissant dough'], tools: ['baking sheet'], estimatedMinutes: 45 })] : []),
      buildStep(includeProof ? 6 : 5, { title: 'Egg Wash', step: 'Brush the shaped croissants with egg wash.', ingredients: ['croissant dough'], tools: ['pastry brush'] }),
      buildStep(includeProof ? 7 : 6, { title: 'Bake Croissants', step: 'Bake the croissants for 18 minutes.', ingredients: ['croissant dough'], tools: ['oven'] }),
      buildStep(includeProof ? 8 : 7, { title: 'Cool Croissants', step: 'Cool the plain croissants before serving.', ingredients: ['croissant dough'], tools: ['cooling rack'] }),
    ],
  };
  return candidate;
}

test('missing final proof receives one narrow deterministic fallback after provider repair', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const invalid = yeastCroissantCandidate(false);
  globalThis.fetch = async () => providerResponse(++calls === 1 ? invalid : invalid);
  try {
    const output = await generateRecipeWithOpenRouter({ analysis: { ...yeastCroissantAnalysis(), dishName: 'Plain Butter Croissant No Duplicate' }, config: testConfig, mode: 'Normal' });
    assert.equal(calls, 2);
    const texts = output.steps.map((step) => typeof step === 'string' ? step : step.step);
    const proofIndex = texts.findIndex((text) => /final proof|proof|puffy/i.test(text));
    const shapeIndex = texts.findIndex((text) => /shape/i.test(text));
    const bakeIndex = texts.findIndex((text) => /bake/i.test(text));
    assert.ok(proofIndex > shapeIndex && proofIndex < bakeIndex);
    assert.ok(texts.some((text) => /early rise|rise for 60 minutes before shaping/i.test(text)));
    assert.equal(texts.filter((text) => /proof|puffy/i.test(text)).length, 1);
    assert.equal((output.steps[proofIndex] as { estimatedMinutes?: number }).estimatedMinutes, 53);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('missing lamination wait receives explicit text and structured timing before final reconciliation', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const invalid = yeastCroissantCandidate(true);
  invalid.steps[1] = buildStep(2, {
    title: 'Laminate Dough',
    step: 'Roll out the dough again and fold it into thirds; repeat this process 3 times, chilling between folds.',
    ingredients: ['croissant dough', 'butter'],
    tools: ['rolling pin'],
    estimatedMinutes: 4,
  });
  globalThis.fetch = async () => providerResponse(++calls === 1 ? invalid : invalid);
  try {
    const output = await generateRecipeWithOpenRouter({ analysis: yeastCroissantAnalysis(), config: testConfig, mode: 'Normal' });
    const laminate = output.steps.find((step) => typeof step !== 'string' && /laminate/i.test(step.title ?? '')) as {
      step: string;
      activeMinutes?: number;
      passiveMinutes?: number;
      elapsedMinutes?: number;
      timeEstimate?: string;
    } | undefined;
    assert.ok(laminate);
    assert.match(laminate.step, /30 minutes/);
    assert.equal(laminate.activeMinutes, 4);
    assert.equal(laminate.passiveMinutes, 90);
    assert.equal(laminate.elapsedMinutes, 94);
    assert.match(laminate.timeEstimate ?? '', /4 minutes hands-on/);
    assert.ok(Number(output.totalTime ?? 0) >= 94);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deterministic proof repair replaces misplaced and short post-shaping proofs while preserving early fermentation', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const invalid = yeastCroissantCandidate(false);
  invalid.steps = [
    ...invalid.steps.slice(0, 4),
    buildStep(5, { title: 'Short Final Proof', step: 'Proof the shaped croissants for 10 minutes.', ingredients: ['croissant dough'], tools: ['baking sheet'], estimatedMinutes: 10 }),
    ...invalid.steps.slice(4).map((step, index) => typeof step === 'string' ? step : { ...step, stepNumber: index + 6 }),
    buildStep(9, { title: 'Late Proof', step: 'Let the baked croissants rise for 45 minutes.', ingredients: ['croissant dough'], tools: ['cooling rack'], estimatedMinutes: 45 }),
  ];
  globalThis.fetch = async () => providerResponse(++calls === 1 ? invalid : invalid);
  try {
    const output = await generateRecipeWithOpenRouter({ analysis: { ...yeastCroissantAnalysis(), dishName: 'Plain Butter Croissant Proof Replacement' }, config: testConfig, mode: 'Normal' });
    const texts = output.steps.map((step) => typeof step === 'string' ? step : step.step);
    const shapeIndex = texts.findIndex((text) => /shape/i.test(text));
    const proofIndexes = texts.map((text, index) => /proof|puffy/i.test(text) ? index : -1).filter((index) => index >= 0);
    const eggWashIndex = texts.findIndex((text) => /egg wash/i.test(text));
    const bakeIndex = texts.findIndex((text) => /bake/i.test(text));
    assert.equal(calls, 2);
    assert.equal(proofIndexes.length, 1);
    assert.ok(proofIndexes[0] > shapeIndex);
    assert.ok(proofIndexes[0] < eggWashIndex);
    assert.ok(proofIndexes[0] < bakeIndex);
    assert.ok(texts.some((text) => /early rise|rise for 60 minutes before shaping/i.test(text)));
    assert.equal((output.steps[proofIndexes[0]] as { estimatedMinutes?: number }).estimatedMinutes, 53);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a valid provider proof is preserved without a duplicate deterministic proof', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const valid = yeastCroissantCandidate(true);
  globalThis.fetch = async () => providerResponse(++calls === 1 ? yeastCroissantCandidate(false) : valid);
  try {
    const output = await generateRecipeWithOpenRouter({ analysis: { ...yeastCroissantAnalysis(), dishName: 'Plain Butter Croissant Valid Proof' }, config: testConfig, mode: 'Normal' });
    assert.equal(calls, 2);
    assert.equal(output.steps.filter((step) => /proof|puffy/i.test(typeof step === 'string' ? step : step.step)).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a misplaced pre-shaping Final Proof is moved after shaping without deleting the early rise', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const invalid = yeastCroissantCandidate(false);
  invalid.steps = [
    ...invalid.steps.slice(0, 3),
    buildStep(4, { title: 'Final Proof', step: 'Proof the dough before shaping for 45 minutes.', ingredients: ['croissant dough'], tools: ['bowl'], estimatedMinutes: 45 }),
    ...invalid.steps.slice(3).map((step, index) => typeof step === 'string' ? step : { ...step, stepNumber: index + 5 }),
  ];
  globalThis.fetch = async () => providerResponse(++calls === 1 ? invalid : invalid);
  try {
    const output = await generateRecipeWithOpenRouter({ analysis: { ...yeastCroissantAnalysis(), dishName: 'Plain Butter Croissant Misplaced Proof' }, config: testConfig, mode: 'Normal' });
    const texts = output.steps.map((step) => typeof step === 'string' ? step : step.step);
    const shapeIndex = texts.findIndex((text) => /shape/i.test(text));
    const proofIndexes = texts.map((text, index) => /proof|puffy/i.test(text) ? index : -1).filter((index) => index >= 0);
    assert.equal(calls, 2);
    assert.equal(proofIndexes.length, 1);
    assert.ok(proofIndexes[0] > shapeIndex);
    assert.ok(texts.some((text) => /early rise|rise for 60 minutes before shaping/i.test(text)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deterministic repair preserves Shrimp Fettuccine Alfredo ingredients without a model repair call', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const initial = {
    ...buildValidRecipe(8),
    description: 'A creamy homemade restaurant pasta with shrimp.',
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
      mode: 'Normal',
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

test('a correction automatically retries one malformed provider response without surfacing an intermediate failure', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('<html>temporary upstream response</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    return providerResponse(buildValidRecipe(6));
  };

  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Savory Pasta' }),
      config: testConfig,
      correction: correctionContext('Make it brighter'),
      mode: 'Normal',
    });
    assert.equal(calls, 2);
    assert.equal(output.title, 'Creamy Tomato Pasta');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('compound correction prompts require every goal and focused repair preserves satisfied goals', async () => {
  const originalFetch = globalThis.fetch;
  let capturedPrompt = '';
  globalThis.fetch = async (_input, init) => {
    capturedPrompt = typeof init?.body === 'string' ? init.body : '';
    return providerResponse(buildValidRecipe(6));
  };

  try {
    const context = correctionContext('less fat and more protein', true);
    const partialCandidate: Recipe = {
      ...context.originalRecipe,
      ingredients: context.originalRecipe.ingredients.map((ingredient, index) =>
        index === 4 ? { ...ingredient, quantity: '2 tsp' } : ingredient),
      steps: context.originalRecipe.steps.map((step, index) =>
        index === 0 ? `${step} Use the adjusted olive oil quantity.` : step),
      structuredSteps: context.originalRecipe.structuredSteps?.map((step, index) =>
        index === 0
          ? { ...step, text: `${step.text} Use the adjusted olive oil quantity.` }
          : step),
      nutritionEstimate: {
        calories: 495,
        proteinGrams: 20,
        carbohydratesGrams: 70,
        fatGrams: 16,
      },
    };
    context.missedRequirements = [
      'Requirement 2 (nutrition_goal): Per-serving protein did not make the required meaningful change.',
    ];
    context.previousCandidate = partialCandidate;
    context.previousRequirementEvaluations = evaluateNutritionRequirements(
      context.originalRecipe,
      partialCandidate,
      context.intents,
    );
    await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Savory Pasta' }),
      config: testConfig,
      correction: context,
      mode: 'Normal',
    });

    assert.match(capturedPrompt, /Parsed ordered requirements: 1\. nutrition_goal; 2\. nutrition_goal/);
    assert.match(capturedPrompt, /ALL parsed requirements below are mandatory/);
    assert.match(capturedPrompt, /\(fat, less\): original 19 g; corrected value MUST be at most 16\.15 g/);
    assert.match(capturedPrompt, /\(protein, more\): original 18 g; corrected value MUST be at least 21\.6 g/);
    assert.match(capturedPrompt, /Requirement 2 \(nutrition_goal\).*protein/s);
    assert.match(capturedPrompt, /candidate 20 g; required at least 21\.6 g; numeric target FAIL/);
    assert.match(capturedPrompt, /candidate 16 g; required at most 16\.15 g; numeric target PASS/);
    assert.match(capturedPrompt, /repair only those misses, preserve every already-satisfied requirement/);
    assert.match(capturedPrompt, /Use the previous candidate as the repair base/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('focused nutrition repair preserves a passing quantity-only edit with a generic step', async () => {
  const originalFetch = globalThis.fetch;
  let capturedPrompt = '';
  globalThis.fetch = async (_input, init) => {
    capturedPrompt = typeof init?.body === 'string' ? init.body : '';
    return providerResponse(buildValidRecipe(6));
  };

  try {
    const context = correctionContext('more protein', true);
    const candidate: Recipe = {
      ...context.originalRecipe,
      ingredients: context.originalRecipe.ingredients.map((ingredient, index) =>
        index === 0 ? { ...ingredient, quantity: '10 oz' } : ingredient),
      nutritionEstimate: {
        calories: 540,
        proteinGrams: 24,
        carbohydratesGrams: 70,
        fatGrams: 19,
      },
    };
    context.previousCandidate = candidate;
    context.previousRequirementEvaluations = evaluateNutritionRequirements(
      context.originalRecipe,
      candidate,
      context.intents,
    );
    context.previousIngredientChanges = [{
      kind: 'quantity_changed',
      beforeName: 'savory component',
      afterName: 'savory component',
      normalizedBeforeName: 'savory component',
      normalizedAfterName: 'savory component',
      beforeQuantity: '8 oz',
      afterQuantity: '10 oz',
      affectedRequirementIndexes: [1],
      affectedStepIndexes: [],
      referencedInSteps: false,
    }];
    context.missedRequirements = [
      'An ingredient or quantity changed for the nutrition goal but is missing from the affected instructions.',
    ];

    await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Savory Pasta' }),
      config: testConfig,
      correction: context,
      mode: 'Normal',
    });

    assert.match(capturedPrompt, /candidate 24 g; required at least 21\.6 g; numeric target PASS/);
    assert.match(capturedPrompt, /ingredient or quantity evidence PASS; step evidence PASS/);
    assert.match(capturedPrompt, /quantity_changed: savory component -> savory component; step evidence FAIL/);
    assert.match(capturedPrompt, /repair only those misses, preserve every already-satisfied requirement/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a correction performs at most one automatic retry for malformed or transient upstream failures', async () => {
  for (const scenario of [
    {
      name: 'malformed response',
      expectedReason: 'openrouter_invalid_json',
      response: () => new Response('not-json', { status: 200 }),
    },
    {
      name: 'transient HTTP failure',
      expectedReason: 'openrouter_http_error',
      response: () => new Response('temporarily unavailable', { status: 503 }),
    },
  ]) {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return scenario.response();
    };
    try {
      await assert.rejects(
        generateRecipeWithOpenRouter({
          analysis: analysis({ dishName: 'Savory Pasta' }),
          config: testConfig,
          correction: correctionContext('Make it brighter'),
          mode: 'Normal',
        }),
        (error: unknown) =>
          error instanceof OpenRouterProviderError &&
          error.failure.reason === scenario.expectedReason,
        scenario.name,
      );
      assert.equal(calls, scenario.expectedReason === 'openrouter_invalid_json' ? 3 : 2, scenario.name);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('the single focused correction repair does not start another automatic retry loop', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('not-json', { status: 200 });
  };

  try {
    await assert.rejects(
      generateRecipeWithOpenRouter({
        analysis: analysis({ dishName: 'Savory Pasta' }),
        config: testConfig,
        correction: correctionContext('Make it brighter', true),
        mode: 'Normal',
      }),
      (error: unknown) =>
        error instanceof OpenRouterProviderError &&
        error.failure.reason === 'openrouter_invalid_json',
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
