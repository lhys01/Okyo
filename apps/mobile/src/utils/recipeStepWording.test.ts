import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { getRecommendationById } from '../data/recommendedRecipes';
import { buildGuidedCookingSteps, getGuidedIngredientChipLabel } from './guidedCookingSteps';
import { normalizeRecipeStepTitle, normalizeRecipeStepWording } from './recipeStepWording';

const ingredients = [
  { name: 'beef', quantity: '8 oz' },
  { name: 'chicken', quantity: '1 lb' },
  { name: 'water', quantity: '250 ml' },
  { name: 'milk', quantity: '1 l' },
  { name: 'flour', quantity: '1 cup' },
  { name: 'salt', quantity: '2 tsp' },
  { name: 'eggs', quantity: '2 each' },
  { name: 'burger buns', quantity: '2 pieces' },
  { name: 'sauce', quantity: '1 jar' },
  { name: 'beans', quantity: '1 can' },
  { name: 'greens', quantity: '1 bunch' },
  { name: 'stock', quantity: '1 carton' },
  { name: 'spice mix', quantity: '1 package' },
  { name: 'snack', quantity: '1 item' },
  { name: 'cheese', quantity: '2 slices' },
  { name: 'oil', quantity: '1 tbsp' },
  { name: 'rice', quantity: '1 kg' },
  { name: 'sugar', quantity: '100 g' },
  { name: 'cream', quantity: '2 oz' },
  { name: 'juice', quantity: '1 cup' },
];

test('weight, volume, count, and container units yield ingredient-led instructions', () => {
  const cases: Array<[string, string]> = [
    ['Divide 8 oz beef into 2 loose balls.', 'Divide the beef into 2 loose balls.'],
    ['Add 1 ounce beef.', 'Add the beef.'],
    ['Add 1 lb chicken to the pan.', 'Add the chicken to the pan.'],
    ['Add 1 pound chicken to the pan.', 'Add the chicken to the pan.'],
    ['Add 100 g sugar.', 'Add the sugar.'],
    ['Add 100 grams sugar.', 'Add the sugar.'],
    ['Add 1 kilogram rice.', 'Add the rice.'],
    ['Pour 1 kg rice into a bowl.', 'Pour the rice into a bowl.'],
    ['Pour 250 ml water into the bowl.', 'Pour the water into the bowl.'],
    ['Pour 250 milliliters water into the bowl.', 'Pour the water into the bowl.'],
    ['Pour 1 l milk into a pitcher.', 'Pour the milk into a pitcher.'],
    ['Pour 1 liter milk into a pitcher.', 'Pour the milk into a pitcher.'],
    ['Season with 2 tsp salt.', 'Season with the salt.'],
    ['Season with 2 teaspoons salt.', 'Season with the salt.'],
    ['Add 1 tbsp oil.', 'Add the oil.'],
    ['Add 1 tablespoon oil.', 'Add the oil.'],
    ['Mix 1 cup flour until combined.', 'Mix in the flour until combined.'],
    ['Add 2 eggs.', 'Add the eggs.'],
    ['Add 2 each eggs.', 'Add the eggs.'],
    ['Add 1 item snack.', 'Add the snack.'],
    ['Place 2 pieces burger buns on a plate.', 'Place the burger buns on a plate.'],
    ['Add 1 item snack.', 'Add the snack.'],
    ['Add 2 slices cheese.', 'Add the cheese.'],
    ['Add 1 can beans.', 'Add the beans.'],
    ['Add 1 jar sauce.', 'Add the sauce.'],
    ['Add 1 bag spice mix.', 'Add the spice mix.'],
    ['Add 1 package spice mix.', 'Add the spice mix.'],
    ['Add 1 bunch greens.', 'Add the greens.'],
    ['Pour 1 carton stock into the pot.', 'Pour the stock into the pot.'],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeRecipeStepWording(input, ingredients), expected, input);
});

test('multi-ingredient actions name each ingredient and retain natural grammar', () => {
  assert.equal(
    normalizeRecipeStepWording('Mix 1 cup flour with 2 eggs.', ingredients),
    'Mix the flour with the eggs.',
  );
  assert.equal(
    normalizeRecipeStepWording('Add 2 tsp salt and 1 tbsp oil.', ingredients),
    'Add the salt and the oil.',
  );
});

test('measurement-based action titles use canonical ingredient names', () => {
  assert.equal(normalizeRecipeStepTitle('Divide Oz', 'Divide 8 oz beef into 2 balls.', ingredients), 'Divide Beef');
  assert.equal(normalizeRecipeStepTitle('Add Tbsp', 'Add 1 tbsp oil.', ingredients), 'Add Oil');
  assert.equal(normalizeRecipeStepTitle('Pour Ml', 'Pour 250 ml water into the bowl.', ingredients), 'Pour Water');
  assert.equal(normalizeRecipeStepTitle('Mix Cup', 'Mix 1 cup flour until combined.', ingredients), 'Mix Flour');
  assert.equal(normalizeRecipeStepTitle('Season Tsp', 'Season with 2 tsp salt.', ingredients), 'Season Salt');
});

test('missing and malformed ingredient names get safe copy without unit-only wording', () => {
  const noIngredients: Recipe['ingredients'] = [];
  assert.equal(normalizeRecipeStepWording('Add 2 tsp.', noIngredients), 'Add ingredients.');
  assert.equal(normalizeRecipeStepTitle('Add Tbsp', 'Add 2 tbsp.', noIngredients), 'Add Ingredients');
  assert.equal(normalizeRecipeStepWording('Mix 1 cup flour.', [{ name: 'Cup' }]), 'Continue mixing the ingredients.');
  assert.equal(getGuidedIngredientChipLabel({ name: 'Oz', quantity: '8 oz' }), '8 oz Ingredients');
});

test('generated, saved, customized, and serving-adjusted recipes normalize in the shared cooking builder', () => {
  const seed = getRecommendationById('rec-smash-cheeseburger');
  assert.ok(seed);
  const currentSmashStep = buildGuidedCookingSteps(seed)[0];
  assert.equal(currentSmashStep?.title, 'Divide Ground Beef');
  assert.equal(currentSmashStep?.instruction, 'Divide the ground beef into 2 loose balls — do not pack them tightly.');

  const generated = {
    ...seed,
    structuredSteps: [{ title: 'Divide Oz', text: 'Divide 8 oz beef into 2 loose balls.', ingredientsUsed: ['ground beef (80/20)'] }],
  } as Recipe;
  const generatedStep = buildGuidedCookingSteps(generated)[0];
  assert.equal(generatedStep?.title, 'Divide Ground Beef');
  assert.equal(generatedStep?.instruction, 'Divide the ground beef into 2 loose balls.');

  const savedReload = JSON.parse(JSON.stringify(generated)) as Recipe;
  assert.equal(buildGuidedCookingSteps(savedReload)[0]?.instruction, generatedStep?.instruction);

  const customized = {
    ...savedReload,
    ingredients: savedReload.ingredients.map((item) => item.name.includes('ground beef') ? { ...item, name: 'beef' } : item),
    structuredSteps: [{ title: 'Divide Oz', text: 'Divide 12 oz beef into 3 loose balls.', ingredientsUsed: ['beef'] }],
  };
  const changedServings = { ...customized, servings: 3, ingredients: customized.ingredients.map((item) => item.name === 'beef' ? { ...item, quantity: '12 oz' } : item) };
  const changedStep = buildGuidedCookingSteps(changedServings)[0];
  assert.equal(changedStep?.title, 'Divide Beef');
  assert.equal(changedStep?.instruction, 'Divide the beef into 3 loose balls.');
  assert.equal(getGuidedIngredientChipLabel(changedServings.ingredients[0]!), '12 oz beef');
});
