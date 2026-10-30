import assert from 'node:assert/strict';
import test from 'node:test';

import { getStoredRecipeImageUri, isUserScanRecipe, normalizeRecipeImageUri } from './recipeImageSource';

test('recipe image URI normalization accepts supported local and remote sources', () => {
  assert.equal(normalizeRecipeImageUri(' https://cdn.example.com/food.jpg '), 'https://cdn.example.com/food.jpg');
  assert.equal(normalizeRecipeImageUri('file:///var/mobile/recipe.jpg'), 'file:///var/mobile/recipe.jpg');
  assert.equal(normalizeRecipeImageUri('content://media/external/images/1'), 'content://media/external/images/1');
});

test('recipe image URI normalization rejects blank and malformed values before Image renders', () => {
  assert.equal(normalizeRecipeImageUri(undefined), null);
  assert.equal(normalizeRecipeImageUri('  '), null);
  assert.equal(normalizeRecipeImageUri('undefined'), null);
  assert.equal(normalizeRecipeImageUri('recipe-photo.jpg'), null);
});

test('a scanned dumpling recipe always resolves its durable image before bundled library art', () => {
  const recipe = {
    id: 'recipe-scan-dumplings',
    recipeId: 'recipe-scan-dumplings',
    sourceRecipeId: 'garlic-chicken-rice-bowl',
    origin: 'scan',
    title: 'Lighter Pan-fried Dumplings',
    imageUri: 'file:///documents/okyo-scan-images/dumplings.jpg',
    originalImage: { uri: 'file:///documents/okyo-scan-images/dumplings.jpg' },
  };

  assert.equal(isUserScanRecipe(recipe), true);
  assert.equal(getStoredRecipeImageUri(recipe), recipe.imageUri);
});

test('two scanned recipes keep distinct image identities', () => {
  const first = { origin: 'scan', imageUri: 'file:///documents/okyo-scan-images/dumplings.jpg' };
  const second = { origin: 'scan', imageUri: 'file:///documents/okyo-scan-images/ramen.jpg' };

  assert.notEqual(getStoredRecipeImageUri(first), getStoredRecipeImageUri(second));
});

test('a scanned recipe with no local image does not resolve library art by source recipe ID', () => {
  const recipe = {
    id: 'recipe-scan-dumplings',
    recipeId: 'recipe-scan-dumplings',
    sourceRecipeId: 'garlic-chicken-rice-bowl',
    origin: 'scan',
    title: 'Lighter Pan-fried Dumplings',
  };

  assert.equal(getStoredRecipeImageUri(recipe), null);
  assert.equal(isUserScanRecipe(recipe), true);
});
