import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { shouldHideMainTabBar } from '../utils/mainTabBarPolicy';
import { getRecipeIngredientDisplayGroups } from '../utils/recipeIngredientPresentation';
import { scaleIngredient } from '../utils/servingScale';

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8');

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'scan-recipe-1',
    title: 'Pan-fried Dumplings',
    servings: 2,
    ingredients: [
      { name: 'grilled steak', quantity: '8 oz' },
      { name: 'cooked rice', quantity: '1 cup' },
      { name: 'soy sauce', quantity: '1 tbsp' },
    ],
    ingredientGroups: [
      { component: 'For the grilled steak', items: [{ name: 'grilled steak', quantity: '8 oz' }] },
      { component: 'For the cooked rice', items: [{ name: 'cooked rice', quantity: '1 cup' }] },
      { component: 'For the soy sauce', items: [{ name: 'soy sauce', quantity: '1 tbsp' }] },
      { component: 'Dipping sauce', items: [
        { name: 'rice vinegar', quantity: '2 tbsp' },
        { name: 'chili oil', quantity: '1 tsp' },
      ] },
    ],
    steps: [],
    equipment: [],
    nutritionEstimate: { calories: 400, protein: 20, carbs: 35, fat: 18 },
    ...overrides,
  } as Recipe;
}

test('focused recipe result and detail routes hide global tabs but normal tabs and completed cooking retain their contract', () => {
  assert.equal(shouldHideMainTabBar({ name: 'ResultSummaryScreen' }), true);
  assert.equal(shouldHideMainTabBar({ name: 'RecipeDetailScreen' }), true);
  assert.equal(shouldHideMainTabBar({ name: 'HomeScreen' }), false);
  assert.equal(shouldHideMainTabBar({ name: 'RecipeStepsScreen', params: { completion: false } }), true);
  assert.equal(shouldHideMainTabBar({ name: 'RecipeStepsScreen', params: { completion: true } }), false);
});

test('singleton ingredient components become one coherent list while meaningful multi-item categories remain', () => {
  const groups = getRecipeIngredientDisplayGroups(recipe());
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.component, '');
  assert.deepEqual(groups[0]?.items.map(({ name }) => name), ['grilled steak', 'cooked rice', 'soy sauce']);
  assert.equal(groups[1]?.component, 'Dipping sauce');
  assert.deepEqual(groups.flatMap(({ items }) => items.map(({ name, quantity }) => `${quantity} ${name}`)), [
    '8 oz grilled steak',
    '1 cup cooked rice',
    '1 tbsp soy sauce',
    '2 tbsp rice vinegar',
    '1 tsp chili oil',
  ]);
});

test('serving display keeps the selected serving count and scales displayed ingredient amounts', () => {
  const source = recipe().ingredients[0]!;
  assert.equal(scaleIngredient(source, 2, 4).quantity, '16 oz');
  const assistant = read('components/RecipeIngredientsAssistant.tsx');
  assert.match(assistant, /\{servings\} servings/);
  assert.match(assistant, /scaleIngredient\(source, recipe\.servings, servings\)/);
});

test('result keeps the exact scanned image reference and preserves saved recipe image rendering', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const detail = read('screens/RecipeDetailScreen.tsx');
  assert.match(result, /imageUri=\{selectedScanImageUri \?\? undefined\}/);
  assert.match(detail, /getRealScanImageUri\(recipe\.originalImage\)/);
  assert.match(detail, /imageSource=\{getRecipeImageSource\(recipe\)\}/);
});

test('fixed recipe timing fits one line while titles retain natural wrapping', () => {
  const quickFacts = read('components/RecipeAssistantOverview.tsx');
  const result = read('screens/ResultSummaryScreen.tsx');
  const detail = read('screens/RecipeDetailScreen.tsx');
  assert.match(quickFacts, /<FitText minimumFontScale=\{0\.62\} style=\{styles\.factValue\}>\{value\}<\/FitText>/);
  assert.match(quickFacts, /<FitText minimumFontScale=\{0\.76\} style=\{styles\.factLabel\}>\{label\}<\/FitText>/);
  assert.match(quickFacts, /fact: \{ flex: 1, minWidth: 0/);
  assert.match(quickFacts, /factValue: \{[^}]*fontSize: 16[^}]*lineHeight: 20/);
  assert.match(quickFacts, /factLabel: \{[^}]*fontSize: 13[^}]*lineHeight: 16/);
  assert.doesNotMatch(result, /numberOfLines=\{2\}[\s\S]{0,100}style=\{styles\.title\}/);
  assert.doesNotMatch(detail, /numberOfLines=\{1\}[\s\S]{0,100}style=\{styles\.recipeTitle\}/);
  assert.match(result, /\.\.\.typography\.hero/);
  assert.match(result, /\.\.\.typography\.body/);
  assert.doesNotMatch(quickFacts, /\.\.\.typography\.bodySmall/);
});

test('result and ingredient views remain scrollable with safe-area tail padding and scalable text', () => {
  const result = read('screens/ResultSummaryScreen.tsx');
  const detail = read('screens/RecipeDetailScreen.tsx');
  const ingredient = read('components/RecipeIngredientsAssistant.tsx');
  assert.match(result, /<ScrollView[\s\S]*?contentContainerStyle=\{\[styles\.screenContent, \{ paddingBottom: getRecipeScrollBottomPadding/);
  assert.match(detail, /<ScrollView[\s\S]*?contentContainerStyle=\{styles\.screenContent\}/);
  assert.match(detail, /paddingBottom: 24/);
  assert.match(ingredient, /\.\.\.typography\.section/);
  assert.match(ingredient, /\.\.\.typography\.bodySmall/);
  assert.doesNotMatch(ingredient, /allowFontScaling=\{false\}/);
});
