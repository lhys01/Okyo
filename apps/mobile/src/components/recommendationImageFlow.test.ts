import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('Home and category cards share one recipe-image resolver', () => {
  const home = read('src/screens/HomeScreen.tsx');
  const category = read('src/screens/RecommendationCategoryScreen.tsx');
  const card = read('src/components/RecommendationCard.tsx');

  assert.match(home, /<RecommendationCard[\s\S]*compact/);
  assert.match(category, /<RecommendationCard recipe=\{recipe\}/);
  assert.match(card, /getRecipeImageSource\(recipe\)/);
  assert.match(card, /getRecipeImageFallbackSource\(recipe\)/);
  assert.match(card, /imageAccessibilityLabel=\{`\$\{recipe\.title\} food image`\}/);
});

test('recipe-library asset lookup remains ID-specific with a bundled fallback', () => {
  const assets = read('assets/food/index.ts');

  assert.match(assets, /const normalizedId = recipeId\.trim\(\)\.replace\(\/\^rec-\//);
  assert.match(assets, /const asset = recipeAssets\[normalizedId\]/);
  assert.match(assets, /'greek-salad': require\('\.\/recipes\/greek-salad\.png'\)/);
  assert.match(assets, /'smash-cheeseburger': require\('\.\/recipes\/smash-cheeseburger\.png'\)/);
  assert.match(assets, /return foodAssets\.bowl/);
});

test('distinct recommendation keys keep distinct bundled food assets', () => {
  const assets = read('assets/food/index.ts');
  const salad = assets.match(/'greek-salad': require\('\.\/recipes\/([^']+)'\)/)?.[1];
  const burger = assets.match(/'smash-cheeseburger': require\('\.\/recipes\/([^']+)'\)/)?.[1];
  assert.ok(salad);
  assert.ok(burger);
  assert.notEqual(salad, burger);
});

test('recipe photos use the food-only fallback path without rewriting bundled assets', () => {
  const foodImage = read('src/components/FoodImage.tsx');

  assert.match(foodImage, /ResilientImage/);
  assert.match(foodImage, /assetKind="food"/);
  assert.match(foodImage, /fallbackSource \?\? foodAssets\.bowl/);
  assert.doesNotMatch(foodImage, /expo-file-system\/legacy/);
});
