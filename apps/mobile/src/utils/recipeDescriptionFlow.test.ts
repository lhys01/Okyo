import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getStoredRecipeImageUri } from './recipeImageSource';
import { getRequiredRecipeEquipment } from './recipeEquipment';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(src, file), 'utf8');

test('text-described recipe retains its details and has no recipe or scan image', () => {
  const describedRecipe = {
    origin: 'description',
    title: 'Late-Night Ice Cream',
    description: 'A quick, creamy snack.',
    ingredients: [{ name: 'ice cream' }],
    equipment: ['spatula'],
    nutritionEstimate: { calories: 200 },
    steps: ['Scoop and serve.'],
    imageUri: 'file:///documents/okyo-scan-images/old-rice.jpg',
    originalImage: { uri: 'file:///documents/okyo-scan-images/old-rice.jpg' },
  };
  assert.equal(getStoredRecipeImageUri(describedRecipe), null);
  const store = read('state/useOkyoStore.ts');
  const canonical = read('state/canonicalRecipes.ts');
  const detail = read('screens/RecipeDetailScreen.tsx');
  assert.match(store, /scanSession\.source === 'description'[\s\S]{0,90}\? null/);
  assert.match(canonical, /const isDescription = input\.source === 'description'/);
  assert.match(canonical, /imageUri: imageUri/);
  assert.match(detail, /\{hasRecipeImage \? <FoodImage/);
  assert.match(detail, /fallbackLabel="Recipe image"/);
  assert.doesNotMatch(detail, /showFallbackLabel/);
  assert.match(detail, /hasRecipeImage/);
  assert.match(detail, /displayTitle/);
  assert.match(detail, /displayDescription/);
  assert.match(detail, /RecipeIngredientsAssistant[\s\S]{0,80}recipe=\{recipe\}/);
  assert.match(detail, /RecipeNutritionCards nutrition=\{recipe\.nutritionEstimate\}/);
  assert.match(detail, /getRequiredRecipeEquipment\(recipe\)/);
  assert.match(detail, /buildGuidedCookingSteps\(recipe\)/);
});

test('equipment includes required bowl, spatula, and ice cream machine without duplicates', () => {
  const equipment = getRequiredRecipeEquipment({
    equipment: ['spatula', 'bowl'],
    structuredSteps: [
      { toolsUsed: ['Bowl', 'ice cream machine'] },
      { toolsUsed: ['spatula', 'ice cream machine'] },
    ],
  });
  assert.deepEqual(equipment, ['spatula', 'bowl', 'ice cream machine']);
});

test('cooking Back returns to the originating recipe screen and keeps its recipe id', () => {
  const detail = read('screens/RecipeDetailScreen.tsx');
  const result = read('screens/ResultSummaryScreen.tsx');
  const back = detail.slice(detail.indexOf('const goBack = () => {', detail.indexOf('export function RecipeStepsScreen')));
  assert.match(detail, /returnTo: 'RecipeDetailScreen'/);
  assert.match(result, /returnTo: 'ResultSummaryScreen'/);
  assert.match(back, /const returnTo = route\.params\?\.returnTo \?\? 'RecipeDetailScreen'/);
  assert.match(back, /navigation\.navigate\('ResultSummaryScreen', \{ recipeId: routeRecipeId \}\)/);
  assert.match(back, /navigation\.navigate\('RecipeDetailScreen', \{ mode: selectedMode, recipeId: routeRecipeId \}\)/);
});

test('photo-scanned recipe retains its source image', () => {
  const photoRecipe = {
    origin: 'scan',
    imageUri: 'file:///documents/okyo-scan-images/ice-cream.jpg',
    originalImage: { uri: 'file:///documents/okyo-scan-images/ice-cream.jpg' },
  };
  assert.equal(getStoredRecipeImageUri(photoRecipe), photoRecipe.imageUri);
});

test('Recent dishes shows described recipes as text-only cards and keeps photo cards', () => {
  const recentCard = read('components/home/RecentDishCard.tsx');
  assert.match(recentCard, /const isDescription = recipe\.origin === 'description'/);
  assert.match(recentCard, /isDescription \? null : <FoodImage/);
  assert.match(recentCard, /isDescription \? \{ minHeight: height \} : \{ height \}/);
  assert.match(recentCard, /numberOfLines=\{isDescription \? undefined : 2\}/);
  assert.match(recentCard, /isDescription \? styles\.textOnlyMetaRow : null/);
});
