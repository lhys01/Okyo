import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe, RecipeIngredient, RecipeStep } from '../types.js';
import {
  analyzeIngredientChanges,
  assessAndReconcileCorrectionCandidate,
  evaluateNutritionRequirements,
  getCalorieMacroTolerance,
  getCorrectionIngredientHints,
  getEstimatedCaloriesFromMacros,
  getNutritionRequirementTargets,
  getNutritionTargetPolicy,
  isActionableCorrectionPlan,
  isNutritionMacroConsistent,
  normalizeCorrectionText,
  parseCorrectionIntent,
  parseCorrectionRequirements,
  validateCorrectedRecipe,
} from './correctionIntent.js';

test('compound nutrition intent order and fuzzy spelling normalize identically', () => {
  for (const note of ['less fat and more protein', 'more protein and less fat', 'more protien and less fatt']) {
    const plan = parseCorrectionRequirements(note);
    assert.deepEqual(
      plan.requirements.map((intent) => intent.type === 'nutrition_goal' ? `${intent.direction} ${intent.nutrient}` : intent.type),
      note.startsWith('less')
        ? ['less fat', 'more protein']
        : ['more protein', 'less fat'],
    );
  }
});

test('vague correction is rejected before provider work and serving changes are explicit', () => {
  const vague = parseCorrectionRequirements('ok');
  assert.equal(isActionableCorrectionPlan(vague), false);
  const serving = parseCorrectionRequirements('make enough for six people');
  assert.deepEqual(serving.requirements, [{
    type: 'servings_adjustment',
    note: 'make enough for six people',
    servings: 6,
  }]);
});

test('equivalent ingredient formatting and generic steps do not create false evidence failures', () => {
  const original = makeRecipe({
    ingredients: [{ name: 'minced napa cabbage', quantity: '1 cup' }, { name: 'salt', quantity: 'to taste' }],
    steps: ['Cook the filling until tender.', 'Season with salt.'],
    structuredSteps: [
      { title: 'Cook', text: 'Cook the filling until tender.', ingredientsUsed: ['minced napa cabbage'], toolsUsed: ['pan'] },
      { title: 'Season', text: 'Season with salt.', ingredientsUsed: ['salt'], toolsUsed: ['spoon'] },
    ],
    nutritionEstimate: { calories: 200, proteinGrams: 10, carbohydratesGrams: 20, fatGrams: 8, fiberGrams: 3 },
  });
  const candidate = makeRecipe({
    ...original,
    ingredients: [{ name: '1.5 cup minced napa cabbage', quantity: 'napa cabbage, minced' }, { name: 'to taste salt', quantity: '' }],
    nutritionEstimate: { calories: 180, proteinGrams: 10, carbohydratesGrams: 20, fatGrams: 6, fiberGrams: 3 },
  });
  const analysis = analyzeIngredientChanges(original, candidate, [{ type: 'nutrition_goal', note: 'less fat', direction: 'less', nutrient: 'fat' }]);
  assert.equal(analysis.changes.length, 1);
  assert.equal(analysis.changes[0]?.kind, 'quantity_changed');
  const evaluation = evaluateNutritionRequirements(original, candidate, [{ type: 'nutrition_goal', note: 'less fat', direction: 'less', nutrient: 'fat' }])[0];
  assert.equal(evaluation?.ingredientEvidencePassed, true);
  assert.equal(evaluation?.stepEvidencePassed, true);
});

test('nutrition target policy uses nutrient-specific relative and absolute minimums', () => {
  const recipe = makeRecipe({
    nutritionEstimate: {
      calories: 150,
      proteinGrams: 2,
      carbohydratesGrams: 20,
      fatGrams: 8,
      fiberGrams: 1,
    },
  });

  assert.deepEqual(
    getNutritionTargetPolicy(recipe, {
      type: 'nutrition_goal',
      note: 'higher protein',
      direction: 'more',
      nutrient: 'protein',
    }),
    {
      nutrient: 'protein',
      direction: 'more',
      currentValue: 2,
      minimumChange: 3,
      targetValue: 5,
    },
  );
  assert.equal(
    getNutritionTargetPolicy(recipe, {
      type: 'nutrition_goal',
      note: 'less fat',
      direction: 'less',
      nutrient: 'fat',
    }).targetValue,
    6,
  );
  assert.equal(
    getNutritionTargetPolicy(recipe, {
      type: 'nutrition_goal',
      note: 'more fiber',
      direction: 'more',
      nutrient: 'fiber',
    }).targetValue,
    3,
  );
  const tinyValueRecipe = makeRecipe({
    nutritionEstimate: {
      calories: 20,
      proteinGrams: 1,
      carbohydratesGrams: 2,
      fatGrams: 1,
      fiberGrams: 0,
    },
  });
  assert.equal(
    getNutritionTargetPolicy(tinyValueRecipe, {
      type: 'nutrition_goal',
      note: 'less fat',
      direction: 'less',
      nutrient: 'fat',
    }).targetValue,
    0.5,
  );
  const zeroFatRecipe = makeRecipe({
    nutritionEstimate: {
      calories: 120,
      proteinGrams: 5,
      carbohydratesGrams: 25,
      fatGrams: 0,
      fiberGrams: 2,
    },
  });
  const zeroFatCandidate = makeRecipe({
    ...zeroFatRecipe,
    ingredients: [
      { name: 'whole grain base', quantity: '1 cup' },
      { name: 'fresh topping', quantity: '1/2 cup' },
    ],
    steps: ['Combine the whole grain base with the fresh topping.'],
    structuredSteps: [{
      title: 'Combine',
      text: 'Combine the whole grain base with the fresh topping.',
      ingredientsUsed: ['whole grain base', 'fresh topping'],
      toolsUsed: ['bowl'],
    }],
  });
  assert.ok(
    validateCorrectedRecipe(
      zeroFatRecipe,
      zeroFatCandidate,
      { type: 'nutrition_goal', note: 'less fat', direction: 'less', nutrient: 'fat' },
    ).some((issue) => issue.includes('required meaningful change')),
  );
});

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const ingredients: RecipeIngredient[] = overrides.ingredients ?? [
    { name: 'wheat noodles', quantity: '8 oz' },
    { name: 'soy sauce', quantity: '2 tbsp' },
    { name: 'garlic', quantity: '2 cloves' },
    { name: 'sesame oil', quantity: '1 tbsp' },
    { name: 'scallions', quantity: '2' },
  ];
  const steps = overrides.steps ?? [
    'Boil the wheat noodles until tender.',
    'Whisk soy sauce, garlic, and sesame oil.',
    'Toss the noodles with the sauce.',
    'Finish the noodles with scallions.',
  ];
  const structuredSteps: RecipeStep[] = overrides.structuredSteps ?? steps.map((text, index) => ({
    phase: Math.min(index + 1, 6),
    title: `Step ${index + 1}`,
    text,
    ingredientsUsed: ingredients.slice(0, 2).map((ingredient) => ingredient.name),
    toolsUsed: ['skillet'],
  }));

  return {
    id: 'recipe-soy-noodles',
    scanResultId: 'scan-soy-noodles',
    title: 'Soy Sauce Noodles',
    mode: 'Normal',
    description: 'Chewy noodles tossed in a savory soy sauce.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    totalTimeMinutes: 20,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 7,
    estimatedSavings: 11,
    ingredients,
    steps,
    structuredSteps,
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated recipe.',
    equipment: ['large pot', 'skillet'],
    nutritionEstimate: {
      calories: 410,
      proteinGrams: 10,
      carbohydratesGrams: 65,
      fatGrams: 12,
    },
    ...overrides,
  };
}

test('correction intent parser covers common deterministic intents and preserves the note', () => {
  assert.deepEqual(parseCorrectionIntent('Add beef'), {
    type: 'add_ingredient',
    note: 'Add beef',
    ingredient: 'beef',
  });
  assert.equal(parseCorrectionIntent('Remove sesame').type, 'remove_ingredient');
  assert.deepEqual(parseCorrectionIntent('There are no onions'), {
    type: 'remove_ingredient',
    note: 'There are no onions',
    ingredient: 'onions',
  });
  assert.deepEqual(parseCorrectionIntent('Replace chicken with tofu'), {
    type: 'replace_ingredient',
    note: 'Replace chicken with tofu',
    removeIngredient: 'chicken',
    addIngredient: 'tofu',
  });
  assert.deepEqual(parseCorrectionIntent('Use tofu instead of chicken'), {
    type: 'replace_ingredient',
    note: 'Use tofu instead of chicken',
    removeIngredient: 'chicken',
    addIngredient: 'tofu',
  });
  assert.deepEqual(parseCorrectionIntent('This is lamb, not chicken'), {
    type: 'correct_dish_identity',
    note: 'This is lamb, not chicken',
    removeIngredient: 'chicken',
    addIngredient: 'lamb',
  });
  assert.equal(parseCorrectionIntent('These are lamb chops, not chicken.').type, 'correct_dish_identity');
  assert.equal(parseCorrectionIntent('Make it dairy-free').type, 'dietary_restriction');
  assert.equal(parseCorrectionIntent('Add more protein').type, 'nutrition_goal');
  assert.equal(parseCorrectionIntent('Make the sauce brighter').type, 'general');
});

test('specific additions stay literal while abstract, sensory, and nutrition requests use outcome intents', () => {
  assert.deepEqual(parseCorrectionIntent('Add mushrooms'), {
    type: 'add_ingredient',
    note: 'Add mushrooms',
    ingredient: 'mushrooms',
  });
  assert.deepEqual(parseCorrectionIntent('Add a spicy ingredient'), {
    type: 'abstract_ingredient_addition',
    note: 'Add a spicy ingredient',
    requestedQuality: 'spicy',
  });
  assert.equal(parseCorrectionIntent('Add something crunchy').type, 'abstract_ingredient_addition');
  assert.equal(parseCorrectionIntent('Add a vegetable').type, 'abstract_ingredient_addition');
  assert.equal(parseCorrectionIntent('Add a fresh topping').type, 'abstract_ingredient_addition');
  assert.deepEqual(parseCorrectionIntent('Add a spicy ingredient to a noodle recipe'), {
    type: 'abstract_ingredient_addition',
    note: 'Add a spicy ingredient to a noodle recipe',
    requestedQuality: 'spicy',
  });
  assert.deepEqual(parseCorrectionIntent('Add something crunchy to a soup'), {
    type: 'abstract_ingredient_addition',
    note: 'Add something crunchy to a soup',
    requestedQuality: 'crunchy',
  });
  assert.deepEqual(parseCorrectionIntent('Add a vegetable to a rice dish'), {
    type: 'abstract_ingredient_addition',
    note: 'Add a vegetable to a rice dish',
    requestedQuality: 'vegetable',
  });
  assert.equal(parseCorrectionIntent('Make it crispier').type, 'sensory_adjustment');
  assert.equal(parseCorrectionIntent('Add some crunch').type, 'abstract_ingredient_addition');
  assert.equal(parseCorrectionIntent('Make a sauce more acidic').type, 'sensory_adjustment');
  assert.equal(parseCorrectionIntent('Add more acidity').type, 'sensory_adjustment');
  assert.equal(parseCorrectionIntent('Add more fiber').type, 'nutrition_goal');
  assert.equal(parseCorrectionIntent('Make it lighter').type, 'nutrition_goal');
});

test('concept normalization tolerates spelling mistakes without changing raw user text', () => {
  const cases = [
    ['Make it have more protien', 'make it have more protein', 'nutrition_goal'],
    ['Add more protin', 'add more protein', 'nutrition_goal'],
    ['Add more vegtable', 'add more vegetable', 'abstract_ingredient_addition'],
    ['Reduce the caleries', 'reduce the calorie', 'nutrition_goal'],
    ['Use fewer carps', 'use fewer carbohydrate', 'nutrition_goal'],
    ['Make it diary free', 'make it dairy free', 'dietary_restriction'],
    ['Make it spicer', 'make it spicy', 'sensory_adjustment'],
    ['Add something cruchy', 'add something crunchy', 'abstract_ingredient_addition'],
    ['Make it less sweeet', 'make it less sweet', 'sensory_adjustment'],
  ] as const;

  for (const [raw, normalized, intentType] of cases) {
    assert.equal(normalizeCorrectionText(raw), normalized);
    const intent = parseCorrectionIntent(raw);
    assert.equal(intent.type, intentType);
    assert.equal(intent.note, raw);
  }
  assert.equal(normalizeCorrectionText('Add jalapeño'), 'add jalapeno');
  assert.equal(normalizeCorrectionText('Add planetary'), 'add planetary');
});

test('informal nutrition, sensory, dietary, and method phrasing maps to generic outcome intents', () => {
  for (const note of [
    'Add more protein',
    'Make it higher in protein',
    'Increase the protein',
    'More protein please',
    'Make it have more protein',
    'Make it have more protien',
    'Add more protin',
    'I want more protein in this',
  ]) {
    assert.deepEqual(
      parseCorrectionIntent(note),
      { type: 'nutrition_goal', note, direction: 'more', nutrient: 'protein' },
    );
  }

  assert.deepEqual(parseCorrectionIntent('Give it more acidity'), {
    type: 'sensory_adjustment',
    note: 'Give it more acidity',
    adjustment: 'more acidic',
  });
  assert.deepEqual(parseCorrectionIntent('Use a non-dairy substitute'), {
    type: 'dietary_restriction',
    note: 'Use a non-dairy substitute',
    restriction: 'dairy-free',
  });
  assert.deepEqual(parseCorrectionIntent('Replace the main protein with a vegetarian option'), {
    type: 'dietary_restriction',
    note: 'Replace the main protein with a vegetarian option',
    restriction: 'vegetarian',
  });
  assert.deepEqual(parseCorrectionIntent('Change the cooking method to baking'), {
    type: 'cooking_method_adjustment',
    note: 'Change the cooking method to baking',
    method: 'baking',
  });
  assert.deepEqual(parseCorrectionIntent('Please make the finish more aromatic'), {
    type: 'general',
    note: 'Please make the finish more aromatic',
  });
});

test('Add beef requires beef in the recipe, cooking steps, title or description, and recalculated nutrition', () => {
  const original = makeRecipe();
  const beefIngredient = { name: 'sliced beef', quantity: '12 oz' };
  const ingredients = [...original.ingredients, beefIngredient];
  const steps = [
    'Boil the wheat noodles until tender.',
    'Sear the sliced beef in a skillet until safely cooked.',
    'Whisk soy sauce, garlic, and sesame oil.',
    'Toss the noodles and beef with the sauce, then finish with scallions.',
  ];
  const corrected = makeRecipe({
    title: 'Beef Soy Sauce Noodles',
    description: 'Chewy soy sauce noodles with tender sliced beef.',
    ingredients,
    steps,
    structuredSteps: steps.map((text, index) => ({
      phase: Math.min(index + 1, 6),
      title: `Step ${index + 1}`,
      text,
      ingredientsUsed: text.includes('beef') ? ['sliced beef'] : ['wheat noodles'],
      toolsUsed: ['skillet'],
    })),
    nutritionEstimate: {
      calories: 580,
      proteinGrams: 35,
      carbohydratesGrams: 65,
      fatGrams: 20,
    },
  });

  assert.deepEqual(validateCorrectedRecipe(original, corrected, parseCorrectionIntent('Add beef')), []);
  assert.ok(corrected.ingredients.some((ingredient) => ingredient.name.includes('noodles')));
  assert.notEqual(corrected.nutritionEstimate?.proteinGrams, original.nutritionEstimate?.proteinGrams);
  assert.notEqual(corrected.nutritionEstimate?.calories, original.nutritionEstimate?.calories);
});

test('Remove sesame rejects sesame aliases in ingredients or optional garnish steps', () => {
  const original = makeRecipe();
  const ingredients = original.ingredients.filter((ingredient) => !ingredient.name.includes('sesame'));
  const steps = [
    'Boil the wheat noodles until tender.',
    'Whisk soy sauce and garlic.',
    'Toss the noodles with the sauce.',
    'Finish the noodles with scallions.',
  ];
  const corrected = makeRecipe({
    ingredients,
    steps,
    structuredSteps: steps.map((text, index) => ({
      title: `Step ${index + 1}`,
      text,
      ingredientsUsed: ['wheat noodles'],
      toolsUsed: ['skillet'],
    })),
    nutritionEstimate: {
      calories: 375,
      proteinGrams: 10,
      carbohydratesGrams: 64,
      fatGrams: 9,
    },
  });
  const intent = parseCorrectionIntent('Remove sesame');

  assert.deepEqual(validateCorrectedRecipe(original, corrected, intent), []);

  const invalid = makeRecipe({
    ...corrected,
    steps: [...steps, 'Optionally garnish with sesame seeds.'],
    structuredSteps: [
      ...(corrected.structuredSteps ?? []),
      {
        title: 'Garnish',
        text: 'Optionally garnish with sesame seeds.',
        ingredientsUsed: ['sesame seeds'],
        toolsUsed: ['serving bowl'],
      },
    ],
  });
  assert.ok(validateCorrectedRecipe(original, invalid, intent).some((issue) => issue.includes('garnish')));
});

test('Replace chicken with tofu requires tofu and removes chicken from ingredients and steps', () => {
  const original = makeRecipe({
    title: 'Chicken Rice Bowl',
    description: 'Chicken, rice, and broccoli with soy sauce.',
    ingredients: [
      { name: 'chicken thighs', quantity: '1 lb' },
      { name: 'white rice', quantity: '1 cup' },
      { name: 'broccoli', quantity: '2 cups' },
      { name: 'soy sauce', quantity: '2 tbsp' },
    ],
    steps: [
      'Cook the white rice.',
      'Sear the chicken thighs until they reach 165°F.',
      'Steam the broccoli.',
      'Serve the chicken over rice with soy sauce.',
    ],
    structuredSteps: [
      { title: 'Cook Rice', text: 'Cook the white rice.', ingredientsUsed: ['white rice'], toolsUsed: ['pot'] },
      { title: 'Sear Chicken', text: 'Sear the chicken thighs until they reach 165°F.', ingredientsUsed: ['chicken thighs'], toolsUsed: ['skillet'] },
      { title: 'Steam Broccoli', text: 'Steam the broccoli.', ingredientsUsed: ['broccoli'], toolsUsed: ['pot'] },
      { title: 'Serve', text: 'Serve the chicken over rice with soy sauce.', ingredientsUsed: ['chicken thighs', 'white rice'], toolsUsed: ['bowl'] },
    ],
    nutritionEstimate: { calories: 530, proteinGrams: 38, carbohydratesGrams: 57, fatGrams: 17 },
  });
  const corrected = makeRecipe({
    ...original,
    title: 'Tofu Rice Bowl',
    description: 'Crisp tofu, rice, and broccoli with soy sauce.',
    ingredients: [
      { name: 'firm tofu', quantity: '14 oz' },
      ...original.ingredients.slice(1),
    ],
    steps: [
      'Cook the white rice.',
      'Sear the firm tofu until crisp.',
      'Steam the broccoli.',
      'Serve the tofu over rice with soy sauce.',
    ],
    structuredSteps: [
      { title: 'Cook Rice', text: 'Cook the white rice.', ingredientsUsed: ['white rice'], toolsUsed: ['pot'] },
      { title: 'Sear Tofu', text: 'Sear the firm tofu until crisp.', ingredientsUsed: ['firm tofu'], toolsUsed: ['skillet'] },
      { title: 'Steam Broccoli', text: 'Steam the broccoli.', ingredientsUsed: ['broccoli'], toolsUsed: ['pot'] },
      { title: 'Serve', text: 'Serve the tofu over rice with soy sauce.', ingredientsUsed: ['firm tofu', 'white rice'], toolsUsed: ['bowl'] },
    ],
    nutritionEstimate: { calories: 470, proteinGrams: 24, carbohydratesGrams: 59, fatGrams: 15 },
  });

  assert.deepEqual(
    validateCorrectedRecipe(original, corrected, parseCorrectionIntent('Replace chicken with tofu')),
    [],
  );
});

test('dish identity correction replaces chicken with lamb across all recipe presentation fields', () => {
  const original = makeRecipe({
    title: 'Chicken Curry',
    description: 'A warming chicken curry.',
    ingredients: [
      { name: 'chicken thighs', quantity: '1 lb' },
      { name: 'curry paste', quantity: '3 tbsp' },
      { name: 'coconut milk', quantity: '1 can' },
      { name: 'white rice', quantity: '1 cup' },
    ],
    steps: ['Brown the chicken.', 'Simmer chicken with curry paste.', 'Add coconut milk.', 'Serve chicken curry with rice.'],
    structuredSteps: [
      { title: 'Brown Chicken', text: 'Brown the chicken.', ingredientsUsed: ['chicken thighs'], toolsUsed: ['pot'] },
      { title: 'Simmer Curry', text: 'Simmer chicken with curry paste.', ingredientsUsed: ['chicken thighs', 'curry paste'], toolsUsed: ['pot'] },
      { title: 'Add Coconut', text: 'Add coconut milk.', ingredientsUsed: ['coconut milk'], toolsUsed: ['pot'] },
      { title: 'Serve', text: 'Serve chicken curry with rice.', ingredientsUsed: ['chicken thighs', 'white rice'], toolsUsed: ['bowl'] },
    ],
    nutritionEstimate: { calories: 590, proteinGrams: 41, carbohydratesGrams: 55, fatGrams: 23 },
  });
  const corrected = makeRecipe({
    ...original,
    title: 'Lamb Curry',
    description: 'A warming lamb curry.',
    ingredients: [
      { name: 'lamb shoulder', quantity: '1 lb' },
      ...original.ingredients.slice(1),
    ],
    steps: ['Brown the lamb.', 'Simmer lamb with curry paste.', 'Add coconut milk.', 'Serve lamb curry with rice.'],
    structuredSteps: [
      { title: 'Brown Lamb', text: 'Brown the lamb.', ingredientsUsed: ['lamb shoulder'], toolsUsed: ['pot'] },
      { title: 'Simmer Curry', text: 'Simmer lamb with curry paste.', ingredientsUsed: ['lamb shoulder', 'curry paste'], toolsUsed: ['pot'] },
      { title: 'Add Coconut', text: 'Add coconut milk.', ingredientsUsed: ['coconut milk'], toolsUsed: ['pot'] },
      { title: 'Serve', text: 'Serve lamb curry with rice.', ingredientsUsed: ['lamb shoulder', 'white rice'], toolsUsed: ['bowl'] },
    ],
    nutritionEstimate: { calories: 650, proteinGrams: 37, carbohydratesGrams: 55, fatGrams: 31 },
  });

  assert.deepEqual(
    validateCorrectedRecipe(original, corrected, parseCorrectionIntent('This is lamb, not chicken')),
    [],
  );
});

test('simple corrections reject unrelated ingredient quantity and serving mutations', () => {
  const original = makeRecipe();
  const beefIngredient = { name: 'ground beef', quantity: '12 oz' };
  const steps = [
    'Boil the wheat noodles.',
    'Brown the ground beef.',
    'Toss beef and noodles with soy sauce.',
    'Finish with scallions.',
  ];
  const mutated = makeRecipe({
    title: 'Beef Soy Sauce Noodles',
    description: 'Soy sauce noodles with ground beef.',
    ingredients: [
      { ...original.ingredients[0], quantity: '12 oz' },
      ...original.ingredients.slice(1),
      beefIngredient,
    ],
    servings: 4,
    steps,
    structuredSteps: steps.map((text) => ({
      title: 'Cook',
      text,
      ingredientsUsed: ['ground beef', 'wheat noodles'],
      toolsUsed: ['skillet'],
    })),
    nutritionEstimate: { calories: 580, proteinGrams: 35, carbohydratesGrams: 65, fatGrams: 20 },
  });

  const issues = validateCorrectedRecipe(original, mutated, parseCorrectionIntent('Add beef'));
  assert.ok(issues.some((issue) => issue.includes('Servings changed')));
  assert.ok(issues.some((issue) => issue.includes('Unrelated quantity')));
});

test('ingredient hints remove forbidden concepts and add required replacements', () => {
  assert.deepEqual(
    getCorrectionIngredientHints(['chicken thighs', 'rice', 'soy sauce'], parseCorrectionIntent('Replace chicken with tofu')),
    ['rice', 'soy sauce', 'tofu'],
  );
  assert.deepEqual(
    getCorrectionIngredientHints(['noodles', 'sesame oil', 'scallions'], parseCorrectionIntent('Remove sesame')),
    ['noodles', 'scallions'],
  );
});

test('generic intent validation works across unrelated recipes without recipe-specific rules', () => {
  const stirFry = makeRecipe({
    id: 'stir-fry',
    title: 'Vegetable Stir-Fry',
    description: 'Crisp vegetables in a savory sauce.',
    ingredients: [
      { name: 'mixed vegetables', quantity: '4 cups' },
      { name: 'peanut sauce', quantity: '1/3 cup' },
      { name: 'rice', quantity: '2 cups' },
    ],
    steps: ['Cook the vegetables.', 'Stir in peanut sauce.', 'Serve over rice.'],
    structuredSteps: [
      { title: 'Cook', text: 'Cook the vegetables.', ingredientsUsed: ['mixed vegetables'], toolsUsed: ['skillet'] },
      { title: 'Sauce', text: 'Stir in peanut sauce.', ingredientsUsed: ['peanut sauce'], toolsUsed: ['skillet'] },
      { title: 'Serve', text: 'Serve over rice.', ingredientsUsed: ['rice'], toolsUsed: ['bowl'] },
    ],
  });
  const peanutFree = makeRecipe({
    ...stirFry,
    description: 'Crisp vegetables in a savory ginger sauce.',
    ingredients: [
      { name: 'mixed vegetables', quantity: '4 cups' },
      { name: 'ginger sauce', quantity: '1/3 cup' },
      { name: 'rice', quantity: '2 cups' },
    ],
    steps: ['Cook the vegetables.', 'Stir in ginger sauce.', 'Serve over rice.'],
    structuredSteps: [
      { title: 'Cook', text: 'Cook the vegetables.', ingredientsUsed: ['mixed vegetables'], toolsUsed: ['skillet'] },
      { title: 'Sauce', text: 'Stir in ginger sauce.', ingredientsUsed: ['ginger sauce'], toolsUsed: ['skillet'] },
      { title: 'Serve', text: 'Serve over rice.', ingredientsUsed: ['rice'], toolsUsed: ['bowl'] },
    ],
  });
  assert.deepEqual(
    validateCorrectedRecipe(stirFry, peanutFree, parseCorrectionIntent('Remove peanuts')),
    [],
  );
  assert.deepEqual(
    validateCorrectedRecipe(stirFry, peanutFree, parseCorrectionIntent('Remove the nuts')),
    [],
  );

  const pasta = makeRecipe({
    id: 'pasta',
    title: 'Tomato Pasta',
    description: 'Pasta with tomato sauce.',
    ingredients: [
      { name: 'pasta', quantity: '8 oz' },
      { name: 'tomato sauce', quantity: '2 cups' },
    ],
    steps: ['Boil the pasta.', 'Warm the sauce.', 'Toss pasta with sauce.'],
    structuredSteps: [
      { title: 'Boil', text: 'Boil the pasta.', ingredientsUsed: ['pasta'], toolsUsed: ['pot'] },
      { title: 'Sauce', text: 'Warm the sauce.', ingredientsUsed: ['tomato sauce'], toolsUsed: ['skillet'] },
      { title: 'Toss', text: 'Toss pasta with sauce.', ingredientsUsed: ['pasta', 'tomato sauce'], toolsUsed: ['skillet'] },
    ],
    nutritionEstimate: { calories: 420, proteinGrams: 14, carbohydratesGrams: 75, fatGrams: 7 },
  });
  const mushroomPasta = makeRecipe({
    ...pasta,
    title: 'Tomato Mushroom Pasta',
    description: 'Pasta with tomato sauce and sautéed mushrooms.',
    ingredients: [...pasta.ingredients, { name: 'sliced mushrooms', quantity: '2 cups' }],
    steps: ['Boil the pasta.', 'Sauté the mushrooms.', 'Warm the sauce.', 'Toss pasta, mushrooms, and sauce.'],
    structuredSteps: [
      { title: 'Boil', text: 'Boil the pasta.', ingredientsUsed: ['pasta'], toolsUsed: ['pot'] },
      { title: 'Sauté', text: 'Sauté the mushrooms.', ingredientsUsed: ['sliced mushrooms'], toolsUsed: ['skillet'] },
      { title: 'Sauce', text: 'Warm the sauce.', ingredientsUsed: ['tomato sauce'], toolsUsed: ['skillet'] },
      { title: 'Toss', text: 'Toss pasta, mushrooms, and sauce.', ingredientsUsed: ['pasta', 'sliced mushrooms', 'tomato sauce'], toolsUsed: ['skillet'] },
    ],
    nutritionEstimate: { calories: 445, proteinGrams: 16, carbohydratesGrams: 79, fatGrams: 7 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(pasta, mushroomPasta, parseCorrectionIntent('Add mushrooms')),
    [],
  );

  const soup = makeRecipe({
    id: 'soup',
    title: 'Creamy Vegetable Soup',
    description: 'A rich blended vegetable soup.',
    ingredients: [
      { name: 'mixed vegetables', quantity: '4 cups' },
      { name: 'heavy cream', quantity: '1 cup' },
      { name: 'stock', quantity: '3 cups' },
    ],
    steps: ['Simmer the vegetables in stock.', 'Stir in heavy cream.', 'Blend until smooth.'],
    structuredSteps: [
      { title: 'Simmer', text: 'Simmer the vegetables in stock.', ingredientsUsed: ['mixed vegetables', 'stock'], toolsUsed: ['pot'] },
      { title: 'Finish', text: 'Stir in heavy cream.', ingredientsUsed: ['heavy cream'], toolsUsed: ['pot'] },
      { title: 'Blend', text: 'Blend until smooth.', ingredientsUsed: [], toolsUsed: ['blender'] },
    ],
  });
  const dairyFreeSoup = makeRecipe({
    ...soup,
    title: 'Dairy-Free Creamy Vegetable Soup',
    description: 'A dairy-free blended vegetable soup.',
    ingredients: [
      { name: 'mixed vegetables', quantity: '4 cups' },
      { name: 'oat cream', quantity: '1 cup' },
      { name: 'stock', quantity: '3 cups' },
    ],
    steps: ['Simmer the vegetables in stock.', 'Stir in oat cream.', 'Blend until smooth.'],
    structuredSteps: [
      { title: 'Simmer', text: 'Simmer the vegetables in stock.', ingredientsUsed: ['mixed vegetables', 'stock'], toolsUsed: ['pot'] },
      { title: 'Finish', text: 'Stir in oat cream.', ingredientsUsed: ['oat cream'], toolsUsed: ['pot'] },
      { title: 'Blend', text: 'Blend until smooth.', ingredientsUsed: [], toolsUsed: ['blender'] },
    ],
    nutritionEstimate: { calories: 330, proteinGrams: 8, carbohydratesGrams: 42, fatGrams: 14 },
  });
  assert.equal(parseCorrectionIntent('Make a soup dairy-free').type, 'dietary_restriction');
  assert.deepEqual(
    validateCorrectedRecipe(soup, dairyFreeSoup, parseCorrectionIntent('Make a soup dairy-free')),
    [],
  );

  const dessert = makeRecipe({
    id: 'dessert',
    title: 'Fruit Crumble',
    description: 'A warm baked fruit dessert.',
    ingredients: [
      { name: 'mixed fruit', quantity: '4 cups' },
      { name: 'sugar', quantity: '1 cup' },
      { name: 'oat topping', quantity: '2 cups' },
    ],
    steps: ['Mix the fruit with sugar.', 'Add the oat topping.', 'Bake until golden.'],
    structuredSteps: [
      { title: 'Mix', text: 'Mix the fruit with sugar.', ingredientsUsed: ['mixed fruit', 'sugar'], toolsUsed: ['bowl'] },
      { title: 'Top', text: 'Add the oat topping.', ingredientsUsed: ['oat topping'], toolsUsed: ['baking dish'] },
      { title: 'Bake', text: 'Bake until golden.', ingredientsUsed: [], toolsUsed: ['oven'] },
    ],
  });
  const lessSweetDessert = makeRecipe({
    ...dessert,
    description: 'A warm baked fruit dessert with restrained sweetness.',
    ingredients: [
      { name: 'mixed fruit', quantity: '4 cups' },
      { name: 'sugar', quantity: '1/2 cup' },
      { name: 'oat topping', quantity: '2 cups' },
    ],
    steps: ['Mix the fruit with half the sugar.', 'Add the oat topping.', 'Bake until golden.'],
    structuredSteps: [
      { title: 'Mix', text: 'Mix the fruit with half the sugar.', ingredientsUsed: ['mixed fruit', 'sugar'], toolsUsed: ['bowl'] },
      { title: 'Top', text: 'Add the oat topping.', ingredientsUsed: ['oat topping'], toolsUsed: ['baking dish'] },
      { title: 'Bake', text: 'Bake until golden.', ingredientsUsed: [], toolsUsed: ['oven'] },
    ],
    nutritionEstimate: { calories: 350, proteinGrams: 6, carbohydratesGrams: 62, fatGrams: 10 },
  });
  assert.equal(parseCorrectionIntent('Make it less sweet').type, 'sensory_adjustment');
  assert.deepEqual(
    validateCorrectedRecipe(dessert, lessSweetDessert, parseCorrectionIntent('Make it less sweet')),
    [],
  );
});

test('abstract additions validate provider-selected concrete outcomes instead of literal request phrases', () => {
  const latestNoodles = makeRecipe({
    id: 'latest-noodles',
    title: 'Soy Sauce Noodles with Beef',
    description: 'Savory noodles with seared beef.',
    ingredients: [
      { name: 'wheat noodles', quantity: '8 oz' },
      { name: 'sliced beef', quantity: '8 oz' },
      { name: 'soy sauce', quantity: '3 tbsp' },
    ],
    steps: ['Cook the noodles.', 'Sear the beef.', 'Toss the noodles and beef with soy sauce.'],
    structuredSteps: [
      { title: 'Cook', text: 'Cook the noodles.', ingredientsUsed: ['wheat noodles'], toolsUsed: ['pot'] },
      { title: 'Sear', text: 'Sear the beef.', ingredientsUsed: ['sliced beef'], toolsUsed: ['skillet'] },
      { title: 'Toss', text: 'Toss the noodles and beef with soy sauce.', ingredientsUsed: ['wheat noodles', 'sliced beef', 'soy sauce'], toolsUsed: ['skillet'] },
    ],
    nutritionEstimate: { calories: 485, proteinGrams: 30, carbohydratesGrams: 57, fatGrams: 15 },
  });
  const spicyNoodles = makeRecipe({
    ...latestNoodles,
    id: 'spicy-noodles',
    description: 'Spicy soy sauce noodles with seared beef.',
    ingredients: [...latestNoodles.ingredients, { name: 'chili crisp', quantity: '1 tbsp' }],
    steps: ['Cook the noodles.', 'Sear the beef.', 'Toss the noodles and beef with soy sauce and chili crisp.'],
    structuredSteps: [
      { title: 'Cook', text: 'Cook the noodles.', ingredientsUsed: ['wheat noodles'], toolsUsed: ['pot'] },
      { title: 'Sear', text: 'Sear the beef.', ingredientsUsed: ['sliced beef'], toolsUsed: ['skillet'] },
      { title: 'Toss', text: 'Toss the noodles and beef with soy sauce and chili crisp for a spicy finish.', ingredientsUsed: ['wheat noodles', 'sliced beef', 'soy sauce', 'chili crisp'], toolsUsed: ['skillet'] },
    ],
    nutritionEstimate: { calories: 525, proteinGrams: 30, carbohydratesGrams: 59, fatGrams: 18 },
  });
  const spicyIntent = parseCorrectionIntent('Add a spicy ingredient');
  assert.deepEqual(validateCorrectedRecipe(latestNoodles, spicyNoodles, spicyIntent), []);
  assert.ok(spicyNoodles.ingredients.every((ingredient) => ingredient.name !== 'spicy ingredient'));
  assert.ok(spicyNoodles.ingredients.some((ingredient) => ingredient.name.includes('beef')));
  assert.ok(spicyNoodles.ingredients.some((ingredient) => ingredient.name.includes('noodles')));
  const literalPlaceholder = makeRecipe({
    ...spicyNoodles,
    id: 'literal-placeholder',
    ingredients: [...latestNoodles.ingredients, { name: 'spicy ingredient', quantity: '1 tbsp' }],
    steps: ['Cook the noodles.', 'Sear the beef.', 'Add the spicy ingredient.'],
    structuredSteps: [
      ...(latestNoodles.structuredSteps ?? []),
      { title: 'Add', text: 'Add the spicy ingredient.', ingredientsUsed: ['spicy ingredient'], toolsUsed: ['skillet'] },
    ],
  });
  assert.ok(
    validateCorrectedRecipe(latestNoodles, literalPlaceholder, spicyIntent)
      .some((issue) => issue.includes('No concrete ingredient')),
  );

  const soup = makeRecipe({
    id: 'soup-base',
    title: 'Roasted Vegetable Soup',
    description: 'A smooth roasted vegetable soup.',
    ingredients: [
      { name: 'roasted vegetables', quantity: '4 cups' },
      { name: 'stock', quantity: '3 cups' },
    ],
    steps: ['Simmer the vegetables in stock.', 'Blend until smooth.'],
    structuredSteps: [
      { title: 'Simmer', text: 'Simmer the vegetables in stock.', ingredientsUsed: ['roasted vegetables', 'stock'], toolsUsed: ['pot'] },
      { title: 'Blend', text: 'Blend until smooth.', ingredientsUsed: ['roasted vegetables'], toolsUsed: ['blender'] },
    ],
    nutritionEstimate: { calories: 220, proteinGrams: 6, carbohydratesGrams: 36, fatGrams: 6 },
  });
  const crunchySoup = makeRecipe({
    ...soup,
    id: 'crunchy-soup',
    description: 'Smooth roasted vegetable soup with a crunchy finish.',
    ingredients: [...soup.ingredients, { name: 'toasted croutons', quantity: '1 cup' }],
    steps: ['Simmer the vegetables in stock.', 'Blend until smooth.', 'Top with toasted croutons for crunch.'],
    structuredSteps: [
      ...(soup.structuredSteps ?? []),
      { title: 'Finish', text: 'Top with toasted croutons for crunch.', ingredientsUsed: ['toasted croutons'], toolsUsed: ['bowls'] },
    ],
    nutritionEstimate: { calories: 310, proteinGrams: 9, carbohydratesGrams: 52, fatGrams: 8 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(soup, crunchySoup, parseCorrectionIntent('Add something crunchy to a soup')),
    [],
  );

  const rice = makeRecipe({
    id: 'rice-base',
    title: 'Ginger Rice',
    description: 'Fragrant ginger rice.',
    ingredients: [
      { name: 'rice', quantity: '2 cups' },
      { name: 'ginger', quantity: '1 tbsp' },
      { name: 'stock', quantity: '3 cups' },
    ],
    steps: ['Simmer the rice with ginger and stock.', 'Rest before serving.'],
    structuredSteps: [
      { title: 'Simmer', text: 'Simmer the rice with ginger and stock.', ingredientsUsed: ['rice', 'ginger', 'stock'], toolsUsed: ['pot'] },
      { title: 'Rest', text: 'Rest before serving.', ingredientsUsed: ['rice'], toolsUsed: ['pot'] },
    ],
    nutritionEstimate: { calories: 330, proteinGrams: 7, carbohydratesGrams: 70, fatGrams: 2 },
  });
  const vegetableRice = makeRecipe({
    ...rice,
    id: 'vegetable-rice',
    description: 'Fragrant ginger rice with a green vegetable.',
    ingredients: [...rice.ingredients, { name: 'broccoli florets', quantity: '2 cups' }],
    steps: ['Simmer the rice with ginger and stock.', 'Steam the broccoli florets.', 'Fold the broccoli into the rice.'],
    structuredSteps: [
      { title: 'Simmer', text: 'Simmer the rice with ginger and stock.', ingredientsUsed: ['rice', 'ginger', 'stock'], toolsUsed: ['pot'] },
      { title: 'Steam', text: 'Steam the broccoli florets as the vegetable addition.', ingredientsUsed: ['broccoli florets'], toolsUsed: ['steamer'] },
      { title: 'Fold', text: 'Fold the broccoli into the rice.', ingredientsUsed: ['rice', 'broccoli florets'], toolsUsed: ['pot'] },
    ],
    nutritionEstimate: { calories: 370, proteinGrams: 11, carbohydratesGrams: 77, fatGrams: 2 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(rice, vegetableRice, parseCorrectionIntent('Add a vegetable to a rice dish')),
    [],
  );
});

test('sensory and nutrition goals validate relevant deltas across sauces, breakfasts, and desserts', () => {
  const sauce = makeRecipe({
    id: 'sauce-base',
    title: 'Herb Sauce',
    description: 'A smooth green herb sauce.',
    ingredients: [
      { name: 'fresh herbs', quantity: '2 cups' },
      { name: 'olive oil', quantity: '1/2 cup' },
    ],
    steps: ['Blend the herbs and olive oil.'],
    structuredSteps: [
      { title: 'Blend', text: 'Blend the herbs and olive oil.', ingredientsUsed: ['fresh herbs', 'olive oil'], toolsUsed: ['blender'] },
    ],
    nutritionEstimate: { calories: 180, proteinGrams: 2, carbohydratesGrams: 3, fatGrams: 18 },
  });
  const acidicSauce = makeRecipe({
    ...sauce,
    id: 'acidic-sauce',
    description: 'A smooth green herb sauce with brighter acidity.',
    ingredients: [...sauce.ingredients, { name: 'lemon juice', quantity: '2 tbsp' }],
    steps: ['Blend the herbs and olive oil.', 'Blend in lemon juice for a more acidic finish.'],
    structuredSteps: [
      { title: 'Blend', text: 'Blend the herbs and olive oil.', ingredientsUsed: ['fresh herbs', 'olive oil'], toolsUsed: ['blender'] },
      { title: 'Brighten', text: 'Blend in lemon juice for a more acidic finish.', ingredientsUsed: ['lemon juice'], toolsUsed: ['blender'] },
    ],
    nutritionEstimate: { calories: 185, proteinGrams: 2, carbohydratesGrams: 4, fatGrams: 18 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(sauce, acidicSauce, parseCorrectionIntent('Make a sauce more acidic')),
    [],
  );

  const breakfast = makeRecipe({
    id: 'breakfast-base',
    title: 'Breakfast Toast',
    description: 'Toast with fruit.',
    ingredients: [
      { name: 'whole grain bread', quantity: '2 slices' },
      { name: 'fresh fruit', quantity: '1 cup' },
    ],
    steps: ['Toast the bread.', 'Top with fresh fruit.'],
    structuredSteps: [
      { title: 'Toast', text: 'Toast the bread.', ingredientsUsed: ['whole grain bread'], toolsUsed: ['toaster'] },
      { title: 'Top', text: 'Top with fresh fruit.', ingredientsUsed: ['fresh fruit'], toolsUsed: ['plate'] },
    ],
    nutritionEstimate: { calories: 300, proteinGrams: 8, carbohydratesGrams: 60, fatGrams: 4, fiberGrams: 7 },
  });
  const proteinBreakfast = makeRecipe({
    ...breakfast,
    id: 'protein-breakfast',
    description: 'Toast with fruit and a higher-protein topping.',
    ingredients: [...breakfast.ingredients, { name: 'Greek yogurt', quantity: '1 cup' }],
    steps: ['Toast the bread.', 'Top with fresh fruit and Greek yogurt.'],
    structuredSteps: [
      { title: 'Toast', text: 'Toast the bread.', ingredientsUsed: ['whole grain bread'], toolsUsed: ['toaster'] },
      { title: 'Top', text: 'Top with fresh fruit and Greek yogurt.', ingredientsUsed: ['fresh fruit', 'Greek yogurt'], toolsUsed: ['plate'] },
    ],
    nutritionEstimate: { calories: 410, proteinGrams: 28, carbohydratesGrams: 68, fatGrams: 5, fiberGrams: 7 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(breakfast, proteinBreakfast, parseCorrectionIntent('Add more protein')),
    [],
  );
  assert.deepEqual(
    validateCorrectedRecipe(breakfast, proteinBreakfast, parseCorrectionIntent('Make it have more protien')),
    [],
  );
  const macroOnlyBreakfast = makeRecipe({
    ...breakfast,
    nutritionEstimate: proteinBreakfast.nutritionEstimate,
  });
  assert.ok(
    validateCorrectedRecipe(
      breakfast,
      macroOnlyBreakfast,
      parseCorrectionIntent('More protein please'),
    ).some((issue) => issue.includes('without changing ingredients or quantities')),
  );

  const dessert = makeRecipe({
    id: 'sweet-dessert',
    title: 'Baked Fruit',
    description: 'Warm baked fruit with a sweet glaze.',
    ingredients: [
      { name: 'mixed fruit', quantity: '4 cups' },
      { name: 'sugar', quantity: '1 cup' },
    ],
    steps: ['Toss the fruit with sugar.', 'Bake until tender.'],
    structuredSteps: [
      { title: 'Mix', text: 'Toss the fruit with sugar.', ingredientsUsed: ['mixed fruit', 'sugar'], toolsUsed: ['bowl'] },
      { title: 'Bake', text: 'Bake until tender.', ingredientsUsed: ['mixed fruit'], toolsUsed: ['oven'] },
    ],
    nutritionEstimate: { calories: 360, proteinGrams: 3, carbohydratesGrams: 82, fatGrams: 2 },
  });
  const lessSweetDessert = makeRecipe({
    ...dessert,
    id: 'less-sweet-dessert',
    description: 'Warm baked fruit with restrained sweetness.',
    ingredients: [
      { name: 'mixed fruit', quantity: '4 cups' },
      { name: 'sugar', quantity: '1/2 cup' },
    ],
    steps: ['Toss the fruit with less sugar for a less sweet glaze.', 'Bake until tender.'],
    structuredSteps: [
      { title: 'Mix', text: 'Toss the fruit with less sugar for a less sweet glaze.', ingredientsUsed: ['mixed fruit', 'sugar'], toolsUsed: ['bowl'] },
      { title: 'Bake', text: 'Bake until tender.', ingredientsUsed: ['mixed fruit'], toolsUsed: ['oven'] },
    ],
    nutritionEstimate: { calories: 260, proteinGrams: 3, carbohydratesGrams: 57, fatGrams: 2 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(dessert, lessSweetDessert, parseCorrectionIntent('Make a dessert less sweet')),
    [],
  );
  assert.deepEqual(
    validateCorrectedRecipe(dessert, lessSweetDessert, parseCorrectionIntent('Make it less sweeet')),
    [],
  );

  const grainDish = makeRecipe({
    id: 'grain-base',
    title: 'Herbed Grain Pilaf',
    description: 'A simple herbed grain pilaf.',
    ingredients: [
      { name: 'cooked grain', quantity: '3 cups' },
      { name: 'stock', quantity: '1 cup' },
      { name: 'fresh herbs', quantity: '1/2 cup' },
    ],
    steps: ['Warm the grain with stock.', 'Fold in the fresh herbs.'],
    structuredSteps: [
      { title: 'Warm', text: 'Warm the grain with stock.', ingredientsUsed: ['cooked grain', 'stock'], toolsUsed: ['pot'] },
      { title: 'Finish', text: 'Fold in the fresh herbs.', ingredientsUsed: ['fresh herbs'], toolsUsed: ['pot'] },
    ],
    nutritionEstimate: { calories: 320, proteinGrams: 7, carbohydratesGrams: 64, fatGrams: 4, fiberGrams: 3 },
  });
  const higherFiberGrain = makeRecipe({
    ...grainDish,
    description: 'An herbed grain pilaf with more fiber.',
    ingredients: [...grainDish.ingredients, { name: 'cooked lentils', quantity: '1 cup' }],
    steps: ['Warm the grain and cooked lentils with stock.', 'Fold in the fresh herbs.'],
    structuredSteps: [
      { title: 'Warm', text: 'Warm the grain and cooked lentils with stock for more fiber.', ingredientsUsed: ['cooked grain', 'cooked lentils', 'stock'], toolsUsed: ['pot'] },
      { title: 'Finish', text: 'Fold in the fresh herbs.', ingredientsUsed: ['fresh herbs'], toolsUsed: ['pot'] },
    ],
    nutritionEstimate: { calories: 410, proteinGrams: 17, carbohydratesGrams: 74, fatGrams: 5, fiberGrams: 12 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(grainDish, higherFiberGrain, parseCorrectionIntent('Increase the fiber')),
    [],
  );

  const snack = makeRecipe({
    id: 'snack-base',
    title: 'Savory Snack Mix',
    description: 'A crisp seasoned snack.',
    ingredients: [
      { name: 'whole grain cereal', quantity: '2 cups' },
      { name: 'seasoning blend', quantity: '2 tbsp' },
      { name: 'oil', quantity: '2 tbsp' },
    ],
    steps: ['Toss the cereal with seasoning and oil.', 'Bake until crisp.'],
    structuredSteps: [
      { title: 'Mix', text: 'Toss the cereal with seasoning and oil.', ingredientsUsed: ['whole grain cereal', 'seasoning blend', 'oil'], toolsUsed: ['bowl'] },
      { title: 'Bake', text: 'Bake until crisp.', ingredientsUsed: ['whole grain cereal'], toolsUsed: ['oven'] },
    ],
    nutritionEstimate: { calories: 300, proteinGrams: 8, carbohydratesGrams: 40, fatGrams: 12 },
  });
  const lighterSnack = makeRecipe({
    ...snack,
    description: 'A lighter crisp seasoned snack.',
    ingredients: [
      { name: 'whole grain cereal', quantity: '2 cups' },
      { name: 'seasoning blend', quantity: '2 tbsp' },
      { name: 'oil', quantity: '1 tbsp' },
    ],
    steps: ['Toss the cereal with seasoning and less oil for a lighter coating.', 'Bake until crisp.'],
    structuredSteps: [
      { title: 'Mix', text: 'Toss the cereal with seasoning and less oil for a lighter coating.', ingredientsUsed: ['whole grain cereal', 'seasoning blend', 'oil'], toolsUsed: ['bowl'] },
      { title: 'Bake', text: 'Bake until crisp.', ingredientsUsed: ['whole grain cereal'], toolsUsed: ['oven'] },
    ],
    nutritionEstimate: { calories: 210, proteinGrams: 6, carbohydratesGrams: 32, fatGrams: 6 },
  });
  assert.deepEqual(
    validateCorrectedRecipe(snack, lighterSnack, parseCorrectionIntent('Make this snack lighter')),
    [],
  );
});

test('nutrition goals reject weak, macro-only, and ingredient-only responses and accept meaningful recipe deltas', () => {
  const original = makeRecipe({
    id: 'nutrition-base',
    title: 'Savory Grain Bowl',
    description: 'A simple savory grain bowl.',
    ingredients: [
      { name: 'cooked grain', quantity: '2 cups' },
      { name: 'roasted vegetables', quantity: '1 cup' },
    ],
    steps: ['Warm the cooked grain.', 'Fold in the roasted vegetables.'],
    structuredSteps: [
      { title: 'Warm', text: 'Warm the cooked grain.', ingredientsUsed: ['cooked grain'], toolsUsed: ['pot'] },
      { title: 'Finish', text: 'Fold in the roasted vegetables.', ingredientsUsed: ['roasted vegetables'], toolsUsed: ['pot'] },
    ],
    nutritionEstimate: {
      calories: 150,
      proteinGrams: 2,
      carbohydratesGrams: 20,
      fatGrams: 8,
      fiberGrams: 1,
    },
  });
  const weakProtein = makeRecipe({
    ...original,
    ingredients: [...original.ingredients, { name: 'savory topping', quantity: '2 tbsp' }],
    steps: [...original.steps, 'Fold in the savory topping.'],
    structuredSteps: [
      ...(original.structuredSteps ?? []),
      { title: 'Top', text: 'Fold in the savory topping.', ingredientsUsed: ['savory topping'], toolsUsed: ['spoon'] },
    ],
    nutritionEstimate: {
      calories: 180,
      proteinGrams: 4,
      carbohydratesGrams: 20,
      fatGrams: 9,
      fiberGrams: 1,
    },
  });
  assert.ok(
    validateCorrectedRecipe(original, weakProtein, parseCorrectionIntent('Add more protein'))
      .some((issue) => issue.includes('required meaningful change')),
  );

  const meaningfulProtein = makeRecipe({
    ...weakProtein,
    nutritionEstimate: {
      calories: 190,
      proteinGrams: 6,
      carbohydratesGrams: 20,
      fatGrams: 9,
      fiberGrams: 1,
    },
  });
  assert.deepEqual(
    validateCorrectedRecipe(original, meaningfulProtein, parseCorrectionIntent('Add more protein')),
    [],
  );

  const macroOnly = makeRecipe({
    ...original,
    nutritionEstimate: meaningfulProtein.nutritionEstimate,
  });
  assert.ok(
    validateCorrectedRecipe(original, macroOnly, parseCorrectionIntent('Increase protein'))
      .some((issue) => issue.includes('without changing ingredients or quantities')),
  );

  const ingredientOnly = makeRecipe({
    ...meaningfulProtein,
    nutritionEstimate: original.nutritionEstimate,
  });
  assert.ok(
    validateCorrectedRecipe(original, ingredientOnly, parseCorrectionIntent('More protein please'))
      .some((issue) => issue.includes('required meaningful change')),
  );
});

test('fat, carbohydrate, fiber, and calorie goals apply their generic meaningful thresholds', () => {
  const base = makeRecipe({
    id: 'nutrition-direction-base',
    title: 'Mixed Plate',
    description: 'A balanced mixed plate.',
    ingredients: [
      { name: 'cooked grain', quantity: '2 cups' },
      { name: 'dressing', quantity: '3 tbsp' },
    ],
    steps: ['Warm the cooked grain.', 'Coat it with the dressing.'],
    structuredSteps: [
      { title: 'Warm', text: 'Warm the cooked grain.', ingredientsUsed: ['cooked grain'], toolsUsed: ['pan'] },
      { title: 'Dress', text: 'Coat it with the dressing.', ingredientsUsed: ['dressing'], toolsUsed: ['spoon'] },
    ],
    nutritionEstimate: {
      calories: 400,
      proteinGrams: 20,
      carbohydratesGrams: 60,
      fatGrams: 9,
      fiberGrams: 2,
    },
  });
  const makeCandidate = (
    quantity: string,
    step: string,
    nutritionEstimate: NonNullable<Recipe['nutritionEstimate']>,
  ) => makeRecipe({
    ...base,
    ingredients: [
      base.ingredients[0],
      { name: 'dressing', quantity },
    ],
    steps: [base.steps[0], step],
    structuredSteps: [
      base.structuredSteps![0],
      { title: 'Dress', text: step, ingredientsUsed: ['dressing'], toolsUsed: ['spoon'] },
    ],
    nutritionEstimate,
  });

  assert.deepEqual(validateCorrectedRecipe(
    base,
    makeCandidate('1 tbsp', 'Coat it with the reduced dressing.', {
      calories: 340, proteinGrams: 20, carbohydratesGrams: 55, fatGrams: 6, fiberGrams: 2,
    }),
    parseCorrectionIntent('Reduce the fat'),
  ), []);
  assert.deepEqual(validateCorrectedRecipe(
    base,
    makeCandidate('2 tbsp', 'Coat it with the lower-carbohydrate dressing.', {
      calories: 365, proteinGrams: 20, carbohydratesGrams: 54, fatGrams: 9, fiberGrams: 2,
    }),
    parseCorrectionIntent('Reduce carbohydrates'),
  ), []);
  assert.deepEqual(validateCorrectedRecipe(
    base,
    makeCandidate('4 tbsp', 'Coat it with the higher-fiber dressing.', {
      calories: 410, proteinGrams: 20, carbohydratesGrams: 60, fatGrams: 9, fiberGrams: 5,
    }),
    parseCorrectionIntent('Increase fiber'),
  ), []);
  assert.deepEqual(validateCorrectedRecipe(
    base,
    makeCandidate('1 tbsp', 'Coat it with the lighter dressing.', {
      calories: 350, proteinGrams: 20, carbohydratesGrams: 52, fatGrams: 7, fiberGrams: 2,
    }),
    parseCorrectionIntent('Reduce calories'),
  ), []);
});

test('sequential nutrition goals preserve the latest successful ingredient changes', () => {
  const original = makeRecipe({
    id: 'sequential-nutrition-base',
    title: 'Breakfast Bowl',
    description: 'A simple breakfast bowl.',
    ingredients: [
      { name: 'cooked oats', quantity: '1 cup' },
      { name: 'fruit', quantity: '1 cup' },
      { name: 'seed topping', quantity: '1 tbsp' },
    ],
    steps: ['Warm the cooked oats.', 'Top with fruit and seed topping.'],
    structuredSteps: [
      { title: 'Warm', text: 'Warm the cooked oats.', ingredientsUsed: ['cooked oats'], toolsUsed: ['pot'] },
      { title: 'Top', text: 'Top with fruit and seed topping.', ingredientsUsed: ['fruit', 'seed topping'], toolsUsed: ['bowl'] },
    ],
    nutritionEstimate: {
      calories: 300,
      proteinGrams: 8,
      carbohydratesGrams: 48,
      fatGrams: 8,
      fiberGrams: 6,
    },
  });
  const higherProtein = makeRecipe({
    ...original,
    ingredients: [...original.ingredients, { name: 'protein topping', quantity: '1/2 cup' }],
    steps: ['Warm the cooked oats.', 'Top with fruit, seed topping, and protein topping.'],
    structuredSteps: [
      original.structuredSteps![0],
      {
        title: 'Top',
        text: 'Top with fruit, seed topping, and protein topping.',
        ingredientsUsed: ['fruit', 'seed topping', 'protein topping'],
        toolsUsed: ['bowl'],
      },
    ],
    nutritionEstimate: {
      calories: 390,
      proteinGrams: 18,
      carbohydratesGrams: 53,
      fatGrams: 12,
      fiberGrams: 6,
    },
  });
  assert.deepEqual(
    validateCorrectedRecipe(original, higherProtein, parseCorrectionIntent('Add more protein')),
    [],
  );

  const lowerFat = makeRecipe({
    ...higherProtein,
    ingredients: higherProtein.ingredients.map((ingredient) =>
      ingredient.name === 'seed topping'
        ? { ...ingredient, quantity: '1 tsp' }
        : ingredient),
    steps: ['Warm the cooked oats.', 'Top with fruit, reduced seed topping, and protein topping.'],
    structuredSteps: [
      higherProtein.structuredSteps![0],
      {
        title: 'Top',
        text: 'Top with fruit, reduced seed topping, and protein topping.',
        ingredientsUsed: ['fruit', 'seed topping', 'protein topping'],
        toolsUsed: ['bowl'],
      },
    ],
    nutritionEstimate: {
      calories: 350,
      proteinGrams: 18,
      carbohydratesGrams: 53,
      fatGrams: 8,
      fiberGrams: 6,
    },
  });
  assert.deepEqual(
    validateCorrectedRecipe(higherProtein, lowerFat, parseCorrectionIntent('Make it have less fat')),
    [],
  );
  assert.ok(lowerFat.ingredients.some((ingredient) => ingredient.name === 'protein topping'));
  assert.match(lowerFat.steps.join(' '), /protein topping/);
});

test('cooking-method and uncertain free-text edits require relevant recipe deltas', () => {
  const original = makeRecipe({
    id: 'method-base',
    title: 'Savory Patties',
    description: 'Tender pan-cooked patties.',
    ingredients: [
      { name: 'patty mixture', quantity: '2 cups' },
      { name: 'oil', quantity: '1 tbsp' },
    ],
    steps: ['Shape the patties.', 'Cook the patties in a skillet until done.'],
    structuredSteps: [
      { title: 'Shape', text: 'Shape the patties.', ingredientsUsed: ['patty mixture'], toolsUsed: ['bowl'] },
      { title: 'Cook', text: 'Cook the patties in a skillet until done.', ingredientsUsed: ['patty mixture', 'oil'], toolsUsed: ['skillet'] },
    ],
    equipment: ['bowl', 'skillet'],
    nutritionEstimate: { calories: 310, proteinGrams: 17, carbohydratesGrams: 29, fatGrams: 14 },
  });
  const baked = makeRecipe({
    ...original,
    description: 'Tender oven-baked patties.',
    steps: ['Shape the patties.', 'Bake the patties until done.'],
    structuredSteps: [
      { title: 'Shape', text: 'Shape the patties.', ingredientsUsed: ['patty mixture'], toolsUsed: ['bowl'] },
      { title: 'Bake', text: 'Bake the patties until done.', ingredientsUsed: ['patty mixture'], toolsUsed: ['oven'] },
    ],
    equipment: ['bowl', 'oven', 'sheet pan'],
  });
  assert.deepEqual(
    validateCorrectedRecipe(original, baked, parseCorrectionIntent('Change the cooking method to baking')),
    [],
  );

  const aromatic = makeRecipe({
    ...original,
    description: 'Tender patties with an aromatic finish.',
    ingredients: [...original.ingredients, { name: 'fresh herb blend', quantity: '2 tbsp' }],
    steps: ['Shape the patties.', 'Cook the patties in a skillet until done.', 'Finish with the aromatic fresh herb blend.'],
    structuredSteps: [
      ...(original.structuredSteps ?? []),
      { title: 'Finish', text: 'Finish with the aromatic fresh herb blend.', ingredientsUsed: ['fresh herb blend'], toolsUsed: ['plate'] },
    ],
    nutritionEstimate: { calories: 315, proteinGrams: 17, carbohydratesGrams: 30, fatGrams: 14 },
  });
  const generalIntent = parseCorrectionIntent('Please make the finish more aromatic');
  assert.equal(generalIntent.type, 'general');
  assert.deepEqual(validateCorrectedRecipe(original, aromatic, generalIntent), []);

  const unrelated = makeRecipe({
    ...original,
    description: 'Tender patties that cook faster.',
    cookTimeMinutes: original.cookTimeMinutes - 2,
    totalTimeMinutes: (original.totalTimeMinutes ?? 20) - 2,
  });
  assert.ok(
    validateCorrectedRecipe(original, unrelated, generalIntent)
      .some((issue) => issue.includes('does not demonstrate')),
  );
});

test('compound correction parsing preserves ordered mandatory requirements and typo normalization', () => {
  const nutritionPlan = parseCorrectionRequirements('less fat and more protein');
  assert.deepEqual(
    nutritionPlan.requirements.map((requirement) => ({
      type: requirement.type,
      target: requirement.type === 'nutrition_goal'
        ? `${requirement.direction} ${requirement.nutrient}`
        : '',
    })),
    [
      { type: 'nutrition_goal', target: 'less fat' },
      { type: 'nutrition_goal', target: 'more protein' },
    ],
  );
  assert.ok(nutritionPlan.requirements.every(
    (requirement) => requirement.note === 'less fat and more protein',
  ));

  const typoPlan = parseCorrectionRequirements('fewer caleries and more protien');
  assert.deepEqual(
    typoPlan.requirements.map((requirement) =>
      requirement.type === 'nutrition_goal'
        ? `${requirement.direction} ${requirement.nutrient}`
        : requirement.type),
    ['less calorie', 'more protein'],
  );

  assert.deepEqual(
    parseCorrectionRequirements('remove onions and add mushrooms').requirements
      .map((requirement) => requirement.type),
    ['remove_ingredient', 'add_ingredient'],
  );
  assert.deepEqual(
    parseCorrectionRequirements('dairy-free and less sweet').requirements
      .map((requirement) => requirement.type),
    ['dietary_restriction', 'sensory_adjustment'],
  );
});

test('compound nutrition goals must each meet their meaningful target', () => {
  const original = makeRecipe({
    id: 'compound-nutrition-base',
    title: 'Baked Grain Dish',
    description: 'A warm baked grain dish.',
    ingredients: [
      { name: 'cooked grain', quantity: '2 cups' },
      { name: 'roasted vegetables', quantity: '1 cup' },
      { name: 'savory dressing', quantity: '3 tbsp' },
      { name: 'previously added garnish', quantity: '2 tbsp' },
    ],
    steps: [
      'Fold the roasted vegetables into the cooked grain.',
      'Coat with savory dressing and bake.',
    ],
    structuredSteps: [
      {
        title: 'Combine',
        text: 'Fold the roasted vegetables and previously added garnish into the cooked grain.',
        ingredientsUsed: ['cooked grain', 'roasted vegetables', 'previously added garnish'],
        toolsUsed: ['baking dish'],
      },
      {
        title: 'Bake',
        text: 'Coat with savory dressing and bake.',
        ingredientsUsed: ['savory dressing'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 260,
      proteinGrams: 3,
      carbohydratesGrams: 35,
      fatGrams: 12,
      fiberGrams: 3,
    },
  });
  const corrected = makeRecipe({
    ...original,
    ingredients: [
      original.ingredients[0],
      original.ingredients[1],
      { name: 'savory dressing', quantity: '1 tbsp' },
      original.ingredients[3],
      { name: 'protein-rich topping', quantity: '1/2 cup' },
    ],
    steps: [
      'Fold the roasted vegetables, previously added garnish, and protein-rich topping into the cooked grain.',
      'Coat with reduced savory dressing and bake.',
    ],
    structuredSteps: [
      {
        title: 'Combine',
        text: 'Fold the roasted vegetables, previously added garnish, and protein-rich topping into the cooked grain.',
        ingredientsUsed: [
          'cooked grain',
          'roasted vegetables',
          'previously added garnish',
          'protein-rich topping',
        ],
        toolsUsed: ['baking dish'],
      },
      {
        title: 'Bake',
        text: 'Coat with reduced savory dressing and bake.',
        ingredientsUsed: ['savory dressing'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 255,
      proteinGrams: 8,
      carbohydratesGrams: 35,
      fatGrams: 9,
      fiberGrams: 4,
    },
  });
  const plan = parseCorrectionRequirements('less fat and more protein');
  assert.deepEqual(validateCorrectedRecipe(original, corrected, plan.requirements), []);
  assert.ok(corrected.ingredients.some(
    (ingredient) => ingredient.name === 'previously added garnish',
  ));

  const partial = makeRecipe({
    ...corrected,
    nutritionEstimate: {
      ...corrected.nutritionEstimate!,
      calories: 238,
      proteinGrams: 4,
    },
  });
  const issues = validateCorrectedRecipe(original, partial, plan.requirements);
  assert.ok(issues.some((issue) =>
    issue.includes('Requirement 2 (nutrition_goal)') &&
    issue.includes('required meaningful change')));
  assert.ok(!issues.some((issue) =>
    issue.includes('Requirement 1 (nutrition_goal)') &&
    issue.includes('required meaningful change')));
});

test('compound calorie, fiber, dietary, sensory, remove, and add requirements coexist', () => {
  const original = makeRecipe({
    id: 'compound-mixed-base',
    title: 'Creamy Baked Dessert',
    description: 'A sweet creamy baked dessert.',
    ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'dairy cream', quantity: '1 cup' },
      { name: 'sugar', quantity: '1/2 cup' },
    ],
    steps: [
      'Mix the grain base with dairy cream and sugar.',
      'Bake the sweet mixture.',
    ],
    structuredSteps: [
      {
        title: 'Mix',
        text: 'Mix the grain base with dairy cream and sugar.',
        ingredientsUsed: ['grain base', 'dairy cream', 'sugar'],
        toolsUsed: ['bowl'],
      },
      {
        title: 'Bake',
        text: 'Bake the sweet mixture.',
        ingredientsUsed: ['grain base'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 328,
      proteinGrams: 7,
      carbohydratesGrams: 50,
      fatGrams: 11,
      fiberGrams: 2,
    },
  });
  const corrected = makeRecipe({
    ...original,
    title: 'Dairy-Free Creamy Baked Dessert',
    description: 'A less sweet, dairy-free creamy baked dessert.',
    ingredients: [
      original.ingredients[0],
      { name: 'plant cream', quantity: '1 cup' },
      { name: 'sugar', quantity: '1/4 cup' },
    ],
    steps: [
      'Mix the grain base with plant cream and reduced sugar.',
      'Bake the less sweet mixture.',
    ],
    structuredSteps: [
      {
        title: 'Mix',
        text: 'Mix the grain base with plant cream and reduced sugar.',
        ingredientsUsed: ['grain base', 'plant cream', 'sugar'],
        toolsUsed: ['bowl'],
      },
      {
        title: 'Bake',
        text: 'Bake the less sweet mixture.',
        ingredientsUsed: ['grain base'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 270,
      proteinGrams: 6,
      carbohydratesGrams: 39,
      fatGrams: 10,
      fiberGrams: 2,
    },
  });
  assert.deepEqual(
    validateCorrectedRecipe(
      original,
      corrected,
      parseCorrectionRequirements('dairy-free and less sweet').requirements,
    ),
    [],
  );

  const fewerCaloriesMoreFiber = makeRecipe({
    ...original,
    ingredients: [
      { name: 'grain base', quantity: '1 1/2 cups' },
      original.ingredients[1],
      original.ingredients[2],
      { name: 'fiber-rich topping', quantity: '1/2 cup' },
    ],
    steps: [
      'Mix the reduced grain base with dairy cream, sugar, and fiber-rich topping.',
      'Bake the mixture.',
    ],
    structuredSteps: [
      {
        title: 'Mix',
        text: 'Mix the reduced grain base with dairy cream, sugar, and fiber-rich topping.',
        ingredientsUsed: ['grain base', 'dairy cream', 'sugar', 'fiber-rich topping'],
        toolsUsed: ['bowl'],
      },
      {
        title: 'Bake',
        text: 'Bake the mixture.',
        ingredientsUsed: ['grain base'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 275,
      proteinGrams: 8,
      carbohydratesGrams: 42,
      fatGrams: 8,
      fiberGrams: 5,
    },
  });
  assert.deepEqual(
    validateCorrectedRecipe(
      original,
      fewerCaloriesMoreFiber,
      parseCorrectionRequirements('fewer calories and more fiber').requirements,
    ),
    [],
  );

  const swapped = makeRecipe({
    ...original,
    description: 'A creamy baked dessert with fresh fruit.',
    ingredients: [
      original.ingredients[0],
      original.ingredients[1],
      { name: 'fresh fruit', quantity: '1 cup' },
    ],
    steps: [
      'Mix the grain base with dairy cream and fresh fruit.',
      'Bake the mixture and finish with fresh fruit.',
    ],
    structuredSteps: [
      {
        title: 'Mix',
        text: 'Mix the grain base with dairy cream and fresh fruit.',
        ingredientsUsed: ['grain base', 'dairy cream', 'fresh fruit'],
        toolsUsed: ['bowl'],
      },
      {
        title: 'Bake',
        text: 'Bake the mixture and finish with fresh fruit.',
        ingredientsUsed: ['grain base', 'fresh fruit'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 280,
      proteinGrams: 7,
      carbohydratesGrams: 45,
      fatGrams: 8,
      fiberGrams: 4,
    },
  });
  assert.deepEqual(
    validateCorrectedRecipe(
      original,
      swapped,
      parseCorrectionRequirements('remove sugar and add fresh fruit').requirements,
    ),
    [],
  );
});

test('calories use a strict generic macro tolerance and coherent before-and-after deltas', () => {
  const insideTolerance = makeRecipe({
    nutritionEstimate: {
      calories: 210,
      proteinGrams: 18,
      carbohydratesGrams: 20,
      fatGrams: 8,
    },
  });
  const outsideTolerance = makeRecipe({
    nutritionEstimate: {
      calories: 200,
      proteinGrams: 18,
      carbohydratesGrams: 20,
      fatGrams: 8,
    },
  });
  assert.equal(getEstimatedCaloriesFromMacros(insideTolerance), 224);
  assert.ok(Math.abs(getCalorieMacroTolerance(224) - 22.4) < 0.001);
  assert.equal(isNutritionMacroConsistent(insideTolerance), true);
  assert.equal(isNutritionMacroConsistent(outsideTolerance), false);

  const original = makeRecipe({
    id: 'calorie-coherence-base',
    title: 'Savory Plate',
    description: 'A simple savory plate.',
    ingredients: [
      { name: 'grain base', quantity: '1 cup' },
      { name: 'seasoning', quantity: '1 tbsp' },
    ],
    steps: ['Warm the grain base.', 'Fold in the seasoning.'],
    structuredSteps: [
      {
        title: 'Warm',
        text: 'Warm the grain base.',
        ingredientsUsed: ['grain base'],
        toolsUsed: ['pan'],
      },
      {
        title: 'Season',
        text: 'Fold in the seasoning.',
        ingredientsUsed: ['seasoning'],
        toolsUsed: ['spoon'],
      },
    ],
    nutritionEstimate: {
      calories: 220,
      proteinGrams: 10,
      carbohydratesGrams: 27,
      fatGrams: 8,
      fiberGrams: 3,
    },
  });
  const implausiblyUnchangedCalories = makeRecipe({
    ...original,
    description: 'A savory plate with a substantial topping.',
    ingredients: [
      ...original.ingredients,
      { name: 'substantial topping', quantity: '1 cup' },
    ],
    steps: [
      ...original.steps,
      'Fold the substantial topping into the grain base.',
    ],
    structuredSteps: [
      ...(original.structuredSteps ?? []),
      {
        title: 'Top',
        text: 'Fold the substantial topping into the grain base.',
        ingredientsUsed: ['substantial topping', 'grain base'],
        toolsUsed: ['spoon'],
      },
    ],
    nutritionEstimate: {
      calories: 220,
      proteinGrams: 18,
      carbohydratesGrams: 35,
      fatGrams: 10,
      fiberGrams: 5,
    },
  });
  assert.ok(
    validateCorrectedRecipe(
      original,
      implausiblyUnchangedCalories,
      parseCorrectionIntent('Add a substantial topping'),
    ).some((issue) => issue.includes('calories conflict')),
  );

  const macroOnlyCalorieReduction = makeRecipe({
    ...original,
    nutritionEstimate: {
      calories: 175,
      proteinGrams: 10,
      carbohydratesGrams: 20,
      fatGrams: 6,
      fiberGrams: 3,
    },
  });
  assert.ok(
    validateCorrectedRecipe(
      original,
      macroOnlyCalorieReduction,
      parseCorrectionIntent('fewer calories'),
    ).some((issue) => issue.includes('without changing ingredients or quantities')),
  );
});

test('compound nutrition planning exposes exact targets and detailed candidate evidence', () => {
  const original = makeRecipe({
    id: 'exact-target-base',
    title: 'Layered Savory Bake',
    description: 'A layered savory bake.',
    ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'rich component', quantity: '1 cup' },
      { name: 'vegetable layer', quantity: '1 cup' },
    ],
    steps: [
      'Combine the grain base and rich component.',
      'Fold in the vegetable layer and bake.',
    ],
    structuredSteps: [
      {
        title: 'Combine',
        text: 'Combine the grain base and rich component.',
        ingredientsUsed: ['grain base', 'rich component'],
        toolsUsed: ['baking dish'],
      },
      {
        title: 'Bake',
        text: 'Fold in the vegetable layer and bake.',
        ingredientsUsed: ['vegetable layer'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 400,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 20,
      fiberGrams: 5,
    },
  });
  const intents = parseCorrectionRequirements(
    'Make it have less fat and more protein',
  ).requirements;
  assert.deepEqual(getNutritionRequirementTargets(original, intents), [
    {
      requirementIndex: 1,
      type: 'nutrition_goal',
      nutrient: 'fat',
      direction: 'less',
      originalValue: 20,
      targetValue: 17,
      targetMaximum: 17,
    },
    {
      requirementIndex: 2,
      type: 'nutrition_goal',
      nutrient: 'protein',
      direction: 'more',
      originalValue: 25,
      targetValue: 30,
      targetMinimum: 30,
    },
  ]);

  const partialCandidate = makeRecipe({
    ...original,
    ingredients: [
      original.ingredients[0],
      { name: 'rich component', quantity: '1/2 cup' },
      original.ingredients[2],
      { name: 'supporting component', quantity: '1/2 cup' },
    ],
    steps: [
      'Combine the grain base with reduced rich component.',
      'Fold in the vegetable layer and supporting component, then bake.',
    ],
    structuredSteps: [
      {
        title: 'Combine',
        text: 'Combine the grain base with reduced rich component.',
        ingredientsUsed: ['grain base', 'rich component'],
        toolsUsed: ['baking dish'],
      },
      {
        title: 'Bake',
        text: 'Fold in the vegetable layer and supporting component, then bake.',
        ingredientsUsed: ['vegetable layer', 'supporting component'],
        toolsUsed: ['oven'],
      },
    ],
    nutritionEstimate: {
      calories: 380,
      proteinGrams: 27,
      carbohydratesGrams: 30,
      fatGrams: 16,
      fiberGrams: 5,
    },
  });
  const evaluations = evaluateNutritionRequirements(
    original,
    partialCandidate,
    intents,
  );
  assert.equal(evaluations[0].numericTargetPassed, true);
  assert.equal(evaluations[0].candidateValue, 16);
  assert.equal(evaluations[1].numericTargetPassed, false);
  assert.equal(evaluations[1].candidateValue, 27);
  assert.equal(evaluations[1].targetMinimum, 30);
  assert.equal(evaluations[1].ingredientEvidencePassed, true);
  assert.equal(evaluations[1].stepEvidencePassed, true);
  assert.equal(evaluations[1].servingsStable, true);
  assert.ok(evaluations[1].issueCodes.includes('protein_target_not_met'));

  const missingStepCandidate = makeRecipe({
    ...partialCandidate,
    steps: original.steps,
    structuredSteps: original.structuredSteps,
    nutritionEstimate: {
      calories: 390,
      proteinGrams: 31,
      carbohydratesGrams: 30,
      fatGrams: 16,
      fiberGrams: 5,
    },
  });
  const missingStepEvaluation = evaluateNutritionRequirements(
    original,
    missingStepCandidate,
    intents,
  );
  assert.ok(missingStepEvaluation.every(
    (evaluation) =>
      evaluation.numericTargetPassed &&
      evaluation.ingredientEvidencePassed &&
      !evaluation.stepEvidencePassed &&
      evaluation.issueCodes.includes('nutrition_step_evidence_missing'),
  ));
});

test('valid compound macros reconcile contradictory displayed calories without weakening goals', () => {
  const original = makeRecipe({
    id: 'reconciliation-base',
    title: 'Savory Grain Plate',
    description: 'A savory grain plate.',
    ingredients: [
      { name: 'grain base', quantity: '2 cups' },
      { name: 'rich component', quantity: '1 cup' },
      { name: 'vegetable layer', quantity: '1 cup' },
    ],
    steps: [
      'Warm the grain base with the rich component.',
      'Fold in the vegetable layer.',
    ],
    structuredSteps: [
      {
        title: 'Warm',
        text: 'Warm the grain base with the rich component.',
        ingredientsUsed: ['grain base', 'rich component'],
        toolsUsed: ['pan'],
      },
      {
        title: 'Finish',
        text: 'Fold in the vegetable layer.',
        ingredientsUsed: ['vegetable layer'],
        toolsUsed: ['spoon'],
      },
    ],
    nutritionEstimate: {
      calories: 400,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 20,
      fiberGrams: 5,
    },
  });
  const intents = parseCorrectionRequirements('less fat and more protein').requirements;
  const candidate = makeRecipe({
    ...original,
    ingredients: [
      original.ingredients[0],
      { name: 'rich component', quantity: '1/2 cup' },
      original.ingredients[2],
      { name: 'supporting component', quantity: '1/2 cup' },
    ],
    steps: [
      'Warm the grain base with reduced rich component.',
      'Fold in the vegetable layer and supporting component.',
    ],
    structuredSteps: [
      {
        title: 'Warm',
        text: 'Warm the grain base with reduced rich component.',
        ingredientsUsed: ['grain base', 'rich component'],
        toolsUsed: ['pan'],
      },
      {
        title: 'Finish',
        text: 'Fold in the vegetable layer and supporting component.',
        ingredientsUsed: ['vegetable layer', 'supporting component'],
        toolsUsed: ['spoon'],
      },
    ],
    nutritionEstimate: {
      calories: 460,
      proteinGrams: 31,
      carbohydratesGrams: 30,
      fatGrams: 16,
      fiberGrams: 5,
    },
  });
  const assessment = assessAndReconcileCorrectionCandidate(
    original,
    candidate,
    intents,
  );
  assert.equal(assessment.caloriesReconciled, true);
  assert.equal(assessment.providerDisplayedCalories, 460);
  assert.equal(assessment.reconciledCalories, 390);
  assert.equal(assessment.recipe.nutritionEstimate?.calories, 390);
  assert.deepEqual(assessment.issues, []);
  assert.ok(assessment.providerRequirementEvaluations.every(
    (evaluation) =>
      evaluation.numericTargetPassed &&
      !evaluation.calorieConsistencyPassed,
  ));
  assert.ok(assessment.finalRequirementEvaluations.every(
    (evaluation) =>
      evaluation.numericTargetPassed &&
      evaluation.calorieConsistencyPassed,
  ));

  const calorieIntent = parseCorrectionRequirements('fewer calories').requirements;
  const falseReduction = makeRecipe({
    ...candidate,
    nutritionEstimate: {
      calories: 350,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 19,
      fiberGrams: 5,
    },
  });
  const calorieAssessment = assessAndReconcileCorrectionCandidate(
    original,
    falseReduction,
    calorieIntent,
  );
  assert.equal(calorieAssessment.caloriesReconciled, true);
  assert.ok(calorieAssessment.issues.length > 0);
  assert.equal(calorieAssessment.reconciledCalories, 390);
  assert.equal(
    calorieAssessment.finalRequirementEvaluations[0].numericTargetPassed,
    false,
  );
});

test('ingredient evidence recognizes a same-count formulation change for compound nutrition goals', () => {
  const original = makeIngredientEvidenceRecipe({
    formulationName: 'standard savory component',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the standard savory component with the grain base.',
    nutritionEstimate: {
      calories: 350,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 15,
      fiberGrams: 5,
    },
  });
  const candidate = makeIngredientEvidenceRecipe({
    formulationName: 'lean high-protein savory component',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the lean high-protein savory component with the grain base.',
    nutritionEstimate: {
      calories: 340,
      proteinGrams: 30,
      carbohydratesGrams: 30,
      fatGrams: 12,
      fiberGrams: 5,
    },
  });
  const intents = parseCorrectionRequirements('less fat and more protein').requirements;
  const manifest = [{
    beforeIngredient: 'standard savory component',
    afterIngredient: 'lean high-protein savory component',
    reason: 'Supports both requested nutrition goals.',
    supportsRequirementIndexes: [1, 2],
    affectedStepIndexes: [1],
  }];

  const assessment = assessAndReconcileCorrectionCandidate(
    original,
    candidate,
    intents,
    manifest,
  );

  assert.deepEqual(assessment.issues, []);
  assert.equal(original.ingredients.length, candidate.ingredients.length);
  assert.equal(assessment.ingredientChangeAnalysis.changes.length, 1);
  assert.equal(
    assessment.ingredientChangeAnalysis.changes[0].kind,
    'descriptor_changed',
  );
  assert.equal(
    assessment.ingredientChangeAnalysis.changes[0].referencedInSteps,
    true,
  );
  assert.deepEqual(
    assessment.ingredientChangeAnalysis.changes[0].affectedRequirementIndexes,
    [1, 2],
  );
  assert.ok(assessment.finalRequirementEvaluations.every(
    (evaluation) =>
      evaluation.numericTargetPassed &&
      evaluation.ingredientEvidencePassed &&
      evaluation.stepEvidencePassed,
  ));
});

test('ingredient evidence recognizes quantity changes and equivalent quantity formatting', () => {
  const original = makeIngredientEvidenceRecipe({
    formulationName: 'savory component',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the savory component with the grain base.',
    nutritionEstimate: {
      calories: 350,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 15,
    },
  });
  const candidate = makeIngredientEvidenceRecipe({
    formulationName: 'savory component',
    formulationQuantity: '3/4 cup',
    formulationStep: 'Cook three quarters cup of the savory component with the grain base.',
    nutritionEstimate: {
      calories: 325,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 12,
    },
  });
  const intent = parseCorrectionRequirements('less fat').requirements;
  const analysis = analyzeIngredientChanges(original, candidate, intent);

  assert.equal(analysis.changes.length, 1);
  assert.equal(analysis.changes[0].kind, 'quantity_changed');
  assert.equal(analysis.changes[0].referencedInSteps, true);
  assert.deepEqual(
    assessAndReconcileCorrectionCandidate(original, candidate, intent).issues,
    [],
  );

  const equivalent = makeIngredientEvidenceRecipe({
    formulationName: 'savory component',
    formulationQuantity: '0.5 cup',
    formulationStep: 'Cook the savory component with the grain base.',
    nutritionEstimate: original.nutritionEstimate!,
  });
  const equivalentFraction = makeIngredientEvidenceRecipe({
    formulationName: 'savory component',
    formulationQuantity: '½ cup',
    formulationStep: 'Cook the savory component with the grain base.',
    nutritionEstimate: original.nutritionEstimate!,
  });
  assert.deepEqual(
    analyzeIngredientChanges(equivalent, equivalentFraction, intent).changes,
    [],
  );
});

test('ingredient evidence recognizes a same-count replacement integrated into steps', () => {
  const original = makeIngredientEvidenceRecipe({
    formulationName: 'rich filling',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the rich filling with the grain base.',
    nutritionEstimate: {
      calories: 350,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 15,
    },
  });
  const candidate = makeIngredientEvidenceRecipe({
    formulationName: 'protein blend',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the protein blend with the grain base.',
    nutritionEstimate: {
      calories: 340,
      proteinGrams: 30,
      carbohydratesGrams: 30,
      fatGrams: 12,
    },
  });
  const intents = parseCorrectionRequirements('less fat and more protein').requirements;
  const analysis = analyzeIngredientChanges(original, candidate, intents);

  assert.equal(analysis.changes.length, 1);
  assert.equal(analysis.changes[0].kind, 'substituted');
  assert.equal(analysis.changes[0].referencedInSteps, true);
  assert.deepEqual(
    assessAndReconcileCorrectionCandidate(original, candidate, intents).issues,
    [],
  );
});

test('ingredient evidence classifies additions and removals without relying on list count', () => {
  const original = makeIngredientEvidenceRecipe({
    formulationName: 'savory component',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the savory component with the grain base.',
  });
  const added: Recipe = {
    ...original,
    ingredients: [
      ...original.ingredients,
      { name: 'crisp topping', quantity: '1/2 cup' },
    ],
    steps: [...original.steps, 'Finish with the crisp topping.'],
    structuredSteps: [
      ...(original.structuredSteps ?? []),
      {
        title: 'Finish',
        text: 'Finish with the crisp topping.',
        ingredientsUsed: ['crisp topping'],
        toolsUsed: ['spoon'],
      },
    ],
  };
  const removed: Recipe = {
    ...original,
    ingredients: original.ingredients.filter(
      (ingredient) => ingredient.name !== 'savory component',
    ),
    steps: ['Warm the grain base.', original.steps[1]],
    structuredSteps: [
      {
        title: 'Warm',
        text: 'Warm the grain base.',
        ingredientsUsed: ['grain base'],
        toolsUsed: ['pan'],
      },
      original.structuredSteps![1],
    ],
  };
  const intents = parseCorrectionRequirements('adjust the recipe').requirements;

  assert.equal(
    analyzeIngredientChanges(original, added, intents).changes.at(-1)?.kind,
    'added',
  );
  assert.equal(
    analyzeIngredientChanges(original, removed, intents).changes[0]?.kind,
    'removed',
  );
});

test('ingredient evidence ignores list reordering and preparation wording alone', () => {
  const original = makeIngredientEvidenceRecipe({
    formulationName: 'onion, chopped',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the chopped onion with the grain base.',
  });
  const reordered = {
    ...original,
    ingredients: [...original.ingredients].reverse(),
  };
  const preparationOnly = makeIngredientEvidenceRecipe({
    formulationName: 'chopped onions',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the chopped onions with the grain base.',
  });
  const intents = parseCorrectionRequirements('less fat').requirements;

  assert.deepEqual(
    analyzeIngredientChanges(original, reordered, intents).changes,
    [],
  );
  assert.deepEqual(
    analyzeIngredientChanges(original, preparationOnly, intents).changes,
    [],
  );
});

test('ingredient evidence rejects invented manifests and missing step integration', () => {
  const original = makeIngredientEvidenceRecipe({
    formulationName: 'standard savory component',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook the standard savory component with the grain base.',
    nutritionEstimate: {
      calories: 350,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 15,
    },
  });
  const candidate = makeIngredientEvidenceRecipe({
    formulationName: 'lean high-protein savory component',
    formulationQuantity: '1 cup',
    formulationStep: 'Cook only the grain base, then assemble the dish.',
    formulationIngredientsUsed: ['grain base'],
    nutritionEstimate: {
      calories: 340,
      proteinGrams: 30,
      carbohydratesGrams: 30,
      fatGrams: 12,
    },
  });
  const intents = parseCorrectionRequirements('less fat and more protein').requirements;
  const inventedManifest = [{
    beforeIngredient: 'missing original component',
    afterIngredient: 'missing corrected component',
    reason: 'Invented provider claim.',
    supportsRequirementIndexes: [1, 2],
    affectedStepIndexes: [1],
  }];
  const inventedAssessment = assessAndReconcileCorrectionCandidate(
    original,
    candidate,
    intents,
    inventedManifest,
  );

  assert.equal(
    inventedAssessment.ingredientChangeAnalysis.rejectedManifestChanges[0]?.reasonCode,
    'manifest_change_not_found',
  );
  assert.ok(inventedAssessment.issues.length > 0);

  const truthfulManifest = [{
    beforeIngredient: 'standard savory component',
    afterIngredient: 'lean high-protein savory component',
    reason: 'Supports both requested nutrition goals.',
    supportsRequirementIndexes: [1, 2],
    affectedStepIndexes: [1],
  }];
  const missingStepAssessment = assessAndReconcileCorrectionCandidate(
    original,
    candidate,
    intents,
    truthfulManifest,
  );
  assert.equal(
    missingStepAssessment.ingredientChangeAnalysis.rejectedManifestChanges[0]?.reasonCode,
    'manifest_step_reference_missing',
  );
  assert.ok(missingStepAssessment.finalRequirementEvaluations.every(
    (evaluation) =>
      evaluation.issueCodes.includes('nutrition_ingredient_change_missing') &&
      evaluation.issueCodes.includes('nutrition_step_evidence_missing'),
  ));
});

function makeIngredientEvidenceRecipe(options: {
  formulationName: string;
  formulationQuantity: string;
  formulationStep: string;
  formulationIngredientsUsed?: string[];
  nutritionEstimate?: NonNullable<Recipe['nutritionEstimate']>;
}): Recipe {
  const ingredients: RecipeIngredient[] = [
    { name: 'grain base', quantity: '2 cups' },
    { name: options.formulationName, quantity: options.formulationQuantity },
    { name: 'vegetable layer', quantity: '1 cup' },
    { name: 'seasoning blend', quantity: '1 tbsp' },
  ];
  const steps = [
    options.formulationStep,
    'Fold in the vegetable layer and seasoning blend.',
  ];
  return makeRecipe({
    id: 'generic-evidence-fixture',
    scanResultId: 'generic-evidence-scan',
    title: 'Savory Grain Plate',
    description: 'A composed savory grain plate.',
    ingredients,
    steps,
    structuredSteps: [
      {
        title: 'Cook',
        text: steps[0],
        ingredientsUsed: options.formulationIngredientsUsed ??
          ['grain base', options.formulationName],
        toolsUsed: ['pan'],
      },
      {
        title: 'Finish',
        text: steps[1],
        ingredientsUsed: ['vegetable layer', 'seasoning blend'],
        toolsUsed: ['spoon'],
      },
    ],
    nutritionEstimate: options.nutritionEstimate ?? {
      calories: 350,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 15,
      fiberGrams: 5,
    },
  });
}
