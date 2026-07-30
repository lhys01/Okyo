import assert from 'node:assert/strict';
import { once } from 'node:events';
import http, { type Server } from 'node:http';
import test, { after } from 'node:test';

import type { Recipe } from './types.js';
import {
  getGeneratedRecipe,
  getGeneratedRecipeRevisionMetadata,
  storeGeneratedRecipe,
} from './store.js';

process.env.NODE_ENV = 'test';
process.env.AI_ENABLED = 'true';
process.env.OPENROUTER_API_KEY = 'sk-test';
process.env.EPICURE_ENABLED = 'false';
process.env.AI_MAX_OUTPUT_TOKENS = '4096';

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

function chickenAnalysis() {
  return {
    scanState: 'clear_food',
    dishName: 'Grilled Chicken Tikka',
    possibleDishNames: ['Grilled Chicken Tikka'],
    broadDishCategory: 'grilled protein',
    cuisine: 'Indian',
    confidence: 0.82,
    isFoodImage: true,
    isRestaurantMeal: true,
    rejectionReason: '',
    visibleIngredients: ['grilled meat', 'spices'],
    likelyIngredients: ['yogurt', 'garam masala', 'ginger', 'garlic', 'lemon'],
    visibleComponents: {
      protein: 'grilled meat',
      sauce: '',
      baseStarch: '',
      vegetables: '',
      toppingsGarnish: 'cilantro',
      cookingMethod: 'grilled',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 7,
    confidenceReason: 'Grilled meat on skewers with charred edges.',
  };
}

function chickenRecipe() {
  return {
    dishName: 'Grilled Chicken Tikka',
    title: 'Grilled Chicken Tikka',
    description: 'A smoky, marinated grilled chicken recipe.',
    prepTime: '20 minutes',
    cookTime: '15 minutes',
    totalTime: '35 minutes',
    servings: 2,
    nutritionEstimate: {
      calories: 500,
      proteinGrams: 44,
      carbohydratesGrams: 16,
      fatGrams: 28,
    },
    equipment: ['skewers', 'grill pan', 'bowl'],
    ingredients: [
      '1 lb chicken thighs, cubed',
      '1 cup plain yogurt',
      '2 tsp garam masala',
      '1 tbsp ginger garlic paste',
      '1 tbsp lemon juice',
      '1 tsp salt',
      '1 tbsp vegetable oil',
    ],
    steps: [
      buildStep(1, { title: 'Marinate', step: 'Mix chicken with yogurt and spices for 2 minutes then rest.', ingredients: ['chicken thighs', 'yogurt', 'garam masala'], tools: ['bowl'] }),
      buildStep(2, { title: 'Skewer', step: 'Thread chicken onto skewers for 2 minutes.', ingredients: ['chicken thighs'], tools: ['skewers'] }),
      buildStep(3, { title: 'Heat Pan', step: 'Heat the grill pan for 2 minutes until hot.', ingredients: ['vegetable oil'], tools: ['grill pan'] }),
      buildStep(4, { title: 'Sear First Side', step: 'Sear chicken for 4 minutes until browned.', ingredients: ['chicken thighs'], tools: ['grill pan', 'tongs'] }),
      buildStep(5, { title: 'Sear Second Side', step: 'Flip chicken and sear for 4 minutes until browned.', ingredients: ['chicken thighs'], tools: ['grill pan', 'tongs'] }),
      buildStep(6, { title: 'Check Temperature', step: 'Cook chicken for 4 minutes until it reaches 165°F.', ingredients: ['chicken thighs'], tools: ['grill pan', 'thermometer'] }),
      buildStep(7, { title: 'Add Lemon', step: 'Brush chicken with lemon juice before removing it from the pan.', ingredients: ['chicken thighs', 'lemon juice'], tools: ['brush'] }),
      buildStep(8, { title: 'Rest', step: 'Rest chicken for 3 minutes before serving.', ingredients: ['chicken thighs'], tools: ['plate'] }),
    ],
  };
}

function lambRecipe() {
  return {
    dishName: 'Grilled Lamb Chops',
    title: 'Grilled Lamb Chops',
    description: 'Herb-marinated grilled lamb chops, homemade.',
    prepTime: '20 minutes',
    cookTime: '15 minutes',
    totalTime: '35 minutes',
    servings: 2,
    nutritionEstimate: {
      calories: 560,
      proteinGrams: 38,
      carbohydratesGrams: 6,
      fatGrams: 42,
    },
    equipment: ['grill pan', 'tongs', 'bowl'],
    ingredients: [
      '4 lamb chops',
      '2 tbsp olive oil',
      '2 cloves garlic, minced',
      '1 tsp rosemary',
      '1 tsp salt',
      '1/2 tsp black pepper',
    ],
    steps: [
      buildStep(1, { title: 'Mix Marinade', step: 'Whisk olive oil, garlic, and rosemary together for 1 minute.', ingredients: ['olive oil', 'garlic', 'rosemary'], tools: ['bowl'] }),
      buildStep(2, { title: 'Season Chops', step: 'Pat lamb chops dry and season with salt and pepper for 1 minute.', ingredients: ['lamb chops', 'salt', 'black pepper'], tools: ['plate'] }),
      buildStep(3, { title: 'Marinate', step: 'Rub lamb chops with the marinade for 2 minutes.', ingredients: ['lamb chops', 'olive oil', 'garlic', 'rosemary'], tools: ['bowl'] }),
      buildStep(4, { title: 'Rest Marinade', step: 'Let lamb chops rest for 10 minutes to absorb the marinade.', ingredients: ['lamb chops'], tools: ['plate'] }),
      buildStep(5, { title: 'Heat Pan', step: 'Heat the grill pan for 2 minutes until hot.', ingredients: [], tools: ['grill pan'] }),
      buildStep(6, { title: 'Sear First Side', step: 'Sear lamb chops for 4 minutes until browned.', ingredients: ['lamb chops'], tools: ['grill pan', 'tongs'] }),
      buildStep(7, { title: 'Sear Second Side', step: 'Flip and sear the other side for 4 minutes until browned.', ingredients: ['lamb chops'], tools: ['grill pan', 'tongs'] }),
      buildStep(8, { title: 'Rest', step: 'Rest lamb chops for 3 minutes before serving.', ingredients: ['lamb chops'], tools: ['plate'] }),
    ],
  };
}

function noodleAnalysis(dishName = 'Soy Sauce Noodles') {
  return {
    scanState: 'clear_food',
    dishName,
    possibleDishNames: [dishName],
    broadDishCategory: 'noodle dish',
    cuisine: 'home kitchen',
    confidence: 0.86,
    isFoodImage: true,
    isRestaurantMeal: false,
    rejectionReason: '',
    visibleIngredients: ['noodles', 'soy sauce', 'scallions'],
    likelyIngredients: ['garlic', 'neutral oil', 'sesame oil'],
    visibleComponents: {
      protein: '',
      sauce: 'soy sauce',
      baseStarch: 'noodles',
      vegetables: 'scallions',
      toppingsGarnish: '',
      cookingMethod: 'boiled and tossed',
    },
    restaurantPriceEstimate: 14,
    homemadeCostEstimate: 5,
    confidenceReason: 'Noodles with a dark soy-based sauce and scallions.',
  };
}

function noodleRecipe(dishName = 'Soy Sauce Noodles') {
  return {
    dishName,
    title: dishName,
    description: 'Chewy noodles tossed with garlic and soy sauce.',
    prepTime: '10 minutes',
    cookTime: '10 minutes',
    totalTime: '20 minutes',
    servings: 2,
    nutritionEstimate: {
      calories: 410,
      proteinGrams: 10,
      carbohydratesGrams: 65,
      fatGrams: 12,
    },
    equipment: ['large pot', 'skillet', 'colander'],
    ingredients: [
      '8 oz wheat noodles',
      '3 tbsp soy sauce',
      '1 tbsp neutral oil',
      '2 cloves garlic, minced',
      '2 scallions, sliced',
      '1 tsp sesame oil',
    ],
    steps: [
      buildStep(1, { title: 'Boil Water', step: 'Bring a large pot of water to a rolling boil.', ingredients: ['wheat noodles'], tools: ['large pot'] }),
      buildStep(2, { title: 'Cook Noodles', step: 'Boil wheat noodles for 6 minutes until chewy.', ingredients: ['wheat noodles'], tools: ['large pot'] }),
      buildStep(3, { title: 'Drain Noodles', step: 'Drain wheat noodles while reserving 1/4 cup cooking water.', ingredients: ['wheat noodles'], tools: ['colander'] }),
      buildStep(4, { title: 'Mix Sauce', step: 'Whisk soy sauce, garlic, and sesame oil together.', ingredients: ['soy sauce', 'garlic', 'sesame oil'], tools: ['bowl'] }),
      buildStep(5, { title: 'Heat Oil', step: 'Heat neutral oil in a skillet for 1 minute.', ingredients: ['neutral oil'], tools: ['skillet'] }),
      buildStep(6, { title: 'Add Sauce', step: 'Pour the soy sauce mixture into the skillet.', ingredients: ['soy sauce', 'garlic', 'sesame oil'], tools: ['skillet'] }),
      buildStep(7, { title: 'Toss Noodles', step: 'Toss wheat noodles with the sauce until evenly coated.', ingredients: ['wheat noodles', 'soy sauce'], tools: ['skillet', 'tongs'] }),
      buildStep(8, { title: 'Finish Noodles', step: 'Top soy sauce noodles with sliced scallions and serve.', ingredients: ['wheat noodles', 'scallions'], tools: ['serving bowl'] }),
    ],
  };
}

function beefNoodleRecipe() {
  return {
    dishName: 'Beef Soy Sauce Noodles',
    title: 'Beef Soy Sauce Noodles',
    description: 'Chewy soy sauce noodles with tender seared beef.',
    prepTime: '10 minutes',
    cookTime: '18 minutes',
    totalTime: '28 minutes',
    servings: 2,
    nutritionEstimate: {
      calories: 600,
      proteinGrams: 35,
      carbohydratesGrams: 66,
      fatGrams: 22,
    },
    equipment: ['large pot', 'skillet', 'colander', 'tongs'],
    ingredients: [
      '8 oz wheat noodles',
      '3 tbsp soy sauce',
      '1 tbsp neutral oil',
      '2 cloves garlic, minced',
      '2 scallions, sliced',
      '1 tsp sesame oil',
      '12 oz thinly sliced beef sirloin',
    ],
    steps: [
      buildStep(1, { title: 'Boil Water', step: 'Bring a large pot of water to a rolling boil.', ingredients: ['wheat noodles'], tools: ['large pot'] }),
      buildStep(2, { title: 'Cook Noodles', step: 'Boil wheat noodles for 6 minutes until chewy.', ingredients: ['wheat noodles'], tools: ['large pot'] }),
      buildStep(3, { title: 'Drain Noodles', step: 'Drain wheat noodles while reserving 1/4 cup cooking water.', ingredients: ['wheat noodles'], tools: ['colander'] }),
      buildStep(4, { title: 'Mix Sauce', step: 'Whisk soy sauce, garlic, and sesame oil together.', ingredients: ['soy sauce', 'garlic', 'sesame oil'], tools: ['bowl'] }),
      buildStep(5, { title: 'Sear Beef', step: 'Sear sliced beef in neutral oil for 5 minutes until browned and safely cooked.', ingredients: ['beef sirloin', 'neutral oil'], tools: ['skillet', 'tongs'] }),
      buildStep(6, { title: 'Add Sauce', step: 'Pour the soy sauce mixture over the cooked beef.', ingredients: ['beef sirloin', 'soy sauce', 'garlic', 'sesame oil'], tools: ['skillet'] }),
      buildStep(7, { title: 'Toss Noodles', step: 'Toss wheat noodles with the beef and sauce until evenly coated.', ingredients: ['wheat noodles', 'beef sirloin', 'soy sauce'], tools: ['skillet', 'tongs'] }),
      buildStep(8, { title: 'Finish Noodles', step: 'Top beef soy sauce noodles with sliced scallions and serve.', ingredients: ['wheat noodles', 'beef sirloin', 'scallions'], tools: ['serving bowl'] }),
    ],
  };
}

function beefNoodleRecipeWithoutSesame() {
  const recipe = beefNoodleRecipe();
  return {
    ...recipe,
    description: 'Chewy soy sauce noodles with tender seared beef and scallions.',
    ingredients: recipe.ingredients.filter((ingredient) => !ingredient.includes('sesame')),
    steps: recipe.steps.map((step, index) => {
      if (index === 3) {
        return buildStep(4, {
          title: 'Mix Sauce',
          step: 'Whisk soy sauce and garlic together.',
          ingredients: ['soy sauce', 'garlic'],
          tools: ['bowl'],
        });
      }
      if (index === 5) {
        return buildStep(6, {
          title: 'Add Sauce',
          step: 'Pour the soy sauce mixture over the cooked beef.',
          ingredients: ['beef sirloin', 'soy sauce', 'garlic'],
          tools: ['skillet'],
        });
      }
      return step;
    }),
    nutritionEstimate: {
      calories: 560,
      proteinGrams: 35,
      carbohydratesGrams: 66,
      fatGrams: 17,
    },
  };
}

function spicyBeefNoodleRecipeWithoutSesame() {
  const recipe = beefNoodleRecipeWithoutSesame();
  return {
    ...recipe,
    description: 'Spicy soy sauce noodles with tender seared beef and scallions.',
    ingredients: [...recipe.ingredients, '1 tbsp chili crisp'],
    steps: recipe.steps.map((step, index) => index === recipe.steps.length - 1
      ? buildStep(8, {
          title: 'Finish Noodles',
          step: 'Fold chili crisp into the beef soy sauce noodles, top with scallions, and serve.',
          ingredients: ['wheat noodles', 'beef sirloin', 'chili crisp', 'scallions'],
          tools: ['serving bowl'],
        })
      : step),
    nutritionEstimate: {
      calories: 600,
      proteinGrams: 35,
      carbohydratesGrams: 68,
      fatGrams: 21,
    },
  };
}

function openRouterResponse(content: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      message: { content: JSON.stringify(content) },
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
}

function storedSourceRecipe(id: string): Recipe {
  return {
    id,
    scanResultId: `scan-${id}`,
    title: 'Savory Grain Bowl',
    mode: 'Normal',
    description: 'A savory grain bowl.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 6,
    estimatedSavings: 10,
    ingredients: [
      { name: 'cooked grain', quantity: '2 cups' },
      { name: 'roasted vegetables', quantity: '1 cup' },
    ],
    steps: ['Warm the cooked grain.', 'Fold in the roasted vegetables.'],
    structuredSteps: [
      { title: 'Warm', text: 'Warm the cooked grain.', ingredientsUsed: ['cooked grain'], toolsUsed: ['pot'] },
      { title: 'Finish', text: 'Fold in the roasted vegetables.', ingredientsUsed: ['roasted vegetables'], toolsUsed: ['pot'] },
    ],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated recipe.',
    equipment: ['pot'],
    nutritionEstimate: {
      calories: 300,
      proteinGrams: 10,
      carbohydratesGrams: 48,
      fatGrams: 8,
      fiberGrams: 5,
    },
  };
}

function compoundNutritionGrainRecipe(
  proteinGrams: number,
  displayedCalories = (proteinGrams * 4) + (48 * 4) + (6 * 9),
) {
  return {
    dishName: 'Savory Grain Bowl',
    title: 'Savory Grain Bowl',
    description: 'The same savory grain bowl with less fat and more protein.',
    prepTime: '10 minutes',
    cookTime: '15 minutes',
    totalTime: '25 minutes',
    servings: 2,
    nutritionEstimate: {
      calories: displayedCalories,
      proteinGrams,
      carbohydratesGrams: 48,
      fatGrams: 6,
      fiberGrams: 6,
    },
    equipment: ['pot', 'skillet', 'spoon'],
    ingredients: [
      '2 cups cooked grain',
      '1 cup roasted vegetables',
      '1 tbsp savory dressing',
      '1/2 cup protein topping',
      '1/2 cup vegetable stock',
      '2 tbsp fresh herbs',
    ],
    steps: [
      buildStep(1, { title: 'Warm Grain', step: 'Warm the cooked grain with vegetable stock.', ingredients: ['cooked grain', 'vegetable stock'], tools: ['pot'] }),
      buildStep(2, { title: 'Warm Vegetables', step: 'Warm the roasted vegetables in a skillet.', ingredients: ['roasted vegetables'], tools: ['skillet'] }),
      buildStep(3, { title: 'Add Dressing', step: 'Stir savory dressing into the roasted vegetables.', ingredients: ['savory dressing', 'roasted vegetables'], tools: ['skillet', 'spoon'] }),
      buildStep(4, { title: 'Add Topping', step: 'Fold the protein topping into the cooked grain.', ingredients: ['protein topping', 'cooked grain'], tools: ['pot', 'spoon'] }),
      buildStep(5, { title: 'Combine Bowl', step: 'Combine the cooked grain and roasted vegetables.', ingredients: ['cooked grain', 'roasted vegetables'], tools: ['pot', 'spoon'] }),
      buildStep(6, { title: 'Simmer Bowl', step: 'Simmer the cooked grain with the remaining vegetable stock.', ingredients: ['cooked grain', 'vegetable stock'], tools: ['pot'] }),
      buildStep(7, { title: 'Add Herbs', step: 'Fold fresh herbs into the savory grain bowl.', ingredients: ['fresh herbs', 'cooked grain'], tools: ['spoon'] }),
      buildStep(8, { title: 'Serve Bowl', step: 'Serve the cooked grain with roasted vegetables and protein topping.', ingredients: ['cooked grain', 'roasted vegetables', 'protein topping'], tools: ['bowl'] }),
    ],
  };
}

function storedFormulationEvidenceRecipe(id: string): Recipe {
  return {
    id,
    scanResultId: `scan-${id}`,
    title: 'Savory Grain Plate',
    mode: 'Normal',
    description: 'A composed savory grain plate.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 6,
    estimatedSavings: 10,
    ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'standard savory component', quantity: '1 cup' },
      { name: 'vegetable layer', quantity: '1 cup' },
      { name: 'seasoning blend', quantity: '1 tbsp' },
    ],
    steps: [
      'Cook the standard savory component with the grain base.',
      'Fold in the vegetable layer and seasoning blend.',
    ],
    structuredSteps: [
      {
        title: 'Cook',
        text: 'Cook the standard savory component with the grain base.',
        ingredientsUsed: ['standard savory component', 'grain base'],
        toolsUsed: ['pan'],
      },
      {
        title: 'Finish',
        text: 'Fold in the vegetable layer and seasoning blend.',
        ingredientsUsed: ['vegetable layer', 'seasoning blend'],
        toolsUsed: ['spoon'],
      },
    ],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated recipe.',
    equipment: ['pan', 'spoon'],
    nutritionEstimate: {
      calories: 350,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 15,
      fiberGrams: 5,
    },
  };
}

function formulationEvidenceProviderRecipe() {
  return {
    dishName: 'Savory Grain Plate',
    title: 'Savory Grain Plate',
    description: 'The same savory grain plate with adjusted nutrition.',
    prepTime: '10 minutes',
    cookTime: '15 minutes',
    totalTime: '25 minutes',
    servings: 2,
    nutritionEstimate: {
      calories: 340,
      proteinGrams: 30,
      carbohydratesGrams: 30,
      fatGrams: 12,
      fiberGrams: 5,
    },
    equipment: ['pan', 'spoon'],
    ingredients: [
      '2 cups grain base',
      '1 cup lean high-protein savory component',
      '1 cup vegetable layer',
      '1 tbsp seasoning blend',
    ],
    appliedChanges: [{
      beforeIngredient: 'standard savory component',
      afterIngredient: 'lean high-protein savory component',
      reason: 'Supports both requested nutrition goals.',
      supportsRequirementIndexes: [1, 2],
      affectedStepIndexes: [1, 2],
    }],
    steps: [
      buildStep(1, {
        title: 'Prepare Component',
        step: 'Prepare the lean high-protein savory component in the pan.',
        ingredients: ['lean high-protein savory component'],
        tools: ['pan'],
      }),
      buildStep(2, {
        title: 'Add Grain',
        step: 'Cook the lean high-protein savory component with the grain base.',
        ingredients: ['lean high-protein savory component', 'grain base'],
        tools: ['pan', 'spoon'],
      }),
      buildStep(3, {
        title: 'Warm Layer',
        step: 'Warm the vegetable layer in the pan.',
        ingredients: ['vegetable layer'],
        tools: ['pan'],
      }),
      buildStep(4, {
        title: 'Season',
        step: 'Stir the seasoning blend into the vegetable layer.',
        ingredients: ['seasoning blend', 'vegetable layer'],
        tools: ['pan', 'spoon'],
      }),
      buildStep(5, {
        title: 'Combine',
        step: 'Combine the grain base and vegetable layer.',
        ingredients: ['grain base', 'vegetable layer'],
        tools: ['pan', 'spoon'],
      }),
      buildStep(6, {
        title: 'Fold',
        step: 'Fold the savory component through the grain base.',
        ingredients: ['lean high-protein savory component', 'grain base'],
        tools: ['spoon'],
      }),
      buildStep(7, {
        title: 'Heat Through',
        step: 'Heat the assembled savory grain plate until hot.',
        ingredients: ['grain base', 'vegetable layer'],
        tools: ['pan'],
      }),
      buildStep(8, {
        title: 'Serve',
        step: 'Serve the savory grain plate while warm.',
        ingredients: ['grain base', 'lean high-protein savory component'],
        tools: ['plate'],
      }),
    ],
  };
}

test('compound nutrition correction sends exact targets and reconciles only contradictory calories', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `compound-calorie-${Date.now()}`;
  storeGeneratedRecipe(storedSourceRecipe(sourceId));
  let capturedPrompt = '';
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { messages?: Array<{ content?: unknown }> }
      : {};
    capturedPrompt = JSON.stringify(body.messages ?? []);
    calls += 1;
    return openRouterResponse(compoundNutritionGrainRecipe(15, 420));
  };

  try {
    const response = await request(
      'POST',
      `/v1/recipes/${sourceId}/correct`,
      {
        correctionNote: 'less fat and more protein',
        expectedSourceRecipeId: sourceId,
        mode: 'Normal',
      },
    );

    assert.equal(response.status, 201);
    assert.equal(calls, 1);
    assert.equal(response.body.data.recipe.nutritionEstimate.proteinGrams, 15);
    assert.equal(response.body.data.recipe.nutritionEstimate.fatGrams, 6);
    assert.equal(response.body.data.recipe.nutritionEstimate.calories, 305);
    assert.notEqual(response.body.data.recipe.id, sourceId);
    assert.match(capturedPrompt, /original 8 g; corrected value MUST be at most 6 g/);
    assert.match(capturedPrompt, /original 10 g; corrected value MUST be at least 13 g/);
    assert.match(capturedPrompt, /ALL parsed requirements below are mandatory/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('same-count formulation evidence satisfies compound goals and creates a source revision', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `formulation-evidence-${Date.now()}`;
  const source = storedFormulationEvidenceRecipe(sourceId);
  storeGeneratedRecipe(source);
  const correctionLogs: Array<Record<string, unknown>> = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    if (args[0] === '[recipe_correction_request]') {
      correctionLogs.push(JSON.parse(String(args[1])) as Record<string, unknown>);
      return;
    }
    originalLog(...args);
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openRouterResponse(formulationEvidenceProviderRecipe());
  };

  try {
    const response = await request(
      'POST',
      `/v1/recipes/${sourceId}/correct`,
      {
        correctionNote: 'less fat and more protein',
        expectedSourceRecipeId: sourceId,
        mode: 'Normal',
      },
    );

    assert.equal(response.status, 201);
    assert.equal(calls, 1);
    assert.notEqual(response.body.data.recipe.id, sourceId);
    assert.equal(response.body.data.recipe.ingredients.length, source.ingredients.length);
    assert.equal(response.body.data.recipe.nutritionEstimate.proteinGrams, 30);
    assert.equal(response.body.data.recipe.nutritionEstimate.fatGrams, 12);
    const storedRevision = getGeneratedRecipe(response.body.data.recipe.id);
    assert.ok(storedRevision);
    assert.equal(storedRevision.id, response.body.data.recipe.id);

    const requestLog = correctionLogs.at(-1);
    assert.ok(requestLog);
    assert.equal(requestLog.finalHttpStatus, 201);
    const firstAttempt = requestLog.firstAttempt as {
      detectedChangeCount: number;
      ingredientChanges: Array<{
        kind: string;
        affectedRequirementIndexes: number[];
        referencedInSteps: boolean;
      }>;
    };
    assert.equal(firstAttempt.detectedChangeCount, 1);
    assert.deepEqual(firstAttempt.ingredientChanges, [{
      kind: 'descriptor_changed',
      normalizedBeforeName: 'component savory standard',
      normalizedAfterName: 'component high lean protein savory',
      beforeQuantity: '1 cup',
      afterQuantity: '1 cup',
      affectedRequirementIndexes: [1, 2],
      affectedStepIndexes: [1, 2, 6, 8],
      referencedInSteps: true,
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('full-route compound nutrition correction ignores equivalent formatting and skips repair', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `canonicalized-compound-${Date.now()}`;
  const source = {
    ...storedFormulationEvidenceRecipe(sourceId),
    ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'standard savory component', quantity: '1 cup' },
      { name: 'vegetable layer', quantity: '1 cup' },
      { name: 'seasoning blend', quantity: '1 tbsp' },
      { name: 'salt', quantity: 'to taste' },
    ],
    steps: ['Cook the filling.', 'Fold in the vegetable layer and season to taste.', 'Serve the finished filling.'],
    structuredSteps: [
      { title: 'Cook', text: 'Cook the filling.', ingredientsUsed: ['standard savory component', 'grain base'], toolsUsed: ['pan'] },
      { title: 'Finish', text: 'Fold in the vegetable layer and season to taste.', ingredientsUsed: ['vegetable layer', 'seasoning blend', 'salt'], toolsUsed: ['spoon'] },
      { title: 'Serve', text: 'Serve the finished filling.', ingredientsUsed: ['grain base'], toolsUsed: ['plate'] },
    ],
  } satisfies Recipe;
  storeGeneratedRecipe(source);
  const correctionLogs: Array<Record<string, unknown>> = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    if (args[0] === '[recipe_correction_request]') {
      correctionLogs.push(JSON.parse(String(args[1])) as Record<string, unknown>);
      return;
    }
    originalLog(...args);
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openRouterResponse({
      dishName: 'Savory Grain Plate',
      title: 'Savory Grain Plate',
      description: 'The same savory grain plate with adjusted nutrition.',
      prepTime: '10 minutes',
      cookTime: '15 minutes',
      totalTime: '25 minutes',
      servings: 2,
      nutritionEstimate: {
        calories: 340,
        proteinGrams: 30,
        carbohydratesGrams: 30,
        fatGrams: 12,
        fiberGrams: 5,
      },
      equipment: ['pan', 'spoon'],
      ingredients: [
        '2 cups grain base',
        '1 cup lean high-protein savory component',
        '1 cup vegetable layer',
        '2 teaspoons seasoning blend, finely ground',
        'salt to taste',
      ],
      appliedChanges: {
        affectedRequirementIndexes: [],
        supportsRequirementIndexes: [],
      },
      steps: [
        buildStep(1, { title: 'Cook', step: 'Cook the filling.', ingredients: ['lean high-protein savory component', 'grain base'], tools: ['pan'] }),
        buildStep(2, { title: 'Finish', step: 'Fold in the vegetable layer and season to taste.', ingredients: ['vegetable layer', 'seasoning blend', 'salt'], tools: ['spoon'] }),
        buildStep(3, { title: 'Serve', step: 'Serve the finished filling.', ingredients: ['grain base'], tools: ['plate'] }),
        buildStep(4, { title: 'Warm', step: 'Warm the finished filling.', ingredients: ['grain base'], tools: ['pan'] }),
        buildStep(5, { title: 'Check', step: 'Check the finished filling.', ingredients: ['lean high-protein savory component'], tools: ['spoon'] }),
        buildStep(6, { title: 'Plate', step: 'Plate the finished filling.', ingredients: ['grain base'], tools: ['plate'] }),
      ],
    });
  };

  try {
    const response = await request(
      'POST',
      `/v1/recipes/${sourceId}/correct`,
      {
        correctionNote: 'less fat and more protein',
        expectedSourceRecipeId: sourceId,
        mode: 'Normal',
      },
    );

    assert.equal(response.status, 201);
    assert.equal(calls, 1);
    assert.equal(response.body.data.recipe.servings, source.servings);
    assert.equal(response.body.data.recipe.nutritionEstimate.proteinGrams, 30);
    assert.equal(response.body.data.recipe.nutritionEstimate.fatGrams, 12);
    assert.notEqual(response.body.data.recipe.id, sourceId);
    const revisionMetadata = getGeneratedRecipeRevisionMetadata(response.body.data.recipe.id);
    assert.ok(revisionMetadata);
    assert.equal(revisionMetadata.parentRevisionId, sourceId);

    const log = correctionLogs.at(-1);
    assert.ok(log);
    assert.equal(log.finalHttpStatus, 201);
    assert.equal(log.focusedRepairRan, false);
    assert.ok(!(log.firstValidationIssueCodes as string[]).includes('unrelated_recipe_changes'));
    assert.ok(!(log.firstValidationIssueCodes as string[]).includes('mandatory_requirement_unsatisfied'));
    const firstAttempt = log.firstAttempt as {
      detectedChangeCount: number;
      ingredientChanges: Array<{ normalizedBeforeName?: string; normalizedAfterName?: string }>;
    };
    assert.equal(firstAttempt.detectedChangeCount, 2);
    assert.ok(firstAttempt.ingredientChanges.every((change) =>
      !change.normalizedBeforeName?.includes('salt') &&
      !change.normalizedAfterName?.includes('salt')));
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('focused repair receives and fixes an exact stale quantity issue', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `stale-quantity-${Date.now()}`;
  const source = {
    ...storedFormulationEvidenceRecipe(sourceId),
    ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'standard savory component', quantity: '1 cup' },
      { name: 'vegetable layer', quantity: '1 cup' },
      { name: 'seasoning blend', quantity: '1 tbsp' },
      { name: 'cooking oil', quantity: '2 tbsp' },
    ],
    steps: [
      'Cook the filling.',
      'Add 2 tbsp cooking oil and sauté the filling.',
      'Fold in the vegetable layer.',
      'Season the filling.',
      'Warm the finished filling.',
      'Serve the finished filling.',
    ],
    structuredSteps: [],
  } satisfies Recipe;
  storeGeneratedRecipe(source);
  const correctionLogs: Array<Record<string, unknown>> = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    if (args[0] === '[recipe_correction_request]') {
      correctionLogs.push(JSON.parse(String(args[1])) as Record<string, unknown>);
      return;
    }
    originalLog(...args);
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const correctedQuantity = calls > 1 ? 'Add 1 tbsp cooking oil and sauté the filling.' : 'Add 2 tbsp cooking oil and sauté the filling.';
    return openRouterResponse({
      dishName: 'Savory Grain Plate',
      title: 'Savory Grain Plate',
      description: 'The same savory grain plate with adjusted nutrition.',
      prepTime: '10 minutes',
      cookTime: '15 minutes',
      totalTime: '25 minutes',
      servings: 2,
      nutritionEstimate: { calories: 340, proteinGrams: 30, carbohydratesGrams: 30, fatGrams: 12, fiberGrams: 5 },
      equipment: ['pan', 'spoon'],
      ingredients: [
        '2 cups grain base',
        '1 cup lean high-protein savory component',
        '1 cup vegetable layer',
        '1 tbsp seasoning blend',
        '1 tbsp cooking oil',
      ],
      steps: [
        buildStep(1, { title: 'Cook', step: 'Cook the filling.', ingredients: ['lean high-protein savory component', 'grain base'], tools: ['pan'] }),
        buildStep(2, { title: 'Sauté', step: correctedQuantity, ingredients: ['cooking oil'], tools: ['pan'] }),
        buildStep(3, { title: 'Fold', step: 'Fold in the vegetable layer.', ingredients: ['vegetable layer'], tools: ['spoon'] }),
        buildStep(4, { title: 'Season', step: 'Season the filling.', ingredients: ['seasoning blend'], tools: ['spoon'] }),
        buildStep(5, { title: 'Warm', step: 'Warm the finished filling.', ingredients: ['grain base'], tools: ['pan'] }),
        buildStep(6, { title: 'Serve', step: 'Serve the finished filling.', ingredients: ['grain base'], tools: ['plate'] }),
      ],
    });
  };

  try {
    const response = await request('POST', `/v1/recipes/${sourceId}/correct`, {
      correctionNote: 'less fat and more protein',
      expectedSourceRecipeId: sourceId,
      mode: 'Normal',
    });
    assert.equal(response.status, 201);
    assert.equal(calls, 2);
    const firstLog = correctionLogs[0];
    const finalLog = correctionLogs.at(-1);
    assert.ok(firstLog);
    assert.ok(finalLog);
    assert.equal(firstLog.focusedRepairRan, true);
    assert.ok((firstLog.blockingValidationIssues as Array<{ code: string; stepIndex?: number }>).some(
      (issue) => issue.code === 'stale_quantity_reference' && issue.stepIndex === 2,
    ));
    assert.equal(finalLog.finalHttpStatus, 201);
    assert.deepEqual(finalLog.repairBlockingValidationIssues, []);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('duplicate correction submissions with one request id create one revision', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `duplicate-correction-${Date.now()}`;
  storeGeneratedRecipe(storedSourceRecipe(sourceId));
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return openRouterResponse(compoundNutritionGrainRecipe(15));
  };

  try {
    const payload = {
      correctionRequestId: `request-${sourceId}`,
      correctionNote: 'less fat and more protein',
      expectedSourceRecipeId: sourceId,
      mode: 'Normal',
    };
    const [first, duplicate] = await Promise.all([
      request('POST', `/v1/recipes/${sourceId}/correct`, payload),
      request('POST', `/v1/recipes/${sourceId}/correct`, payload),
    ]);
    assert.equal(first.status, 201);
    assert.equal(duplicate.status, 201);
    assert.equal(calls, 1);
    assert.equal(first.body.data.recipe.id, duplicate.body.data.recipe.id);
    const metadata = getGeneratedRecipeRevisionMetadata(first.body.data.recipe.id);
    assert.ok(metadata);
    assert.equal(metadata.parentRevisionId, sourceId);
    assert.equal(metadata.supersededBy, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('structured ID patch applies a same-count nutrition change without free-text manifests', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `structured-patch-${Date.now()}`;
  const source = storedFormulationEvidenceRecipe(sourceId);
  storeGeneratedRecipe(source);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openRouterResponse({
      ingredientOperations: [{
        operation: 'replace',
        sourceIngredientId: 'ingredient-2',
        result: { name: 'higher-protein savory component', quantity: '1 cup' },
        supportsRequirementIndexes: [1, 2],
      }],
      stepOperations: [{
        operation: 'replace',
        sourceStepId: 'step-1',
        result: {
          title: 'Prepare Component',
          text: 'Prepare the grain base with the higher-protein savory component.',
          ingredientReferences: ['ingredient-1', 'ingredient-2'],
        },
      }],
      nutritionEstimate: {
        calories: 340,
        proteinGrams: 30,
        carbohydratesGrams: 30,
        fatGrams: 12,
        fiberGrams: 5,
      },
    });
  };
  try {
    const response = await request('POST', `/v1/recipes/${sourceId}/correct`, {
      correctionNote: 'less fat and more protein',
      expectedSourceRecipeId: sourceId,
      mode: 'Normal',
    });
    assert.equal(response.status, 201);
    assert.equal(calls, 1);
    assert.equal(response.body.data.recipe.ingredients[1].name, 'higher-protein savory component');
    assert.equal(response.body.data.recipe.structuredSteps[0].ingredientsUsed[1], 'higher-protein savory component');
    assert.notEqual(response.body.data.recipe.id, sourceId);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('schema-invalid patch output retries with the dedicated patch contract before semantic validation', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `structured-patch-retry-${Date.now()}`;
  const source = storedFormulationEvidenceRecipe(sourceId);
  storeGeneratedRecipe(source);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openRouterResponse(calls === 1
      ? { ingredientOperations: [{ operation: 'replace', result: { name: 'invalid form', quantity: '1 cup' } }] }
      : {
          ingredientOperations: [{
            operation: 'replace', sourceIngredientId: 'ingredient-2',
            result: { name: 'higher-protein savory component', quantity: '1 cup' },
            supportsRequirementIndexes: [1, 2],
          }],
          stepOperations: [{
            operation: 'replace', sourceStepId: 'step-1',
            result: { text: 'Prepare the grain base with the higher-protein savory component.', ingredientReferences: ['ingredient-1', 'ingredient-2'] },
          }],
          nutritionEstimate: { calories: 340, proteinGrams: 30, carbohydratesGrams: 30, fatGrams: 12, fiberGrams: 5 },
        });
  };
  try {
    const response = await request('POST', `/v1/recipes/${sourceId}/correct`, {
      correctionNote: 'less fat and more protein', expectedSourceRecipeId: sourceId, mode: 'Normal',
    });
    assert.equal(response.status, 201);
    assert.equal(calls, 2);
    assert.equal(response.body.data.recipe.ingredients[1].name, 'higher-protein savory component');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('legacy complete-recipe fallback recovers after two uncanonicalizable patch responses', async () => {
  const originalFetch = globalThis.fetch;
  const sourceId = `structured-patch-fallback-${Date.now()}`;
  storeGeneratedRecipe(storedFormulationEvidenceRecipe(sourceId));
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls < 3) {
      return openRouterResponse({ ingredientOperations: [{ operation: 'unsupported_operation' }] });
    }
    return openRouterResponse(formulationEvidenceProviderRecipe());
  };
  try {
    const response = await request('POST', `/v1/recipes/${sourceId}/correct`, {
      correctionNote: 'less fat and more protein', expectedSourceRecipeId: sourceId, mode: 'Normal',
    });
    assert.equal(response.status, 201);
    assert.equal(calls, 3);
    assert.notEqual(response.body.data.recipe.id, sourceId);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

let sharedServer: Server | null = null;

async function getSharedServer() {
  if (!sharedServer) {
    const { app } = await import('./server.js');
    sharedServer = app.listen(0, '127.0.0.1');
    await once(sharedServer, 'listening');
  }
  return sharedServer;
}

after(async () => {
  if (!sharedServer) return;
  await new Promise<void>((resolve, reject) => {
    sharedServer?.close((error) => error ? reject(error) : resolve());
  });
  sharedServer = null;
});

async function request(method: string, path: string, body?: unknown) {
  const server = await getSharedServer();
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request({
      hostname: '127.0.0.1',
      localAddress: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: payload
        ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
        : {},
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, body: raw ? JSON.parse(raw) : undefined });
      });
    });
    req.on('error', reject);
    if (payload) req.end(payload); else req.end();
  });
}

test('POST /v1/recipes/:recipeId/correct regenerates ingredients/steps from a correction, not just the title', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [chickenAnalysis(), chickenRecipe()];
  let calls = 0;
  globalThis.fetch = async () => openRouterResponse(calls++ < responses.length ? responses[calls - 1] : lambRecipe());

  try {
    const scanResponse = await request('POST', '/v1/scans', {
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,AAAA',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });
    assert.equal(scanResponse.status, 201);
    const originalRecipeId = scanResponse.body.data.recipe.id as string;
    assert.equal(scanResponse.body.data.scan.dishName, 'Grilled Chicken Tikka');

    const correctionResponse = await request('POST', `/v1/recipes/${originalRecipeId}/correct`, {
      correctionNote: 'These are lamb chops, not chicken.',
      dishNameOverride: 'Grilled Lamb Chops',
      mode: 'Normal',
    });

    assert.equal(correctionResponse.status, 201);
    assert.equal(correctionResponse.body.ok, true);
    assert.equal(correctionResponse.body.data.scan.dishName, 'Grilled Lamb Chops');
    assert.equal(correctionResponse.body.data.recipe.title, 'Grilled Lamb Chops');
    assert.equal(correctionResponse.body.data.recipe.description, 'Herb-marinated grilled lamb chops, homemade.');
    assert.equal(correctionResponse.body.data.recipe.servings, 2);
    assert.equal(correctionResponse.body.data.recipe.totalTimeMinutes, 35);
    assert.deepEqual(correctionResponse.body.data.recipe.nutritionEstimate, {
      calories: 560,
      proteinGrams: 38,
      carbohydratesGrams: 6,
      fatGrams: 42,
    });
    assert.ok(correctionResponse.body.data.recipe.equipment.includes('grill pan'));
    assert.equal(correctionResponse.body.data.recipe.steps.length, 8);
    const correctedIngredients = correctionResponse.body.data.recipe.ingredients.map((ingredient: { name: string }) => ingredient.name.toLowerCase());
    assert.ok(correctedIngredients.some((name: string) => name.includes('lamb')));
    assert.ok(!correctedIngredients.some((name: string) => name.includes('chicken')));
    assert.ok(calls >= 3, `expected at least 3 provider calls, saw ${calls}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Add beef is mandatory, bypasses the ordinary recipe cache, and receives one focused repair', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    noodleAnalysis(),
    noodleRecipe(),
    noodleRecipe(),
    beefNoodleRecipe(),
  ];
  const correctionPrompts: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { messages?: Array<{ content?: unknown }> }
      : {};
    const prompt = JSON.stringify(body.messages ?? []);
    if (prompt.includes('MANDATORY USER CORRECTION')) {
      correctionPrompts.push(prompt);
    }
    const response = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    return openRouterResponse(response);
  };

  try {
    const scanResponse = await request('POST', '/v1/scans', {
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,AAAB',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });
    assert.equal(scanResponse.status, 201);
    const originalRecipeId = scanResponse.body.data.recipe.id as string;

    const correctionResponse = await request('POST', `/v1/recipes/${originalRecipeId}/correct`, {
      correctionNote: '  Add beef  ',
      mode: 'Normal',
    });

    assert.equal(correctionResponse.status, 201);
    assert.equal(correctionResponse.body.ok, true);
    assert.match(correctionResponse.body.data.recipe.title, /beef/i);
    assert.match(correctionResponse.body.data.recipe.description, /beef/i);
    assert.ok(correctionResponse.body.data.recipe.ingredients.some(
      (ingredient: { name: string }) => /beef/i.test(ingredient.name),
    ));
    assert.ok(correctionResponse.body.data.recipe.ingredients.some(
      (ingredient: { name: string }) => /noodle/i.test(ingredient.name),
    ));
    assert.ok(correctionResponse.body.data.recipe.steps.some(
      (step: string) => /beef/i.test(step),
    ));
    assert.ok(correctionResponse.body.data.recipe.nutritionEstimate.proteinGrams > 10);
    assert.notEqual(correctionResponse.body.data.recipe.nutritionEstimate.calories, 410);
    assert.equal(correctionResponse.body.data.recipe.servings, 2);
    assert.equal(correctionPrompts.length, 2);
    assert.ok(correctionPrompts.every((prompt) =>
      prompt.includes('Verbatim user instruction') && prompt.includes('Add beef')));
    assert.ok(correctionPrompts.every((prompt) => prompt.includes('  Add beef  ')));
    assert.ok(correctionPrompts.every((prompt) =>
      prompt.includes('Normalized interpretation for classification only') && prompt.includes('add beef')));
    assert.match(correctionPrompts[0], /hard constraint, not a suggestion/i);
    assert.match(correctionPrompts[1], /ONE FOCUSED REPAIR/);
    assert.match(correctionPrompts[1], /beef is missing from ingredients/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('compound nutrition correction repairs only the missed goal and rejects a still-partial repair', async () => {
  const originalFetch = globalThis.fetch;
  const successfulSourceId = `compound-success-${Date.now()}`;
  storeGeneratedRecipe(storedSourceRecipe(successfulSourceId));
  const prompts: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { messages?: Array<{ content?: unknown }> }
      : {};
    prompts.push(JSON.stringify(body.messages ?? []));
    calls += 1;
    return openRouterResponse(compoundNutritionGrainRecipe(calls === 1 ? 11 : 15));
  };

  try {
    const response = await request(
      'POST',
      `/v1/recipes/${successfulSourceId}/correct`,
      {
        correctionNote: 'less fat and more protein',
        mode: 'Normal',
      },
    );
    assert.equal(response.status, 201);
    assert.equal(calls, 2);
    assert.equal(response.body.data.recipe.nutritionEstimate.fatGrams, 6);
    assert.equal(response.body.data.recipe.nutritionEstimate.proteinGrams, 15);
    assert.notEqual(response.body.data.recipe.id, successfulSourceId);
    assert.match(prompts[0], /ALL parsed requirements below are mandatory/);
    assert.match(prompts[0], /original 8 g; corrected value MUST be at most 6 g/);
    assert.match(prompts[0], /original 10 g; corrected value MUST be at least 13 g/);
    assert.match(prompts[1], /Requirement 2 \(nutrition_goal\).*protein/s);
    assert.match(prompts[1], /candidate 11 g; required at least 13 g; numeric target FAIL/);
    assert.match(prompts[1], /candidate 6 g; required at most 6 g; numeric target PASS/);
    assert.doesNotMatch(prompts[1], /Requirement 1 \(nutrition_goal\): Per-serving fat did not make/);
    assert.match(prompts[1], /preserve every already-satisfied requirement/);

    const failedSourceId = `compound-failure-${Date.now()}`;
    const original = storedSourceRecipe(failedSourceId);
    storeGeneratedRecipe(original);
    calls = 0;
    prompts.length = 0;
    const correctionLogs: Array<Record<string, unknown>> = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      if (args[0] === '[recipe_correction_request]') {
        correctionLogs.push(JSON.parse(String(args[1])) as Record<string, unknown>);
        return;
      }
      originalLog(...args);
    };
    globalThis.fetch = async () => {
      calls += 1;
      return openRouterResponse(compoundNutritionGrainRecipe(11));
    };
    try {
      const failedResponse = await request(
        'POST',
        `/v1/recipes/${failedSourceId}/correct`,
        {
          correctionNote: 'less fat and more protein',
          mode: 'Normal',
        },
      );
      assert.equal(failedResponse.status, 422);
      assert.equal(failedResponse.body.error.message, 'We couldn’t update the recipe. Try again.');
      assert.equal(calls, 2);
      assert.deepEqual(getGeneratedRecipe(failedSourceId), original);
      const failureLog = correctionLogs.at(-1);
      assert.ok(failureLog);
      assert.equal(failureLog.finalHttpStatus, 422);
      assert.ok((failureLog.repairValidationIssueCodes as string[]).includes(
        'protein_target_not_met',
      ));
      assert.ok((failureLog.repairValidationIssueCodes as string[]).includes(
        'repair_candidate_unchanged',
      ));
      assert.equal(failureLog.repairCandidateEffectivelyIdentical, true);
      const repairAttempt = failureLog.repairAttempt as {
        providerRequirementEvaluations: Array<{
          nutrient: string;
          candidateValue: number;
          targetMinimum?: number;
          numericTargetPassed: boolean;
        }>;
      };
      const proteinEvaluation = repairAttempt.providerRequirementEvaluations.find(
        (evaluation) => evaluation.nutrient === 'protein',
      );
      assert.deepEqual(proteinEvaluation, {
        requirementIndex: 2,
        type: 'nutrition_goal',
        nutrient: 'protein',
        direction: 'more',
        originalValue: 10,
        targetValue: 13,
        targetMinimum: 13,
        candidateValue: 11,
        numericTargetPassed: false,
        ingredientEvidencePassed: true,
        stepEvidencePassed: true,
        servingsStable: true,
        macroDerivedCalories: 290,
        displayedCalories: 290,
        calorieTolerance: 29,
        calorieConsistencyPassed: true,
        issueCodes: ['protein_target_not_met'],
      });
      assert.equal('correctionNote' in failureLog, false);
      assert.equal('prompt' in failureLog, false);
    } finally {
      console.log = originalLog;
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sequential corrections use the latest stored corrected recipe as their source', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    noodleAnalysis(),
    noodleRecipe(),
    beefNoodleRecipe(),
    beefNoodleRecipeWithoutSesame(),
    spicyBeefNoodleRecipeWithoutSesame(),
  ];
  const correctionPrompts: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { messages?: Array<{ content?: unknown }> }
      : {};
    const prompt = JSON.stringify(body.messages ?? []);
    if (prompt.includes('MANDATORY USER CORRECTION')) {
      correctionPrompts.push(prompt);
    }
    return openRouterResponse(responses[Math.min(calls++, responses.length - 1)]);
  };

  try {
    const scanResponse = await request('POST', '/v1/scans', {
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,AAAD',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });
    assert.equal(scanResponse.status, 201);

    const firstSourceRecipeId = scanResponse.body.data.recipe.id as string;
    const firstCorrection = await request('POST', `/v1/recipes/${firstSourceRecipeId}/correct`, {
      correctionNote: 'Add beef',
      expectedSourceRecipeId: firstSourceRecipeId,
      mode: 'Normal',
    });
    assert.equal(firstCorrection.status, 201);
    const secondSourceRecipeId = firstCorrection.body.data.recipe.id as string;
    assert.notEqual(secondSourceRecipeId, firstSourceRecipeId);

    const secondCorrection = await request('POST', `/v1/recipes/${secondSourceRecipeId}/correct`, {
      correctionNote: 'Remove sesame',
      expectedSourceRecipeId: secondSourceRecipeId,
      mode: 'Normal',
    });
    assert.equal(secondCorrection.status, 201);
    const thirdSourceRecipeId = secondCorrection.body.data.recipe.id as string;
    assert.notEqual(thirdSourceRecipeId, secondSourceRecipeId);

    const thirdCorrection = await request('POST', `/v1/recipes/${thirdSourceRecipeId}/correct`, {
      correctionNote: 'Add a spicy ingredient',
      expectedSourceRecipeId: thirdSourceRecipeId,
      mode: 'Normal',
    });
    assert.equal(thirdCorrection.status, 201);
    assert.notEqual(thirdCorrection.body.data.recipe.id, thirdSourceRecipeId);

    assert.ok(secondCorrection.body.data.recipe.ingredients.some(
      (ingredient: { name: string }) => /beef/i.test(ingredient.name),
    ));
    assert.ok(secondCorrection.body.data.recipe.ingredients.some(
      (ingredient: { name: string }) => /noodle/i.test(ingredient.name),
    ));
    assert.ok(secondCorrection.body.data.recipe.ingredients.every(
      (ingredient: { name: string }) => !/sesame/i.test(ingredient.name),
    ));
    assert.ok(thirdCorrection.body.data.recipe.ingredients.some(
      (ingredient: { name: string }) => /chili/i.test(ingredient.name),
    ));
    assert.ok(correctionPrompts.length >= 3);
    const secondCorrectionPrompt = correctionPrompts.at(-2) ?? '';
    const thirdCorrectionPrompt = correctionPrompts.at(-1) ?? '';
    assert.match(secondCorrectionPrompt, /Beef Soy Sauce Noodles/);
    assert.match(secondCorrectionPrompt, /beef sirloin/);
    assert.match(thirdCorrectionPrompt, /beef sirloin/);
    assert.doesNotMatch(thirdCorrectionPrompt, /sesame oil/);
    assert.match(thirdCorrectionPrompt, /abstract_ingredient_addition/);
    assert.match(thirdCorrectionPrompt, /context-appropriate concrete ingredient/);
    assert.ok(thirdCorrection.body.data.recipe.ingredients.every(
      (ingredient: { name: string }) => !/spicy ingredient/i.test(ingredient.name),
    ));
    const latestStoredRecipe = getGeneratedRecipe(thirdCorrection.body.data.recipe.id);
    assert.ok(latestStoredRecipe);
    assert.equal(latestStoredRecipe.id, thirdCorrection.body.data.recipe.id);
    assert.equal(latestStoredRecipe.title, thirdCorrection.body.data.recipe.title);
    assert.deepEqual(
      latestStoredRecipe.ingredients,
      thirdCorrection.body.data.recipe.ingredients,
    );

    const failedAbstractCorrection = await request(
      'POST',
      `/v1/recipes/${thirdCorrection.body.data.recipe.id}/correct`,
      {
        correctionNote: 'Add something crunchy',
        expectedSourceRecipeId: thirdCorrection.body.data.recipe.id,
        mode: 'Normal',
      },
    );
    assert.equal(failedAbstractCorrection.status, 422);
    assert.equal(failedAbstractCorrection.body.error.message, 'We couldn’t update the recipe. Try again.');
    const storedAfterFailure = getGeneratedRecipe(thirdCorrection.body.data.recipe.id);
    assert.ok(storedAfterFailure);
    assert.equal(storedAfterFailure.title, latestStoredRecipe.title);
    assert.deepEqual(storedAfterFailure.ingredients, latestStoredRecipe.ingredients);
    assert.deepEqual(storedAfterFailure.steps, latestStoredRecipe.steps);

    const staleCorrection = await request('POST', `/v1/recipes/${firstSourceRecipeId}/correct`, {
      correctionNote: 'Add something crunchy',
      expectedSourceRecipeId: firstSourceRecipeId,
      mode: 'Normal',
    });
    assert.equal(staleCorrection.status, 409);
    assert.equal(staleCorrection.body.error.code, 'stale_recipe_revision');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an ignored correction and invalid focused repair fail safely without overwriting the original stored recipe', async () => {
  const originalFetch = globalThis.fetch;
  const dishName = 'Garlic Soy Noodles';
  const ignoredRecipe = noodleRecipe(dishName);
  const responses = [
    noodleAnalysis(dishName),
    ignoredRecipe,
    ignoredRecipe,
    ignoredRecipe,
  ];
  let calls = 0;
  let correctionCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { messages?: Array<{ content?: unknown }> }
      : {};
    if (JSON.stringify(body.messages ?? []).includes('MANDATORY USER CORRECTION')) {
      correctionCalls += 1;
    }
    const response = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    return openRouterResponse(response);
  };

  try {
    const scanResponse = await request('POST', '/v1/scans', {
      source: 'photos',
      mode: 'Normal',
      image: {
        dataUrl: 'data:image/png;base64,AAAC',
        mimeType: 'image/png',
        dataUrlSizeBytes: 26,
      },
    });
    assert.equal(scanResponse.status, 201);
    const originalRecipeId = scanResponse.body.data.recipe.id as string;
    const originalStoredRecipe = getGeneratedRecipe(originalRecipeId);
    assert.ok(originalStoredRecipe);

    const correctionResponse = await request('POST', `/v1/recipes/${originalRecipeId}/correct`, {
      correctionNote: 'Add beef',
      mode: 'Normal',
    });

    assert.equal(correctionResponse.status, 422);
    assert.equal(correctionResponse.body.ok, false);
    assert.equal(correctionResponse.body.error.code, 'recipe_correction_failed');
    assert.equal(correctionResponse.body.error.message, 'We couldn’t update the recipe. Try again.');
    assert.equal(correctionCalls, 2);
    assert.deepEqual(getGeneratedRecipe(originalRecipeId), originalStoredRecipe);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('malformed provider responses receive one patch retry and one legacy fallback before returning 502', async () => {
  const originalFetch = globalThis.fetch;
  const source = storedSourceRecipe(`malformed-source-${Date.now()}`);
  storeGeneratedRecipe(source);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('<html>temporary upstream output</html>', { status: 200 });
  };

  try {
    const response = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Make it brighter',
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(calls, 3);
    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, 'recipe_correction_unavailable');
    assert.equal(response.body.error.message, 'We couldn’t update the recipe. Try again.');
    assert.equal(getGeneratedRecipe(source.id)?.title, source.title);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('transient provider failures receive one automatic retry and return 503 when unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const source = storedSourceRecipe(`network-source-${Date.now()}`);
  storeGeneratedRecipe(source);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('network unavailable');
  };

  try {
    const response = await request('POST', `/v1/recipes/${source.id}/correct`, {
      correctionNote: 'Make it brighter',
      expectedSourceRecipeId: source.id,
      mode: 'Normal',
    });
    assert.equal(calls, 2);
    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'recipe_correction_unavailable');
    assert.equal(response.body.error.message, 'We couldn’t update the recipe. Try again.');
    assert.equal(getGeneratedRecipe(source.id)?.title, source.title);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POST /v1/recipes/:recipeId/correct returns 404 for an unknown or expired recipe', async () => {
  const response = await request('POST', '/v1/recipes/does-not-exist/correct', {
    correctionNote: 'These are lamb chops, not chicken.',
  });
  assert.equal(response.status, 404);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'recipe_not_found');
});

test('POST /v1/recipes/:recipeId/correct rejects an empty correction note', async () => {
  const response = await request('POST', '/v1/recipes/does-not-exist/correct', {
    correctionNote: '   ',
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'validation_error');
});

test('legacy scan and correction modes normalize to Normal while arbitrary modes remain invalid', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [noodleAnalysis(), noodleRecipe(), beefNoodleRecipe()];
  let calls = 0;
  globalThis.fetch = async () => openRouterResponse(responses[calls++]);

  try {
    const scanResponse = await request('POST', '/v1/scans', {
      source: 'photos',
      mode: 'Budget',
      image: {
        dataUrl: 'data:image/png;base64,TEVHQUNZ',
        mimeType: 'image/png',
        dataUrlSizeBytes: 30,
      },
    });
    assert.equal(scanResponse.status, 201);
    assert.equal(scanResponse.body.data.recipe.mode, 'Normal');

    const sourceRecipeId = scanResponse.body.data.recipe.id as string;
    const correctionResponse = await request(
      'POST',
      `/v1/recipes/${sourceRecipeId}/correct`,
      {
        correctionNote: 'Add beef',
        expectedSourceRecipeId: sourceRecipeId,
        mode: 'Restaurant Copy',
      },
    );
    assert.equal(correctionResponse.status, 201);
    assert.equal(correctionResponse.body.data.recipe.mode, 'Normal');
    const correctedSourceId = correctionResponse.body.data.recipe.id as string;
    assert.notEqual(correctedSourceId, sourceRecipeId);
    assert.equal(getGeneratedRecipe(correctedSourceId)?.mode, 'Normal');
  } finally {
    globalThis.fetch = originalFetch;
  }

  const invalidResponse = await request('POST', '/v1/recipes/does-not-exist/correct', {
    correctionNote: 'Make a relevant change',
    mode: 'Chef Surprise',
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.error.code, 'validation_error');
  assert.equal(invalidResponse.body.error.details, undefined);
});
