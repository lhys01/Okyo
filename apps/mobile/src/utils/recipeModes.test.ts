import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CURRENT_RECIPE_MODES,
  migrateLegacyRecipeMode,
  normalizeOutboundRecipeMode,
  normalizePersistedRecipeModeState,
} from './recipeModes';

test('only the four current recipe modes are supported', () => {
  assert.deepEqual(CURRENT_RECIPE_MODES, [
    'Normal',
    'Lighter',
    'Healthier',
    'More Protein',
  ]);
});

test('legacy and unknown persisted modes migrate to Normal without deleting recipe state', () => {
  const legacyRestaurantStyle = ['Restaurant', 'Style'].join(' ');
  for (const legacyMode of ['Budget', 'Restaurant Copy', legacyRestaurantStyle, 'Healthy', 'Chef Style', '', null]) {
    assert.equal(migrateLegacyRecipeMode(legacyMode), 'Normal');
    assert.equal(normalizeOutboundRecipeMode(legacyMode), 'Normal');
  }
  for (const currentMode of CURRENT_RECIPE_MODES) {
    assert.equal(migrateLegacyRecipeMode(currentMode), currentMode);
  }
});

test('persisted canonical recipes migrate mode fields in place', () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'state', 'useOkyoStore.ts'),
    'utf8',
  );
  assert.match(source, /\.\.\.value,[\s\S]*mode: getMigratedRecipeMode\(value\.mode\)/);
  assert.match(source, /selectedMode: getMigratedRecipeMode\(value\.selectedMode\)/);
  assert.match(source, /selectedMode: getMigratedRecipeMode\(state\.selectedMode\)/);
});

test('hydration normalizes global, canonical, latest-session, and presentation modes without data loss', () => {
  const canonicalRecipe = {
    id: 'canonical-1',
    recipeId: 'canonical-1',
    sourceRecipeId: 'source-revision-7',
    imageUri: 'file:///documents/okyo-scan-images/original.jpg',
    originalImage: {
      uri: 'file:///documents/okyo-scan-images/original.jpg',
      source: 'photos',
    },
    title: 'Persisted recipe',
    mode: 'Budget',
    selectedMode: 'Restaurant Copy',
    selectedPresentationMode: 'Healthy',
    ingredients: [{ name: 'main ingredient', quantity: '1 cup' }],
    nutritionEstimate: {
      calories: 220,
      proteinGrams: 12,
      carbohydratesGrams: 30,
      fatGrams: 6,
    },
    steps: ['Prepare the main ingredient.'],
    scanResult: {
      id: 'scan-1',
      recipeId: 'canonical-1',
      modes: ['Budget', 'Normal'],
    },
  };
  const persisted = {
    selectedMode: 'Budget',
    recipesById: { 'canonical-1': canonicalRecipe },
    latestScanRecipe: canonicalRecipe,
    latestScanResult: canonicalRecipe.scanResult,
    latestScanSession: {
      scanSessionId: 'scan-session-1',
      latestScanRecipe: canonicalRecipe,
      latestScanResult: canonicalRecipe.scanResult,
    },
    recentRecipeIds: ['canonical-1'],
    savedRecipeIds: ['canonical-1'],
    groceryRecipeIds: ['canonical-1'],
  };

  const migrated = normalizePersistedRecipeModeState(persisted);
  const recipe = migrated.recipesById['canonical-1'];
  assert.equal(migrated.selectedMode, 'Normal');
  assert.equal(recipe.mode, 'Normal');
  assert.equal(recipe.selectedMode, 'Normal');
  assert.equal(recipe.selectedPresentationMode, 'Normal');
  assert.deepEqual(recipe.scanResult.modes, ['Normal']);
  assert.equal(migrated.latestScanRecipe.mode, 'Normal');
  assert.equal(migrated.latestScanSession.latestScanRecipe.mode, 'Normal');

  assert.equal(recipe.id, canonicalRecipe.id);
  assert.equal(recipe.recipeId, canonicalRecipe.recipeId);
  assert.equal(recipe.sourceRecipeId, canonicalRecipe.sourceRecipeId);
  assert.equal(recipe.imageUri, canonicalRecipe.imageUri);
  assert.deepEqual(recipe.originalImage, canonicalRecipe.originalImage);
  assert.deepEqual(recipe.ingredients, canonicalRecipe.ingredients);
  assert.deepEqual(recipe.nutritionEstimate, canonicalRecipe.nutritionEstimate);
  assert.deepEqual(recipe.steps, canonicalRecipe.steps);
  assert.deepEqual(migrated.recentRecipeIds, persisted.recentRecipeIds);
  assert.deepEqual(migrated.savedRecipeIds, persisted.savedRecipeIds);
  assert.deepEqual(migrated.groceryRecipeIds, persisted.groceryRecipeIds);
});

test('same-version hydration and outbound fallback both normalize unknown modes', () => {
  const hydrated = normalizePersistedRecipeModeState({
    selectedMode: 'unrecognized legacy mode',
  });
  assert.equal(hydrated.selectedMode, 'Normal');
  assert.equal(normalizeOutboundRecipeMode(hydrated.selectedMode), 'Normal');
  assert.equal(normalizeOutboundRecipeMode('another malformed value'), 'Normal');
});
