import assert from 'node:assert/strict';
import test from 'node:test';

import { generateRecipeFromDish, normalizeVisionOutput, type FoodImageAnalysis } from './aiService.js';

function recipeAnalysis(overrides: Partial<FoodImageAnalysis> = {}): FoodImageAnalysis {
  return {
    candidateScanId: `scan-${Math.random().toString(36).slice(2)}`,
    aiSource: 'openrouter_ai',
    dishName: 'Lemon Chicken',
    cuisine: 'Restaurant-style',
    restaurantStyle: 'Restaurant-style',
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
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
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

test('normalizes dim cluttered restaurant food into an uncertain food result', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'spicy noodle bowl',
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'pasta/noodles',
    cuisine: 'Restaurant-style',
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

test('does not invent restaurant price when a photo has no visible price', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'saucy rice bowl',
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'rice bowl',
    cuisine: 'Restaurant-style',
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
    confidenceReason: 'Food is visible, but no menu or receipt price appears in the photo.',
  });

  assert.equal(analysis.isFoodImage, true);
  assert.equal(analysis.restaurantPriceEstimate, 0);
  assert.equal(analysis.homemadeCostEstimate, 8);
});

test('keeps non-generic possible dish names for uncertain food', () => {
  const analysis = normalizeVisionOutput({
    dishName: 'charred grill plate',
    possibleDishNames: ['mixed restaurant plate', 'grilled meat plate', 'loaded sandwich'],
    scanState: 'food_present_uncertain_dish',
    broadDishCategory: 'grilled meat',
    cuisine: 'Restaurant-style',
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
    cuisine: 'Restaurant-style',
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
    cuisine: 'Restaurant-style',
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
    cuisine: 'Restaurant-style',
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
    cuisine: 'Restaurant-style',
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
    description: 'Simple restaurant-style lemon chicken.',
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
      mode: 'Restaurant Copy',
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
