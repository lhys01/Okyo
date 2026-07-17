import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiConfig } from '../config/aiConfig.js';
import type { ProviderQuota } from '../quota/providerQuota.js';
import {
  createCompactRecipeFromOpenRouterOutput,
  foodImageAnalysisSchema,
  type FoodImageAnalysis,
} from './aiService.js';
import {
  compactRecipeOutputSchema,
  generateRecipeWithOpenRouter,
  getRecipePromptSizeComparison,
  openRouterRecipeOutputSchema,
  validateCompactRecipeOutput,
  type CompactRecipeOutput,
} from './openRouterProvider.js';
import { validateIngredientClosure } from './recipeIngredientValidation.js';
import { createScanAggregateTiming } from '../telemetry/scanTelemetry.js';

const config: AiConfig = {
  enabled: true,
  provider: 'openrouter',
  openRouterApiKey: 'server-only-test-key',
  openRouterVisionModel: 'vision-model',
  openRouterTextModel: 'recipe-model',
  timeoutMs: 1_000,
  maxOutputTokens: 1_024,
  compactRecipeEnabled: true,
  fableEnabled: false,
  fableModel: 'fable-model',
  isFableActive: false,
};

const quota: ProviderQuota = {
  async reserveAttempt(input) {
    return { spendEventId: `spend-${input.operation}`, operation: input.operation };
  },
  async completeAttempt() {},
};

function analysis(overrides: Partial<FoodImageAnalysis> = {}): FoodImageAnalysis {
  return foodImageAnalysisSchema.parse({
    candidateScanId: 'scan-fixture',
    aiSource: 'openrouter_ai',
    dishName: 'Lemon Chicken',
    cuisine: 'Restaurant-style',
    restaurantStyle: 'Restaurant-style',
    scanState: 'clear_food',
    broadDishCategory: 'grilled meat',
    confidence: 0.9,
    confidenceReason: 'Clear plated food.',
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['chicken', 'lemon'],
    likelyIngredients: ['olive oil', 'salt'],
    possibleDishNames: ['Lemon Chicken'],
    visibleComponents: {
      protein: 'chicken',
      sauce: 'lemon sauce',
      baseStarch: '',
      vegetables: '',
      toppingsGarnish: 'lemon',
      cookingMethod: 'seared',
    },
    restaurantPriceEstimate: 0,
    homemadeCostEstimate: 0,
    matchScore: 8.5,
    difficulty: 'Easy',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    notes: ['fixture'],
    detectedComponents: [],
    ...overrides,
  });
}

function chickenRecipe(overrides: Partial<CompactRecipeOutput> = {}): CompactRecipeOutput {
  return compactRecipeOutputSchema.parse({
    title: 'Lemon Chicken',
    ingredients: [
      '1 lb boneless chicken breasts',
      '1 tbsp olive oil',
      '1/2 tsp salt',
      '1 lemon',
    ],
    equipment: ['large skillet', 'instant-read thermometer'],
    steps: [
      { instruction: 'Pat the chicken dry for 1 minute.' },
      { instruction: 'Heat the olive oil for 2 minutes until shimmering.' },
      { instruction: 'Sear the chicken for 5 minutes until golden.' },
      {
        instruction: 'Turn and cook the chicken for 6 minutes until browned.',
        doneWhen: 'The center is opaque.',
        safetyNote: 'Cook chicken to 165°F / 74°C at the thickest part.',
      },
      { instruction: 'Rest the chicken for 5 minutes before slicing.' },
    ],
    prepTime: 5,
    cookTime: 13,
    totalTime: 18,
    servings: 2,
    difficulty: 'Easy',
    ...overrides,
  });
}

test('normal compact recipe is one provider call and skips Epicure enrichment', async () => {
  const originalFetch = globalThis.fetch;
  const previousEpicure = process.env.EPICURE_ENABLED;
  process.env.EPICURE_ENABLED = 'true';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(chickenRecipe());
  };
  try {
    const timing = createScanAggregateTiming({ requestId: 'compact-call-count' });
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Call Count Lemon Chicken' }),
      config,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'compact-call-count',
      timing,
    });
    assert.equal(calls, 1);
    assert.equal(timing.logicalProviderCalls, 1);
    assert.equal(timing.providerAttempts, 1);
    assert.deepEqual(timing.repairReasons, []);
    assert.equal(output.steps.length, 5);
    assert.ok(output.steps.every((step) => typeof step === 'object' && Array.isArray(step.ingredients)));
    assert.ok(output.steps.every((step) => typeof step === 'object' && Array.isArray(step.tools)));
    assert.equal(output.spicePairings.length, 0);
    assert.equal(output.substitutions.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousEpicure === undefined) delete process.env.EPICURE_ENABLED;
    else process.env.EPICURE_ENABLED = previousEpicure;
  }
});

test('compact provider output is canonical and reused across selected modes', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(chickenRecipe({ title: 'Canonical Lemon Chicken' }));
  };
  const dishAnalysis = analysis({ dishName: 'Canonical Cache Lemon Chicken' });
  try {
    const restaurantCopy = await generateRecipeWithOpenRouter({
      analysis: dishAnalysis,
      config,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'compact-canonical-restaurant',
    });
    const budget = await generateRecipeWithOpenRouter({
      analysis: dishAnalysis,
      config,
      mode: 'Budget',
      quota,
      requestId: 'compact-canonical-budget',
    });
    assert.equal(calls, 1);
    assert.equal(restaurantCopy.title, budget.title);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('one targeted repair returns a complete compact object using the previous output', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let repairPrompt = '';
  const unsafe = chickenRecipe({
    title: 'Repair Lemon Chicken',
    steps: chickenRecipe().steps.map((step) => ({ ...step, safetyNote: '' })),
  });
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    if (calls === 1) return providerResponse(unsafe);
    const body = JSON.parse(String(init?.body)) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    repairPrompt = body.messages?.find((message) => message.role === 'user')?.content ?? '';
    return providerResponse(chickenRecipe({ title: 'Repair Lemon Chicken' }));
  };
  try {
    const timing = createScanAggregateTiming({ requestId: 'compact-repair-count' });
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Repair Lemon Chicken' }),
      config,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'compact-repair-count',
      timing,
    });
    assert.equal(calls, 2);
    assert.equal(timing.logicalProviderCalls, 2);
    assert.equal(timing.providerAttempts, 2);
    assert.deepEqual(timing.repairReasons, ['missing_safety_poultry']);
    assert.match(JSON.stringify(output.steps), /165/);
    assert.match(repairPrompt, /missing_safety_poultry/);
    assert.match(repairPrompt, /Full canonical ingredient list/);
    assert.match(repairPrompt, /Previous output/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('one targeted repair can replace a truncated compact response', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return providerResponse('{"title":"Truncated', 'length');
    }
    return providerResponse(chickenRecipe({ title: 'Recovered Lemon Chicken' }));
  };
  try {
    const output = await generateRecipeWithOpenRouter({
      analysis: analysis({ dishName: 'Truncated Lemon Chicken' }),
      config,
      mode: 'Restaurant Copy',
      quota,
      requestId: 'compact-truncation-repair',
    });
    assert.equal(calls, 2);
    assert.equal(output.title, 'Recovered Lemon Chicken');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('compact mapper keeps the core recipe and derives step metadata locally', () => {
  const output = compactRecipeOutputSchema.parse(chickenRecipe());
  const canonical = {
    ...output,
    steps: output.steps.map((step) => ({
      step: step.instruction,
      doneWhen: step.doneWhen,
      safetyNote: step.safetyNote,
    })),
    prepTime: String(output.prepTime),
    cookTime: String(output.cookTime),
    totalTime: String(output.totalTime),
    servings: output.servings,
    skillLevel: output.difficulty,
    dishName: '',
    description: '',
    avoidMistake: '',
    mistakeWarning: '',
    substitutions: [],
    storageAndReheating: '',
    storage: '',
    groceryItems: [],
    spicePairings: [],
    cookingTerms: [],
    activeTime: '',
  };
  const result = createCompactRecipeFromOpenRouterOutput(
    openRouterRecipeOutputSchema.parse(canonical),
    analysis(),
    'Restaurant Copy',
  );
  const recipe = result.recipe!;
  const closure = validateIngredientClosure(recipe);

  assert.equal(recipe.isCompactRecipe, true);
  assert.equal(recipe.steps.length, recipe.structuredSteps?.length);
  assert.ok(recipe.structuredSteps?.some((step) =>
    step.ingredientsUsed?.some((ingredient) => ingredient.includes('chicken'))));
  assert.ok(recipe.structuredSteps?.some((step) => step.toolsUsed?.includes('skillet')));
  assert.equal(closure.unknownStepIngredients.length, 0);
  assert.equal(recipe.groceryItems, undefined);
  assert.equal(recipe.ingredientGroups, undefined);
  assert.deepEqual(recipe.substitutions, []);
  assert.match(recipe.steps.join(' '), /165°F/);
});

test('missing quantities and unlisted step ingredients are critical defects', () => {
  const missingQuantity = chickenRecipe({
    ingredients: ['chicken breasts', '1 tbsp olive oil', '1/2 tsp salt', '1 lemon'],
  });
  assert.ok(validateCompactRecipeOutput(missingQuantity, analysis()).includes(
    'ingredient_missing_exact_quantity',
  ));

  const unlistedButter = chickenRecipe({
    steps: chickenRecipe().steps.map((step, index) => index === 2
      ? { ...step, instruction: 'Sear the chicken in butter for 5 minutes until golden.' }
      : step),
  });
  assert.ok(validateCompactRecipeOutput(unlistedButter, analysis()).includes(
    'step_uses_unlisted_ingredients',
  ));
});

test('missing time or completion cues remain a critical compact defect', () => {
  const missingCue = chickenRecipe({
    steps: chickenRecipe().steps.map((step, index) => index === 1
      ? {
          instruction: 'Heat the olive oil in the skillet.',
          doneWhen: '',
          safetyNote: '',
        }
      : step),
  });
  assert.ok(validateCompactRecipeOutput(missingCue, analysis()).includes(
    'step_missing_time_or_completion_cue',
  ));
});

test('extra cookable compact steps are accepted without repair-only failure', () => {
  const recipe = chickenRecipe({
    steps: [
      ...chickenRecipe().steps,
      ...chickenRecipe().steps.slice(0, 4),
    ],
  });
  assert.ok(!validateCompactRecipeOutput(recipe, analysis()).includes('too_many_steps'));
});

test('an invalid compact repair fails closed after the one repair budget', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const unsafe = chickenRecipe({
    steps: chickenRecipe().steps.map((step) => ({ ...step, safetyNote: '' })),
  });
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse(unsafe);
  };
  try {
    await assert.rejects(
      generateRecipeWithOpenRouter({
        analysis: analysis({ dishName: 'Invalid Repair Lemon Chicken' }),
        config,
        mode: 'Restaurant Copy',
        quota,
        requestId: 'compact-invalid-repair',
      }),
      (error: unknown) => {
        assert.equal(error instanceof Error && error.name, 'RecipeValidationError');
        return true;
      },
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('simple foods and drinks permit appropriately short compact recipes', () => {
  const simpleAnalysis = analysis({
    dishName: 'Watermelon Cubes',
    broadDishCategory: 'fruit',
    visibleIngredients: ['watermelon'],
  });
  const simple = compactRecipeOutputSchema.parse({
    title: 'Watermelon Cubes',
    ingredients: ['4 cups watermelon cubes'],
    equipment: ['knife'],
    steps: [
      { instruction: 'Slice the watermelon for 2 minutes into even cubes.' },
      { instruction: 'Chill the cubes for 10 minutes until cold.' },
    ],
    prepTime: 4,
    cookTime: 0,
    totalTime: 4,
    servings: 2,
    difficulty: 'Easy',
  });
  assert.deepEqual(validateCompactRecipeOutput(simple, simpleAnalysis), []);

  const drinkAnalysis = analysis({
    dishName: 'Berry Smoothie',
    broadDishCategory: 'drink/beverage',
    visibleIngredients: ['berries', 'milk'],
  });
  const drink = compactRecipeOutputSchema.parse({
    title: 'Berry Smoothie',
    ingredients: ['2 cups frozen berries', '1 cup milk', '1 tbsp honey'],
    equipment: ['blender'],
    steps: [
      { instruction: 'Measure the berries, milk, and honey for 1 minute.' },
      { instruction: 'Blend for 45 seconds until completely smooth.' },
      { instruction: 'Pour immediately when the smoothie looks glossy.' },
    ],
    prepTime: 3,
    cookTime: 0,
    totalTime: 3,
    servings: 2,
    difficulty: 'Easy',
  });
  assert.deepEqual(validateCompactRecipeOutput(drink, drinkAnalysis), []);
});

test('raw poultry, ground meat, cooked fish, and raw fish retain safety coverage', () => {
  const missingPoultry = chickenRecipe({
    steps: chickenRecipe().steps.map((step) => ({ ...step, safetyNote: '' })),
  });
  assert.ok(validateCompactRecipeOutput(missingPoultry, analysis()).includes('missing_safety_poultry'));

  const groundMeatAnalysis = analysis({
    dishName: 'Beef Burger',
    broadDishCategory: 'burger/sandwich',
    visibleIngredients: ['ground beef'],
  });
  const groundMeat = chickenRecipe({
    title: 'Beef Burger',
    ingredients: ['1 lb ground beef', '1 tsp salt', '1 tbsp olive oil'],
    steps: chickenRecipe().steps.map((step, index) => ({
      ...step,
      instruction: step.instruction.replace(/chicken/g, 'beef patty'),
      safetyNote: index === 3 ? 'Cook ground beef to 160°F / 71°C inside.' : '',
    })),
  });
  assert.ok(!validateCompactRecipeOutput(groundMeat, groundMeatAnalysis).some((issue) =>
    issue.startsWith('missing_safety_')));

  const fishAnalysis = analysis({
    dishName: 'Grilled Salmon',
    broadDishCategory: 'seafood',
    visibleIngredients: ['salmon'],
  });
  const fish = chickenRecipe({
    title: 'Grilled Salmon',
    ingredients: ['1 lb salmon fillet', '1 tbsp olive oil', '1/2 tsp salt'],
    steps: chickenRecipe().steps.map((step, index) => ({
      ...step,
      instruction: step.instruction.replace(/chicken/g, 'salmon'),
      safetyNote: index === 3 ? 'Cook salmon to 145°F / 63°C inside.' : '',
    })),
  });
  assert.ok(!validateCompactRecipeOutput(fish, fishAnalysis).some((issue) =>
    issue.startsWith('missing_safety_')));

  const sushiAnalysis = analysis({
    dishName: 'Salmon Sashimi',
    broadDishCategory: 'seafood',
    visibleIngredients: ['raw salmon'],
  });
  const sushi = compactRecipeOutputSchema.parse({
    title: 'Salmon Sashimi',
    ingredients: ['8 oz sushi-grade salmon', '1 tbsp soy sauce', '1 tsp wasabi'],
    equipment: ['sharp knife'],
    steps: [
      {
        instruction: 'Keep the salmon chilled for 10 minutes before cutting.',
        safetyNote: 'Use sushi-grade or previously frozen fish and keep it cold.',
      },
      { instruction: 'Slice the salmon for 2 minutes into even pieces.' },
      { instruction: 'Plate immediately while the salmon remains cold.' },
    ],
    prepTime: 8,
    cookTime: 0,
    totalTime: 8,
    servings: 2,
    difficulty: 'Medium',
  });
  assert.deepEqual(validateCompactRecipeOutput(sushi, sushiAnalysis), []);
});

test('genuine multi-component platters require at least 90 percent component coverage', () => {
  const platterAnalysis = analysis({
    dishName: 'Sushi Platter',
    broadDishCategory: 'mixed platter',
    detectedComponents: [
      { name: 'Salmon Nigiri', confidence: 0.9 },
      { name: 'Tuna Nigiri', confidence: 0.9 },
      { name: 'California Roll', confidence: 0.9 },
      { name: 'Edamame', confidence: 0.9 },
      { name: 'Pickled Ginger', confidence: 0.9 },
    ],
  });
  const platter = compactRecipeOutputSchema.parse({
    title: 'Sushi Platter',
    ingredients: [
      '8 oz sushi-grade salmon',
      '8 oz sushi-grade tuna',
      '2 cups cooked sushi rice',
      '8 sheets nori',
      '1 cup imitation crab',
      '1 avocado',
      '1 cup shelled edamame',
      '1/2 cup pickled ginger',
    ],
    equipment: ['sharp knife', 'rice paddle', 'bamboo mat'],
    steps: [
      {
        instruction: 'Keep the salmon and tuna chilled for 10 minutes.',
        safetyNote: 'Use sushi-grade or previously frozen fish and keep it cold.',
      },
      { instruction: 'Shape the salmon and sushi rice into salmon nigiri for 5 minutes until compact.' },
      { instruction: 'Shape the tuna and sushi rice into tuna nigiri for 5 minutes until compact.' },
      { instruction: 'Roll the nori, imitation crab, avocado, and sushi rice into a California roll for 4 minutes until firm.' },
      { instruction: 'Boil the edamame for 5 minutes until tender.' },
      { instruction: 'Plate the pickled ginger immediately while cold.' },
    ],
    prepTime: 25,
    cookTime: 5,
    totalTime: 30,
    servings: 4,
    difficulty: 'Hard',
  });
  assert.deepEqual(validateCompactRecipeOutput(platter, platterAnalysis), []);

  const incomplete = {
    ...platter,
    ingredients: platter.ingredients.filter((ingredient) => !ingredient.includes('ginger')),
    steps: platter.steps.filter((step) => !step.instruction.includes('ginger')),
  };
  assert.ok(validateCompactRecipeOutput(incomplete, platterAnalysis).includes('platter_coverage_below_90'));
});

test('invalid time and serving values fail compact schema parsing', () => {
  assert.throws(() => compactRecipeOutputSchema.parse({
    ...chickenRecipe(),
    prepTime: 'soon',
  }));
  assert.throws(() => compactRecipeOutputSchema.parse({
    ...chickenRecipe(),
    servings: 'several',
  }));
});

test('compact prompt is materially smaller than the current full prompt', () => {
  const comparison = getRecipePromptSizeComparison(analysis({
    dishName: 'Restaurant Lemon Chicken',
    likelyIngredients: ['olive oil', 'garlic', 'butter', 'lemon', 'parsley'],
  }));
  assert.ok(comparison.compactPromptChars < comparison.fullPromptChars * 0.65);
  assert.ok(comparison.estimatedCompactPromptTokens < comparison.estimatedFullPromptTokens);
});

function providerResponse(content: unknown, finishReason = 'stop'): Response {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: finishReason,
      message: {
        content: typeof content === 'string' && finishReason === 'length'
          ? content
          : JSON.stringify(content),
      },
    }],
    usage: {
      prompt_tokens: 500,
      completion_tokens: 400,
      total_tokens: 900,
      cost: 0.001,
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
