import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessPlatterCoverage,
  generateRecipeFromDish,
  normalizeRecipeIngredients,
  normalizeVisionOutput,
  type FoodImageAnalysis,
} from './aiService.js';
import type { RecipeIngredient } from '../types.js';

function recipeAnalysis(overrides: Partial<FoodImageAnalysis> = {}): FoodImageAnalysis {
  return {
    candidateScanId: `scan-${Math.random().toString(36).slice(2)}`,
    aiSource: 'openrouter_ai',
    inputKind: 'prepared_dish',
    dishName: 'Lemon Chicken',
    cuisine: 'Homestyle',
    restaurantStyle: 'Homestyle',
    scanState: 'clear_food',
    broadDishCategory: 'grilled poultry',
    confidence: 0.82,
    confidenceReason: 'Test fixture.',
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['chicken', 'lemon'],
    likelyIngredients: ['olive oil', 'salt'],
    possibleDishNames: [],
    visibleComponents: {
      protein: 'chicken',
      sauce: '',
      baseStarch: '',
      vegetables: '',
      toppingsGarnish: 'lemon',
      cookingMethod: 'seared',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 7,
    matchScore: 8,
    difficulty: 'Easy',
    modes: ['Normal', 'Lighter', 'Healthier', 'More Protein'],
    notes: [],
    detectedComponents: [],
    ...overrides,
  };
}

function recipeProviderResponse(recipe: unknown): Promise<Response> {
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

function withRecipeEnv<T>(run: () => Promise<T>): Promise<T> {
  const originalAiEnabled = process.env.AI_ENABLED;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalMaxTokens = process.env.AI_MAX_OUTPUT_TOKENS;
  const originalEpicureEnabled = process.env.EPICURE_ENABLED;
  const originalEpicureAnalytics = process.env.EPICURE_ANALYTICS;
  process.env.AI_ENABLED = 'true';
  process.env.OPENROUTER_API_KEY = 'sk-test';
  process.env.AI_MAX_OUTPUT_TOKENS = '4096';
  // These fixtures mock the recipe provider call sequence directly. Keep the
  // optional Epicure provider call off so a developer's local .env cannot shift
  // the response queue underneath the test.
  process.env.EPICURE_ENABLED = 'false';
  process.env.EPICURE_ANALYTICS = 'off';

  return run().finally(() => {
    if (originalAiEnabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = originalAiEnabled;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
    if (originalMaxTokens === undefined) delete process.env.AI_MAX_OUTPUT_TOKENS;
    else process.env.AI_MAX_OUTPUT_TOKENS = originalMaxTokens;
    if (originalEpicureEnabled === undefined) delete process.env.EPICURE_ENABLED;
    else process.env.EPICURE_ENABLED = originalEpicureEnabled;
    if (originalEpicureAnalytics === undefined) delete process.env.EPICURE_ANALYTICS;
    else process.env.EPICURE_ANALYTICS = originalEpicureAnalytics;
  });
}

function buildProviderRecipe(overrides: Record<string, unknown> = {}) {
  return {
    dishName: 'Test Platter',
    title: 'Test Platter',
    description: 'A compact homestyle platter.',
    ingredients: ['1 lb chicken thighs', '2 cups cooked rice', '2 tbsp soy sauce', '1 tbsp vegetable oil', '1 tsp kosher salt', '1 scallion'],
    equipment: ['skillet', 'cutting board'],
    steps: [
      { stepNumber: 1, phase: 1, title: 'Prep Ingredients', step: 'Slice 1 scallion and pat 1 lb chicken dry for 2 minutes.', ingredients: ['scallion', 'chicken'], tools: ['knife'] },
      { stepNumber: 2, phase: 2, title: 'Heat Skillet', step: 'Heat 1 tbsp oil in a skillet for 2 minutes until shimmering.', ingredients: ['vegetable oil'], tools: ['skillet'] },
      { stepNumber: 3, phase: 3, title: 'Cook Chicken', step: 'Cook chicken for 8 minutes until browned and 165°F / 74°C inside.', ingredients: ['chicken'], tools: ['skillet'] },
      { stepNumber: 4, phase: 3, title: 'Warm Rice', step: 'Warm 2 cups rice for 3 minutes until steaming.', ingredients: ['rice'], tools: ['saucepan'] },
      { stepNumber: 5, phase: 4, title: 'Sauce Plate', step: 'Toss chicken with 2 tbsp soy sauce for 1 minute until glossy.', ingredients: ['chicken', 'soy sauce'], tools: ['spoon'] },
      { stepNumber: 6, phase: 6, title: 'Serve Plate', step: 'Plate chicken and rice together while hot.', ingredients: ['chicken', 'rice'], tools: ['plate'] },
    ],
    prepTime: '10 minutes',
    cookTime: '15 minutes',
    totalTime: '25 minutes',
    servings: 2,
    skillLevel: 'Easy',
    avoidMistake: 'Do not crowd the skillet.',
    substitutions: [],
    storageAndReheating: 'Refrigerate leftovers up to 3 days.',
    spicePairings: [],
    ...overrides,
  };
}

test('normalizes dim cluttered restaurant food into an uncertain food result', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'spicy noodle bowl',
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'pasta/noodles',
    cuisine: 'Homestyle',
    confidence: 68,
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['noodles', 'dark sauce', 'green garnish'],
    likelyIngredients: ['noodles', 'soy-based sauce', 'chili oil'],
    visibleComponents: {
      baseStarch: 'noodles',
      cookingMethod: 'sauced and tossed',
      protein: '',
      sauce: 'dark glossy sauce',
      toppingsGarnish: 'green garnish',
      vegetables: '',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 6,
    confidenceReason: 'Dim lighting and table clutter make the exact dish uncertain.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'food_present_uncertain_dish');
  assert.equal(analysis.dishName, 'Spicy Noodle Bowl');
  assert.ok(analysis.confidence >= 0.4 && analysis.confidence <= 0.85);
});

test('keeps a cautious comparable restaurant estimate when a prepared dish has no visible menu price', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'saucy rice bowl',
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'rice bowl',
    cuisine: 'Homestyle',
    confidence: 67,
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['rice', 'sauce', 'green garnish'],
    likelyIngredients: ['rice', 'sauce', 'seasoning'],
    visibleComponents: {
      baseStarch: 'rice',
      cookingMethod: 'assembled bowl',
      protein: '',
      sauce: 'glossy sauce',
      toppingsGarnish: 'green garnish',
      vegetables: '',
    },
    homemadeCostEstimate: 8,
    restaurantPriceEstimate: 18,
    confidenceReason: 'Food is visible, but no menu or receipt price appears in the photo.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.restaurantPriceEstimate, 18);
  assert.equal(analysis.homemadeCostEstimate, 8);
});

test('keeps non-generic possible dish names for uncertain food', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'charred grill plate',
    possibleDishNames: ['mixed restaurant plate', 'grilled meat plate', 'loaded sandwich'],
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'grilled meat',
    cuisine: 'Homestyle',
    confidence: 61,
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['charred meat', 'dark sauce', 'garnish'],
    likelyIngredients: ['grilled meat', 'sauce', 'herbs'],
    visibleComponents: {
      baseStarch: '',
      cookingMethod: 'charred or grilled',
      protein: 'meat',
      sauce: 'dark sauce',
      toppingsGarnish: 'green garnish',
      vegetables: '',
    },
    restaurantPriceEstimate: 0,
    homemadeCostEstimate: 9,
    confidenceReason: 'The exact dish is unclear, but food is visible.',
  });

  assert.deepEqual(analysis.possibleDishNames.slice(0, 3), [
    'Charred Grill Plate',
    'Grilled Meat Plate',
    'Loaded Sandwich',
  ]);
});

test('keeps multiple-plate scans focused on the central edible dish', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'grilled chicken rice bowl',
    scanState: 'clear_food',
    broadDishCategory: 'rice bowl',
    cuisine: 'Homestyle',
    confidence: 82,
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['rice', 'grilled chicken', 'cucumber', 'sauce'],
    likelyIngredients: ['rice', 'chicken', 'vegetables', 'yogurt sauce'],
    visibleComponents: {
      baseStarch: 'rice',
      cookingMethod: 'grilled',
      protein: 'chicken',
      sauce: 'white sauce',
      toppingsGarnish: '',
      vegetables: 'cucumber',
    },
    restaurantPriceEstimate: 17,
    homemadeCostEstimate: 7,
    confidenceReason: 'The central bowl is the largest visible dish.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'clear_food');
  assert.equal(analysis.dishName, 'Grilled Chicken Rice Bowl');
});

test('treats screenshots of food posts as food when food is visible', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'cheesy pizza',
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'pizza',
    cuisine: 'Homestyle',
    confidence: '64',
    isFoodImage: 'true',
    isRestaurantMeal: 'true',
    visibleIngredients: ['pizza slice', 'cheese', 'tomato sauce'],
    likelyIngredients: ['pizza dough', 'mozzarella', 'tomato sauce'],
    visibleComponents: {
      baseStarch: 'pizza crust',
      cookingMethod: 'baked',
      protein: '',
      sauce: 'tomato sauce',
      toppingsGarnish: 'melted cheese',
      vegetables: '',
    },
    restaurantPriceEstimate: 5,
    homemadeCostEstimate: 2,
    confidenceReason: 'Screenshot UI is present, but the food is visible.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'food_present_uncertain_dish');
  assert.equal(analysis.broadDishCategory, 'pizza');
});

test('rescues contradictory partial-food output when visible components show food', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'unknown',
    scanState: 'partial_food',
    broadDishCategory: 'unknown food dish',
    cuisine: '',
    confidence: 52,
    isFoodImage: false,
    isRestaurantMeal: false,
    visibleIngredients: ['fried chicken', 'sauce'],
    likelyIngredients: ['chicken', 'seasoned coating', 'sauce'],
    visibleComponents: {
      cookingMethod: 'fried',
      baseStarch: '',
      protein: 'chicken',
      sauce: 'orange sauce',
      toppingsGarnish: '',
      vegetables: '',
    },
    restaurantPriceEstimate: 16,
    homemadeCostEstimate: 6,
    confidenceReason: 'Only part of the saucy food is visible.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'partial_food');
  assert.equal(analysis.dishName, 'Saucy Fried Chicken');
});

test('downgrades too-unclear to partial food when ingredients and components show food', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'unclear dish',
    scanState: 'too_unclear',
    broadDishCategory: 'mixed platter',
    cuisine: 'Homestyle',
    confidence: 48,
    foodDetected: true,
    isFoodImage: false,
    isRestaurantMeal: false,
    visibleIngredients: ['rice', 'sauce', 'grilled meat'],
    likelyIngredients: ['rice', 'sauce', 'seasoned meat'],
    visibleComponents: {
      baseStarch: 'rice',
      cookingMethod: 'grilled',
      protein: 'meat',
      sauce: 'sauce',
      toppingsGarnish: '',
      vegetables: '',
    },
    restaurantPriceEstimate: 19,
    homemadeCostEstimate: 7,
    confidenceReason: 'The photo is dim, but food is visible.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'partial_food');
  assert.equal(analysis.dishName, 'Saucy Rice Bowl');
});

test('downgrades low-confidence too-unclear when response still contains food words', () => {
  const analysis = normalizeVisionOutput({
    dishName: '',
    scanState: 'too_unclear',
    broadDishCategory: 'unknown food dish',
    cuisine: '',
    confidence: 28,
    foodDetected: false,
    isFoodImage: false,
    isRestaurantMeal: false,
    rejectionReason: 'Dark charred meat and sauce are visible but hard to identify.',
    visibleIngredients: [],
    likelyIngredients: [],
    visibleComponents: {
      baseStarch: '',
      cookingMethod: '',
      protein: '',
      sauce: '',
      toppingsGarnish: '',
      vegetables: '',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 7,
    confidenceReason: 'The photo is dim, but it appears to contain a grilled or charred plate.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'partial_food');
  assert.equal(analysis.dishName, 'Grilled Meat Plate');
});

test('rescues not-food output when dish name and components show food evidence', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'mixed grill plate',
    scanState: 'not_food',
    broadDishCategory: 'grilled meat',
    cuisine: 'Homestyle',
    confidence: 71,
    foodDetected: false,
    isFoodImage: false,
    isRestaurantMeal: false,
    visibleIngredients: ['grilled meat', 'sauce', 'greens'],
    likelyIngredients: ['seasoned meat', 'herbs', 'sauce'],
    visibleComponents: {
      baseStarch: '',
      cookingMethod: 'grilled',
      protein: 'meat',
      sauce: 'brown sauce',
      toppingsGarnish: 'greens',
      vegetables: 'greens',
    },
    restaurantPriceEstimate: 22,
    homemadeCostEstimate: 9,
    confidenceReason: 'The model contradicted itself, but visible food components are present.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'food_present_uncertain_dish');
  assert.equal(analysis.dishName, 'Mixed Grill Plate');
});

test('uses broad best guess for complicated food with no exact dish name', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'unclear dish',
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'mixed platter',
    cuisine: '',
    confidence: 57,
    foodDetected: true,
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['sauce', 'garnish', 'charred pieces'],
    likelyIngredients: ['grilled meat', 'sauce', 'vegetables'],
    visibleComponents: {
      baseStarch: '',
      cookingMethod: 'charred or grilled',
      protein: 'meat',
      sauce: 'dark sauce',
      toppingsGarnish: 'green garnish',
      vegetables: 'vegetables',
    },
    restaurantPriceEstimate: 20,
    homemadeCostEstimate: 8,
    confidenceReason: 'Busy restaurant table and dim lighting make exact dish uncertain.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'partial_food');
  assert.equal(analysis.broadDishCategory, 'mixed platter');
  assert.equal(analysis.dishName, 'Grilled Meat Plate');
});

test('keeps simple clear food successful', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'Margherita pizza',
    scanState: 'clear_food',
    broadDishCategory: 'pizza',
    cuisine: 'Italian',
    confidence: 91,
    foodDetected: true,
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: ['pizza crust', 'tomato sauce', 'mozzarella', 'basil'],
    likelyIngredients: ['flour', 'tomato sauce', 'mozzarella', 'basil'],
    visibleComponents: {
      baseStarch: 'pizza crust',
      cookingMethod: 'baked',
      protein: '',
      sauce: 'tomato sauce',
      toppingsGarnish: 'basil',
      vegetables: '',
    },
    restaurantPriceEstimate: 16,
    homemadeCostEstimate: 6,
    confidenceReason: 'The pizza is centered and clearly visible.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.scanState, 'clear_food');
  assert.equal(analysis.dishName, 'Margherita Pizza');
});

test('keeps clear non-food rejected with no recipe direction', () => {
  const analysis = normalizeVisionOutput({
    dishName: '',
    scanState: 'not_food',
    broadDishCategory: 'unknown food dish',
    cuisine: '',
    confidence: 92,
    isFoodImage: false,
    isRestaurantMeal: false,
    rejectionReason: 'This does not look like a food photo.',
    visibleIngredients: [],
    likelyIngredients: [],
    visibleComponents: {
      baseStarch: '',
      cookingMethod: '',
      protein: '',
      sauce: '',
      toppingsGarnish: '',
      vegetables: '',
    },
    restaurantPriceEstimate: 0,
    homemadeCostEstimate: 0,
    confidenceReason: 'The image appears to show a receipt, not food.',
  });

  assert.equal(analysis.isFoodImage, false);
  assert.equal(analysis.scanState, 'not_food');
  assert.equal(analysis.rejectionReason, 'This does not look like a food photo.');
});

test('keeps truly blurry or blocked images too unclear when no food evidence exists', () => {
  const analysis = normalizeVisionOutput({
    dishName: '',
    scanState: 'too_unclear',
    broadDishCategory: 'unknown food dish',
    cuisine: '',
    confidence: 24,
    foodDetected: false,
    isFoodImage: false,
    isRestaurantMeal: false,
    rejectionReason: 'Please try a clearer food photo.',
    visibleIngredients: [],
    likelyIngredients: [],
    visibleComponents: {
      baseStarch: '',
      cookingMethod: '',
      protein: '',
      sauce: '',
      toppingsGarnish: '',
      vegetables: '',
    },
    restaurantPriceEstimate: 0,
    homemadeCostEstimate: 0,
    confidenceReason: 'The image is too blurry and blocked to identify food.',
  });

  assert.equal(analysis.isFoodImage, false);
  assert.equal(analysis.scanState, 'too_unclear');
  assert.equal(analysis.rejectionReason, 'Please try a clearer food photo.');
});

test('warns instead of failing when General Tso chicken and rice cover primary components but garnish is absent', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const analysis = recipeAnalysis({
    dishName: "General Tso's Chicken With Rice",
    broadDishCategory: 'mixed platter',
    visibleIngredients: ['crispy chicken pieces', 'white rice', 'orange chili sauce', 'sesame seeds', 'scallions'],
    likelyIngredients: ['chicken', 'rice', 'soy sauce', 'sugar'],
    visibleComponents: {
      protein: 'crispy chicken pieces',
      sauce: 'orange chili sauce',
      baseStarch: 'white rice',
      vegetables: '',
      toppingsGarnish: 'sesame seeds and scallions',
      cookingMethod: 'fried and sauced',
    },
    detectedComponents: [
      { name: 'Crispy Chicken Pieces', confidence: 0.86 },
      { name: 'White Rice', confidence: 0.86 },
      { name: 'Orange Chili Sauce', confidence: 0.86 },
      { name: 'Sesame Seeds', confidence: 0.86 },
      { name: 'Scallions', confidence: 0.86 },
    ],
  });
  const recipe = buildProviderRecipe({
    dishName: "General Tso's Chicken With Rice",
    title: "General Tso's Chicken With Rice",
    ingredientGroups: [
      { component: 'Crispy Chicken Pieces', items: ['1 lb chicken thighs', '1 tbsp vegetable oil'] },
      { component: 'White Rice', items: ['2 cups cooked white rice'] },
      { component: 'Orange Chili Sauce', items: ['2 tbsp soy sauce', '1 tbsp sugar'] },
    ],
  });

  globalThis.fetch = async () => {
    fetchCalls += 1;
    return recipeProviderResponse(recipe);
  };

  try {
    await withRecipeEnv(async () => {
      const output = await generateRecipeFromDish({ analysis, mode: 'Normal' });
      assert.equal(fetchCalls, 1);
      assert.ok(output.recipe);
      assert.deepEqual(output.warnings?.map((warning) => warning.split(':')[0]), ['platter_coverage_below_90']);
      assert.match(output.recipe.confidenceNote, /platter_coverage_below_90/);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('warns instead of failing when sushi platter core sushi is covered but presentation details are absent', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const analysis = recipeAnalysis({
    dishName: 'Sushi Platter',
    cuisine: 'Japanese',
    broadDishCategory: 'mixed platter',
    visibleIngredients: ['salmon nigiri', 'tuna nigiri', 'california roll pieces', 'soy sauce', 'wasabi', 'pickled ginger', 'edamame'],
    likelyIngredients: ['sushi rice', 'nori', 'salmon', 'tuna'],
    visibleComponents: {
      protein: 'salmon and tuna',
      sauce: 'soy sauce',
      baseStarch: 'sushi rice',
      vegetables: 'edamame',
      toppingsGarnish: 'wasabi and pickled ginger',
      cookingMethod: 'assembled sushi',
    },
    detectedComponents: [
      { name: 'Salmon Nigiri', confidence: 0.84 },
      { name: 'Tuna Nigiri', confidence: 0.84 },
      { name: 'California Roll Pieces', confidence: 0.84 },
      { name: 'Soy Sauce', confidence: 0.84 },
      { name: 'Wasabi', confidence: 0.84 },
      { name: 'Pickled Ginger', confidence: 0.84 },
      { name: 'Edamame', confidence: 0.84 },
    ],
  });
  const recipe = buildProviderRecipe({
    dishName: 'Sushi Platter',
    title: 'Sushi Platter',
    ingredients: ['2 cups sushi rice', '4 oz salmon', '4 oz tuna', '4 nori sheets', '1 avocado', '1 cucumber'],
    ingredientGroups: [
      { component: 'Salmon Nigiri', items: ['2 cups sushi rice', '4 oz salmon'] },
      { component: 'Tuna Nigiri', items: ['2 cups sushi rice', '4 oz tuna'] },
      { component: 'California Roll Pieces', items: ['4 nori sheets', '1 avocado', '1 cucumber'] },
      { component: 'Soy Sauce', items: ['2 tbsp soy sauce'] },
    ],
  });

  globalThis.fetch = async () => {
    fetchCalls += 1;
    return recipeProviderResponse(recipe);
  };

  try {
    await withRecipeEnv(async () => {
      const output = await generateRecipeFromDish({ analysis, mode: 'Normal' });
      assert.equal(fetchCalls, 1);
      assert.ok(output.recipe);
      assert.deepEqual(output.warnings?.map((warning) => warning.split(':')[0]), ['platter_coverage_below_90']);
      assert.match(output.recipe.confidenceNote, /platter_coverage_below_90/);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('targets repair when a primary platter protein is missing', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    buildProviderRecipe({
      dishName: "General Tso's Chicken With Rice",
      title: "General Tso's Chicken With Rice",
      ingredientGroups: [
        { component: 'White Rice', items: ['2 cups cooked white rice'] },
        { component: 'Orange Chili Sauce', items: ['2 tbsp soy sauce', '1 tbsp sugar'] },
      ],
    }),
    {
      ingredientGroups: [
        { component: 'Crispy Chicken Pieces', items: ['1 lb chicken thighs', '1/2 cup cornstarch', '1 tbsp vegetable oil'] },
      ],
      ingredients: ['1 lb chicken thighs', '1/2 cup cornstarch'],
      steps: [
        { stepNumber: 1, phase: 3, title: 'Cook Chicken', step: 'Cook chicken for 8 minutes until browned and 165°F / 74°C inside.', ingredients: ['chicken'], tools: ['skillet'] },
      ],
    },
  ];
  let fetchCalls = 0;
  const analysis = recipeAnalysis({
    dishName: "General Tso's Chicken With Rice",
    broadDishCategory: 'mixed platter',
    visibleIngredients: ['crispy chicken pieces', 'white rice', 'orange chili sauce'],
    likelyIngredients: ['chicken', 'rice', 'soy sauce'],
    visibleComponents: {
      protein: 'crispy chicken pieces',
      sauce: 'orange chili sauce',
      baseStarch: 'white rice',
      vegetables: '',
      toppingsGarnish: '',
      cookingMethod: 'fried and sauced',
    },
    detectedComponents: [
      { name: 'Crispy Chicken Pieces', confidence: 0.88 },
      { name: 'White Rice', confidence: 0.88 },
      { name: 'Orange Chili Sauce', confidence: 0.88 },
    ],
  });

  globalThis.fetch = async () => recipeProviderResponse(responses[fetchCalls++]);

  try {
    await withRecipeEnv(async () => {
      const output = await generateRecipeFromDish({ analysis, mode: 'Normal' });
      assert.equal(fetchCalls, 2);
      assert.ok(output.recipe?.ingredientGroups?.some((group) => group.component === 'Crispy Chicken Pieces'));
      assert.equal(output.warnings, undefined);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dumpling filling references do not become a missing recipe component', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const analysis = recipeAnalysis({
    dishName: 'Dumpling Platter',
    broadDishCategory: 'mixed platter',
    visibleIngredients: ['dumplings', 'dumpling filling', 'soy sauce', 'sesame oil'],
    detectedComponents: [{ name: 'Dumpling Platter', confidence: 0.92 }],
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return recipeProviderResponse(buildProviderRecipe({
      dishName: 'Dumpling Platter',
      title: 'Dumpling Platter',
      ingredients: ['1 package dumpling wrappers', '1/2 lb ground pork', '1 cup napa cabbage', '2 tbsp soy sauce', '1 tsp sesame oil'],
      steps: [
        { stepNumber: 1, title: 'Make Filling', step: 'Mix the pork and cabbage filling.', ingredients: ['pork', 'cabbage'], tools: ['bowl'] },
        { stepNumber: 2, title: 'Cook Dumplings', step: 'Cook the dumplings until tender.', ingredients: ['dumplings'], tools: ['pan'] },
        { stepNumber: 3, title: 'Season', step: 'Season the filling to taste.', ingredients: ['filling'], tools: ['spoon'] },
        { stepNumber: 4, title: 'Check Texture', step: 'Check that the dumplings are tender.', ingredients: ['dumplings'], tools: ['pan'] },
        { stepNumber: 5, title: 'Rest', step: 'Let the dumplings rest briefly.', ingredients: ['dumplings'], tools: ['plate'] },
        { stepNumber: 6, title: 'Serve', step: 'Serve the dumplings with the sauce.', ingredients: ['dumplings', 'sauce'], tools: ['plate'] },
      ],
    }));
  };

  try {
    await withRecipeEnv(async () => {
      const output = await generateRecipeFromDish({ analysis, mode: 'Normal' });
      assert.equal(fetchCalls, 1);
      assert.ok(output.recipe);
      assert.ok(!output.recipe.ingredients.some((ingredient) => /dumpling filling|cooked dumpling filling|dumpling platter/i.test(ingredient.name)));
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('component repair adds only missing leaf ingredients and canonical duplicates are removed', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const analysis = recipeAnalysis({
    dishName: 'Dumpling Platter',
    broadDishCategory: 'mixed platter',
    visibleIngredients: ['dumpling wrappers', 'soy sauce', 'sesame oil', 'water'],
    detectedComponents: [{ name: 'Dumpling Wrappers', confidence: 0.92 }],
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return recipeProviderResponse(buildProviderRecipe({
        dishName: 'Dumpling Platter',
        title: 'Dumpling Platter',
        ingredientGroups: [{ component: 'Sauce', items: ['2 tbsp soy sauce', '1 tsp sesame oil'] }],
        ingredients: ['2 tbsp soy sauce', '1 tsp sesame oil', '1 tbsp vegetable oil', '2 cups water'],
      }));
    }
    return recipeProviderResponse({
      ingredientGroups: [{ component: 'Dumpling Wrappers', items: ['1 package dumpling wrappers'] }],
      ingredients: [
        '1 package dumpling wrappers',
        '2 tbsp soy sauce',
        '1 tsp sesame oil',
        '1 tbsp vegetable oil',
        '2 cups cooked dumpling filling',
        '2 cups water',
      ],
      steps: [{ stepNumber: 1, title: 'Wrap', step: 'Wrap the filling in the dumpling wrappers.', ingredients: ['dumpling wrappers'], tools: ['board'] }],
    });
  };

  try {
    await withRecipeEnv(async () => {
      const output = await generateRecipeFromDish({ analysis, mode: 'Normal' });
      assert.equal(fetchCalls, 2);
      assert.ok(output.recipe);
      const keys = output.recipe.ingredients.map((ingredient) => `${ingredient.name.toLowerCase()}|${ingredient.quantity.toLowerCase()}`);
      assert.equal(new Set(keys).size, keys.length);
      assert.equal(output.recipe.ingredients.filter((ingredient) => /soy sauce|sesame oil|vegetable oil|water/i.test(ingredient.name)).length, 4);
      assert.ok(!output.recipe.ingredients.some((ingredient) => /cooked dumpling filling/i.test(ingredient.name)));
      assert.ok(output.recipe.ingredients.some((ingredient) => /dumpling wrappers/i.test(ingredient.name)));
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ingredient normalization preserves legitimate quantities while removing canonical duplicates', () => {
  const ingredients: RecipeIngredient[] = [
    { name: 'minced vegetable', quantity: '1 cup' },
    { name: '1 cup minced vegetable', quantity: 'vegetable, minced' },
    { name: 'salt', quantity: 'to taste' },
    { name: 'to taste salt', quantity: '' },
    { name: 'cooking oil', quantity: '1 tbsp' },
    { name: 'vegetable oil', quantity: '1 tbsp' },
    { name: 'cooking oil', quantity: '2 tbsp' },
  ];
  const normalized = normalizeRecipeIngredients(ingredients);
  assert.equal(normalized.length, 4);
  assert.ok(normalized.some((ingredient) => ingredient.quantity === '2 tbsp'));
});

test('classifies non-critical platter misses as warnings and primary misses as repairable fatal issues', () => {
  const secondaryAssessment = assessPlatterCoverage(recipeAnalysis({
    dishName: 'Sushi Platter',
    broadDishCategory: 'mixed platter',
    visibleComponents: {
      protein: 'salmon and tuna',
      sauce: 'soy sauce',
      baseStarch: 'sushi rice',
      vegetables: 'edamame',
      toppingsGarnish: 'wasabi and pickled ginger',
      cookingMethod: 'assembled sushi',
    },
    detectedComponents: [
      { name: 'Salmon Nigiri', confidence: 0.84 },
      { name: 'Tuna Nigiri', confidence: 0.84 },
      { name: 'Wasabi', confidence: 0.84 },
    ],
  }), ['Salmon Nigiri', 'Tuna Nigiri']);

  assert.deepEqual(secondaryAssessment.fatalIssues, []);
  assert.deepEqual(secondaryAssessment.warningIssues, ['platter_coverage_below_90']);
  assert.equal(secondaryAssessment.selectedRepairMode, 'none');

  const primaryAssessment = assessPlatterCoverage(recipeAnalysis({
    dishName: "General Tso's Chicken With Rice",
    broadDishCategory: 'mixed platter',
    visibleComponents: {
      protein: 'crispy chicken pieces',
      sauce: 'orange chili sauce',
      baseStarch: 'white rice',
      vegetables: '',
      toppingsGarnish: '',
      cookingMethod: 'fried and sauced',
    },
    detectedComponents: [
      { name: 'Crispy Chicken Pieces', confidence: 0.88 },
      { name: 'White Rice', confidence: 0.88 },
    ],
  }), ['White Rice']);

  assert.deepEqual(primaryAssessment.fatalIssues, ['primary_platter_component_missing']);
  assert.equal(primaryAssessment.selectedRepairMode, 'component_coverage');
});

test('app-facing recipe conversion does not leave unsafe chicken temperatures behind', async () => {
  const originalFetch = globalThis.fetch;
  const originalAiEnabled = process.env.AI_ENABLED;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalMaxTokens = process.env.AI_MAX_OUTPUT_TOKENS;
  process.env.AI_ENABLED = 'true';
  process.env.OPENROUTER_API_KEY = 'sk-test';
  process.env.AI_MAX_OUTPUT_TOKENS = '4096';

  const recipe = {
    dishName: 'Lemon Chicken',
    title: 'Lemon Chicken',
    description: 'Simple homestyle lemon chicken.',
    ingredients: ['1 lb chicken breasts', '1 tbsp olive oil', '1/2 tsp salt', '1 lemon', '1 garlic clove'],
    equipment: ['skillet', 'instant-read thermometer'],
    steps: [
      { stepNumber: 1, phase: 1, title: 'Pat Chicken', step: 'Pat the chicken dry for 1 minute.', ingredients: ['chicken'], tools: ['paper towels'] },
      { stepNumber: 2, phase: 2, title: 'Heat Oil', step: 'Heat olive oil in a skillet for 2 minutes until shimmering.', ingredients: ['olive oil'], tools: ['skillet'] },
      { stepNumber: 3, phase: 2, title: 'Season Chicken', step: 'Season chicken with salt and garlic for 1 minute.', ingredients: ['chicken', 'salt', 'garlic'], tools: ['bowl'] },
      {
        stepNumber: 4,
        phase: 3,
        title: 'Cook Chicken',
        step: 'Cook chicken for 6 minutes until it reaches 145°F / 63°C in the center.',
        ingredients: ['chicken'],
        tools: ['skillet', 'instant-read thermometer'],
        safetyNote: 'Chicken should reach 145°F / 63°C inside.',
      },
      { stepNumber: 5, phase: 5, title: 'Add Lemon', step: 'Squeeze lemon over chicken for 30 seconds until glossy.', ingredients: ['lemon', 'chicken'], tools: ['tongs'] },
      { stepNumber: 6, phase: 6, title: 'Rest Chicken', step: 'Rest chicken for 5 minutes before slicing.', ingredients: ['chicken'], tools: ['plate'] },
    ],
    prepTime: '10 minutes',
    cookTime: '15 minutes',
    totalTime: '25 minutes',
    servings: 2,
    skillLevel: 'Easy',
    avoidMistake: 'Do not overcook the chicken.',
    substitutions: [],
    storageAndReheating: 'Refrigerate leftovers up to 3 days.',
    spicePairings: [],
  };

  globalThis.fetch = async () => recipeProviderResponse(recipe);
  try {
    const output = await generateRecipeFromDish({
      analysis: recipeAnalysis(),
      mode: 'Normal',
    });
    const text = JSON.stringify(output.recipe);

    assert.match(text, /165°F/);
    assert.match(text, /74°C/);
    assert.doesNotMatch(text, /145°F|63°C/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalAiEnabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = originalAiEnabled;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
    if (originalMaxTokens === undefined) delete process.env.AI_MAX_OUTPUT_TOKENS;
    else process.env.AI_MAX_OUTPUT_TOKENS = originalMaxTokens;
  }
});
