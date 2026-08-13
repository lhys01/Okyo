import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Recipe, ScanResult } from '../mocks';
import {
  addCanonicalRecipeToGrocery,
  commitSuccessfulScan,
  confirmCanonicalRecipeIdentification,
  correctCanonicalRecipe,
  getEmptyCanonicalRecipeCollections,
  getRecipeIngredientPreview,
  registerCanonicalRecipe,
  resolveCanonicalRecipe,
  resolveRecentRecipes,
  saveCanonicalRecipe,
  setCanonicalRecipeCompletion,
  setCanonicalRecipeMode,
  setCanonicalRecipePresentationMode,
  toggleCanonicalRecipeLiked,
} from './canonicalRecipes';
import { getRecipeCorrectionSourceId } from '../utils/recipeCorrection';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'provider-spicy-rigatoni',
    scanResultId: 'scan-result-1',
    title: 'Spicy Rigatoni',
    mode: 'Normal',
    description: 'A creamy, spicy tomato pasta.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 8,
    estimatedSavings: 14,
    ingredients: [
      { name: 'rigatoni', quantity: '8 oz' },
      { name: 'tomato paste', quantity: '2 tbsp' },
      { name: 'heavy cream', quantity: '1/4 cup' },
    ],
    equipment: ['large pot', 'skillet'],
    steps: ['Boil the rigatoni.', 'Cook the sauce.', 'Toss the pasta with the sauce.'],
    substitutions: [],
    pantryNote: 'Salt and oil are pantry staples.',
    confidenceNote: 'Estimated from the uploaded photo.',
    nutritionEstimate: {
      calories: 610,
      proteinGrams: 19,
      carbohydratesGrams: 82,
      fatGrams: 23,
      fiberGrams: 6,
    },
    ...overrides,
  };
}

function makeScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    id: 'scan-result-1',
    dishName: 'Spicy Rigatoni',
    restaurantStyle: 'Italian restaurant',
    restaurantPrice: 22,
    homemadeCost: 8,
    estimatedSavings: 14,
    confidence: 0.84,
    matchScore: 8.4,
    difficulty: 'Easy',
    modes: ['Normal'],
    recipeId: 'provider-spicy-rigatoni',
    groceryListId: 'grocery-1',
    shareCardId: 'share-1',
    ...overrides,
  };
}

function commitScan(input: {
  activeScanSessionId?: string | null;
  completedAt?: string;
  source?: 'camera' | 'photos' | 'description' | 'mock';
  status?: 'success' | 'partial' | 'pending' | 'cancelled' | 'failed' | 'rejected';
  recipe?: Recipe | null;
  scan?: ScanResult | null;
} = {}) {
  const scanSessionId = 'scan-photos-1';
  return commitSuccessfulScan(getEmptyCanonicalRecipeCollections(), {
    activeScanSessionId: input.activeScanSessionId === undefined
      ? scanSessionId
      : input.activeScanSessionId,
    completedAt: input.completedAt,
    image: {
      fileName: 'meal.jpg',
      mimeType: 'image/jpeg',
      source: input.source ?? 'photos',
      uri: 'file:///documents/okyo-scan-images/meal.jpg',
    },
    recipe: input.recipe === undefined ? makeRecipe() : input.recipe,
    scan: input.scan === undefined ? makeScan() : input.scan,
    scanSessionId,
    selectedMode: 'Normal',
    source: input.source ?? 'photos',
    status: input.status ?? 'success',
  });
}

test('a pending scan does not create Recent', () => {
  const state = commitScan({ status: 'pending' });
  assert.deepEqual(state.recentRecipeIds, []);
  assert.deepEqual(state.recipesById, {});
});

test('a cancelled scan does not create Recent', () => {
  const state = commitScan({ status: 'cancelled' });
  assert.deepEqual(state.recentRecipeIds, []);
  assert.deepEqual(state.recipesById, {});
});

test('a failed or rejected scan does not create Recent', () => {
  for (const status of ['failed', 'rejected'] as const) {
    const state = commitScan({ status });
    assert.deepEqual(state.recentRecipeIds, []);
    assert.deepEqual(state.recipesById, {});
  }
});

test('a partial scan does not create Recent', () => {
  const state = commitScan({ status: 'partial' });
  assert.deepEqual(state.recentRecipeIds, []);
  assert.deepEqual(state.recipesById, {});
});

test('a malformed success without ingredients or steps does not create a canonical recipe', () => {
  const missingIngredients = commitScan({ recipe: makeRecipe({ ingredients: [] }) });
  const missingSteps = commitScan({ recipe: makeRecipe({ steps: [] }) });
  const invalidNutrition = commitScan({
    recipe: makeRecipe({
      nutritionEstimate: {
        calories: Number.NaN,
        proteinGrams: 20,
        carbohydratesGrams: 30,
        fatGrams: 10,
      },
    }),
  });
  assert.equal(Object.keys(missingIngredients.recipesById).length, 0);
  assert.equal(Object.keys(missingSteps.recipesById).length, 0);
  assert.equal(Object.keys(invalidNutrition.recipesById).length, 0);
});

test('a successful validated scan creates exactly one canonical recipe and one Recent reference', () => {
  const once = commitScan();
  const recipeId = once.recentRecipeIds[0];
  const twice = commitSuccessfulScan(once, {
    activeScanSessionId: 'scan-photos-1',
    completedAt: '2026-07-25T12:00:00.000Z',
    image: { source: 'photos', uri: 'file:///documents/okyo-scan-images/meal.jpg' },
    recipe: makeRecipe(),
    scan: makeScan(),
    scanSessionId: 'scan-photos-1',
    selectedMode: 'Normal',
    source: 'photos',
    status: 'success',
  });

  assert.equal(Object.keys(twice.recipesById).length, 1);
  assert.deepEqual(twice.recentRecipeIds, [recipeId]);
  assert.equal(twice.recipesById[recipeId].recipeId, recipeId);
  assert.equal(twice.recipesById[recipeId].sourceRecipeId, 'provider-spicy-rigatoni');
});

test('stale scan responses cannot replace a newer recipe', () => {
  const newer = commitSuccessfulScan(getEmptyCanonicalRecipeCollections(), {
    activeScanSessionId: 'scan-photos-newer',
    image: { source: 'photos', uri: 'file:///documents/okyo-scan-images/newer.jpg' },
    recipe: makeRecipe({ id: 'provider-newer', title: 'Newer Meal' }),
    scan: makeScan({ dishName: 'Newer Meal', recipeId: 'provider-newer' }),
    scanSessionId: 'scan-photos-newer',
    selectedMode: 'Normal',
    source: 'photos',
    status: 'success',
  });
  const afterStaleResponse = commitSuccessfulScan(newer, {
    activeScanSessionId: 'scan-photos-newer',
    image: { source: 'photos', uri: 'file:///documents/okyo-scan-images/older.jpg' },
    recipe: makeRecipe({ id: 'provider-older', title: 'Older Meal' }),
    scan: makeScan({ dishName: 'Older Meal', recipeId: 'provider-older' }),
    scanSessionId: 'scan-photos-older',
    selectedMode: 'Normal',
    source: 'photos',
    status: 'success',
  });

  assert.equal(Object.keys(afterStaleResponse.recipesById).length, 1);
  assert.deepEqual(afterStaleResponse.recentRecipeIds, ['recipe-scan-photos-newer']);
  assert.equal(afterStaleResponse.recipesById['recipe-scan-photos-newer'].title, 'Newer Meal');
});

test('Recent is stable across Home focus and ordered by successful completion time', () => {
  const first = commitScan({ completedAt: '2026-07-25T10:00:00.000Z' });
  const second = commitSuccessfulScan(first, {
    activeScanSessionId: 'scan-camera-2',
    completedAt: '2026-07-25T11:00:00.000Z',
    image: { source: 'camera', uri: 'file:///documents/okyo-scan-images/meal-2.jpg' },
    recipe: makeRecipe({ id: 'provider-meal-2', title: 'Second Meal' }),
    scan: makeScan({ id: 'scan-result-2', dishName: 'Second Meal', recipeId: 'provider-meal-2' }),
    scanSessionId: 'scan-camera-2',
    selectedMode: 'Normal',
    source: 'camera',
    status: 'success',
  });
  const firstFocus = resolveRecentRecipes(second.recipesById, second.recentRecipeIds);
  const secondFocus = resolveRecentRecipes(second.recipesById, second.recentRecipeIds);

  assert.deepEqual(secondFocus.map((recipe) => recipe.title), ['Second Meal', 'Spicy Rigatoni']);
  assert.deepEqual(secondFocus, firstFocus);
  assert.deepEqual(second.recentRecipeIds, ['recipe-scan-camera-2', 'recipe-scan-photos-1']);
});

test('Recent never includes a recommendation or mock recipe', () => {
  const recommendation = makeRecipe({ id: 'rec-pasta', title: 'Recommended Pasta' });
  let state = registerCanonicalRecipe(
    getEmptyCanonicalRecipeCollections(),
    recommendation,
    'recommendation',
  );
  state = {
    ...state,
    recentRecipeIds: ['rec-pasta'],
  };
  assert.deepEqual(resolveRecentRecipes(state.recipesById, state.recentRecipeIds), []);

  const mockState = commitScan({ source: 'mock' });
  assert.deepEqual(mockState.recentRecipeIds, []);
  assert.deepEqual(mockState.recipesById, {});
});

test('Recent cards resolve the canonical image and ingredient preview', () => {
  const state = commitScan();
  const recipe = resolveRecentRecipes(state.recipesById, state.recentRecipeIds)[0];
  assert.equal(recipe.imageUri, 'file:///documents/okyo-scan-images/meal.jpg');
  assert.equal(getRecipeIngredientPreview(recipe), 'rigatoni · tomato paste · heavy cream');
});

test('Result, Recipe Detail, Guided Cooking, and Completion keep the same recipeId', () => {
  const state = commitScan();
  const recipeId = state.recentRecipeIds[0];
  const resultRecipe = resolveCanonicalRecipe(state.recipesById, recipeId);
  const detailRecipe = resolveCanonicalRecipe(state.recipesById, recipeId);
  const guidedRecipe = resolveCanonicalRecipe(state.recipesById, recipeId);
  const completed = setCanonicalRecipeCompletion(state, recipeId, 'completed');
  const returnedRecipe = resolveCanonicalRecipe(completed.recipesById, recipeId);

  assert.strictEqual(resultRecipe, detailRecipe);
  assert.strictEqual(detailRecipe, guidedRecipe);
  assert.equal(returnedRecipe?.recipeId, recipeId);
  assert.equal(returnedRecipe?.completionState, 'completed');
  assert.equal(returnedRecipe?.imageUri, resultRecipe?.imageUri);
  assert.deepEqual(returnedRecipe?.ingredients, resultRecipe?.ingredients);
  assert.deepEqual(returnedRecipe?.nutritionEstimate, resultRecipe?.nutritionEstimate);
  assert.equal(returnedRecipe?.totalTimeMinutes, resultRecipe?.totalTimeMinutes);
});

test('Liked stores one canonical reference, requires explicit action, and toggles off', () => {
  const state = commitScan();
  const recipeId = state.recentRecipeIds[0];
  assert.deepEqual(state.savedRecipeIds, []);

  const selectedMode = setCanonicalRecipeMode(state, recipeId, 'Healthier');
  const selectedPresentation = setCanonicalRecipePresentationMode(
    selectedMode,
    recipeId,
    'More Protein',
  );
  const liked = toggleCanonicalRecipeLiked(
    selectedPresentation,
    recipeId,
    '2026-07-25T12:00:00.000Z',
  );
  const repeatedLikeWrite = saveCanonicalRecipe(liked, recipeId, '2026-07-25T13:00:00.000Z');
  assert.deepEqual(repeatedLikeWrite.savedRecipeIds, [recipeId]);
  assert.equal(repeatedLikeWrite.recipesById[recipeId].isSaved, true);
  assert.equal(repeatedLikeWrite.recipesById[recipeId].selectedMode, 'Healthier');
  assert.equal(repeatedLikeWrite.recipesById[recipeId].selectedPresentationMode, 'More Protein');
  assert.equal(repeatedLikeWrite.recipesById[recipeId].savedAt, '2026-07-25T12:00:00.000Z');

  const unliked = toggleCanonicalRecipeLiked(repeatedLikeWrite, recipeId);
  assert.deepEqual(unliked.savedRecipeIds, []);
  assert.equal(unliked.recipesById[recipeId].isSaved, false);
});

test('mock and demo recipes cannot enter Liked', () => {
  for (const marker of ['mock', 'demo']) {
    const recipe = makeRecipe({
      confidenceNote: `${marker} fixture`,
      id: `${marker}-recipe`,
    });
    const registered = registerCanonicalRecipe(
      getEmptyCanonicalRecipeCollections(),
      recipe,
      'library',
    );
    const liked = saveCanonicalRecipe(registered, recipe.id);
    assert.deepEqual(liked.recipesById, {});
    assert.deepEqual(liked.savedRecipeIds, []);
  }
});

test('Grocery requires explicit user action and does not change when saving', () => {
  const state = commitScan();
  const recipeId = state.recentRecipeIds[0];
  const saved = saveCanonicalRecipe(state, recipeId);
  assert.deepEqual(saved.groceryRecipeIds, []);

  const addedOnce = addCanonicalRecipeToGrocery(saved, recipeId);
  const addedTwice = addCanonicalRecipeToGrocery(addedOnce, recipeId);
  assert.deepEqual(addedTwice.groceryRecipeIds, [recipeId]);
});

test('correction updates the same canonical recipe without duplicating Recent, Saved, or Grocery', () => {
  const state = commitScan();
  const recipeId = state.recentRecipeIds[0];
  const saved = saveCanonicalRecipe(state, recipeId);
  const grocery = addCanonicalRecipeToGrocery(saved, recipeId);
  const originalImage = grocery.recipesById[recipeId].imageUri;
  const originalImageMetadata = grocery.recipesById[recipeId].originalImage;
  const correctedRecipe = makeRecipe({
    id: 'provider-lamb-chops',
    title: 'Grilled Lamb Chops',
    description: 'Herby grilled lamb chops.',
    imageUri: 'file:///wrong-image.jpg',
    ingredients: [
      { name: 'lamb chops', quantity: '4' },
      { name: 'rosemary', quantity: '1 tsp' },
    ],
    steps: ['Season the lamb.', 'Grill until done.', 'Rest before serving.'],
    servings: 2,
    prepTimeMinutes: 7,
    cookTimeMinutes: 18,
    totalTimeMinutes: 25,
    equipment: ['grill pan', 'tongs'],
    nutritionEstimate: {
      calories: 520,
      proteinGrams: 42,
      carbohydratesGrams: 4,
      fatGrams: 36,
    },
  });
  const corrected = correctCanonicalRecipe(
    grocery,
    recipeId,
    correctedRecipe,
    makeScan({ dishName: 'Grilled Lamb Chops', recipeId: correctedRecipe.id }),
  );
  const recipe = corrected.recipesById[recipeId];

  assert.equal(recipe.recipeId, recipeId);
  assert.equal(recipe.id, recipeId);
  assert.equal(recipe.sourceRecipeId, 'provider-lamb-chops');
  assert.equal(recipe.title, 'Grilled Lamb Chops');
  assert.equal(recipe.description, 'Herby grilled lamb chops.');
  assert.equal(recipe.correctedDishName, 'Grilled Lamb Chops');
  assert.equal(recipe.imageUri, originalImage);
  assert.deepEqual(recipe.originalImage, originalImageMetadata);
  assert.deepEqual(
    recipe.ingredients.map(({ name, quantity }) => ({ name, quantity })),
    correctedRecipe.ingredients,
  );
  assert.ok(recipe.ingredients.every((ingredient) => ingredient.id?.startsWith('ingredient-')));
  assert.deepEqual(recipe.nutritionEstimate, correctedRecipe.nutritionEstimate);
  assert.equal(recipe.servings, correctedRecipe.servings);
  assert.equal(recipe.prepTimeMinutes, correctedRecipe.prepTimeMinutes);
  assert.equal(recipe.cookTimeMinutes, correctedRecipe.cookTimeMinutes);
  assert.equal(recipe.totalTimeMinutes, correctedRecipe.totalTimeMinutes);
  assert.deepEqual(recipe.equipment, correctedRecipe.equipment);
  assert.deepEqual(recipe.steps, correctedRecipe.steps);
  assert.deepEqual(corrected.recentRecipeIds, [recipeId]);
  assert.deepEqual(corrected.savedRecipeIds, [recipeId]);
  assert.deepEqual(corrected.groceryRecipeIds, [recipeId]);
  assert.equal(new Set(corrected.recentRecipeIds).size, 1);
  assert.equal(new Set(corrected.savedRecipeIds).size, 1);
  assert.equal(new Set(corrected.groceryRecipeIds).size, 1);
});

test('sequential corrections replace one canonical recipe and advance the latest source recipe id', () => {
  const initial = commitScan();
  const recipeId = initial.recentRecipeIds[0];
  const liked = saveCanonicalRecipe(initial, recipeId);
  const grocery = addCanonicalRecipeToGrocery(liked, recipeId);
  const originalImage = grocery.recipesById[recipeId].originalImage;

  const firstProviderRecipe = makeRecipe({
    id: 'provider-correction-1',
    title: 'Soy Sauce Noodles with Beef',
    description: 'Soy sauce noodles with sliced beef.',
    ingredients: [
      { name: 'noodles', quantity: '8 oz' },
      { name: 'soy sauce', quantity: '2 tbsp' },
      { name: 'sesame oil', quantity: '1 tbsp' },
      { name: 'sliced beef', quantity: '8 oz' },
    ],
    steps: ['Cook the noodles.', 'Sear the beef.', 'Toss noodles and beef with the sauce.'],
    nutritionEstimate: {
      calories: 485,
      proteinGrams: 30,
      carbohydratesGrams: 52,
      fatGrams: 17,
    },
  });
  const first = correctCanonicalRecipe(
    grocery,
    recipeId,
    firstProviderRecipe,
    makeScan({ dishName: firstProviderRecipe.title, recipeId: firstProviderRecipe.id }),
  );
  assert.equal(getRecipeCorrectionSourceId(first.recipesById[recipeId]), 'provider-correction-1');

  const secondProviderRecipe = makeRecipe({
    ...firstProviderRecipe,
    id: 'provider-correction-2',
    ingredients: firstProviderRecipe.ingredients.filter((ingredient) => !ingredient.name.includes('sesame')),
    steps: ['Cook the noodles.', 'Sear the beef.', 'Toss noodles and beef with the sauce.'],
    nutritionEstimate: {
      calories: 450,
      proteinGrams: 30,
      carbohydratesGrams: 52,
      fatGrams: 13,
    },
  });
  const second = correctCanonicalRecipe(
    first,
    recipeId,
    secondProviderRecipe,
    makeScan({ dishName: secondProviderRecipe.title, recipeId: secondProviderRecipe.id }),
  );
  assert.equal(getRecipeCorrectionSourceId(second.recipesById[recipeId]), 'provider-correction-2');
  assert.ok(second.recipesById[recipeId].ingredients.some((ingredient) => ingredient.name.includes('beef')));
  assert.ok(second.recipesById[recipeId].ingredients.some((ingredient) => ingredient.name.includes('noodles')));
  assert.ok(second.recipesById[recipeId].ingredients.every((ingredient) => !ingredient.name.includes('sesame')));

  const thirdProviderRecipe = makeRecipe({
    ...secondProviderRecipe,
    id: 'provider-correction-3',
    description: 'Spicy soy sauce noodles with sliced beef.',
    ingredients: [...secondProviderRecipe.ingredients, { name: 'chili crisp', quantity: '1 tbsp' }],
    steps: [...secondProviderRecipe.steps, 'Fold in the chili crisp before serving.'],
  });
  const third = correctCanonicalRecipe(
    second,
    recipeId,
    thirdProviderRecipe,
    makeScan({ dishName: thirdProviderRecipe.title, recipeId: thirdProviderRecipe.id }),
  );

  assert.equal(third.recipesById[recipeId].id, recipeId);
  assert.equal(third.recipesById[recipeId].recipeId, recipeId);
  assert.equal(third.recipesById[recipeId].sourceRecipeId, 'provider-correction-3');
  assert.deepEqual(third.recipesById[recipeId].originalImage, originalImage);
  assert.deepEqual(third.recentRecipeIds, [recipeId]);
  assert.deepEqual(third.savedRecipeIds, [recipeId]);
  assert.deepEqual(third.groceryRecipeIds, [recipeId]);
});

test('the original scan snapshot survives adaptations so Normal can restore it in place', () => {
  const initial = commitScan();
  const recipeId = initial.recentRecipeIds[0];
  const original = initial.recipesById[recipeId];
  const adaptedProviderRecipe = makeRecipe({
    id: 'provider-lighter-rigatoni',
    title: 'Lighter Spicy Rigatoni',
    estimatedHomemadeCost: 7,
    nutritionEstimate: {
      calories: 450,
      proteinGrams: 24,
      carbohydratesGrams: 61,
      fatGrams: 14,
      fiberGrams: 8,
    },
  });
  const adapted = correctCanonicalRecipe(
    initial,
    recipeId,
    adaptedProviderRecipe,
    makeScan({
      dishName: adaptedProviderRecipe.title,
      homemadeCost: adaptedProviderRecipe.estimatedHomemadeCost,
      recipeId: adaptedProviderRecipe.id,
    }),
  );
  const adaptedRecipe = adapted.recipesById[recipeId];

  assert.equal(adaptedRecipe.title, 'Lighter Spicy Rigatoni');
  assert.equal(adaptedRecipe.nutritionEstimate?.calories, 450);
  assert.equal(adaptedRecipe.scanResult?.homemadeCost, 7);
  assert.equal(adaptedRecipe.baseRecipe?.title, original.title);
  assert.equal(adaptedRecipe.baseScanResult?.dishName, 'Spicy Rigatoni');

  const restored = correctCanonicalRecipe(
    adapted,
    recipeId,
    adaptedRecipe.baseRecipe!,
    adaptedRecipe.baseScanResult!,
  );
  const restoredRecipe = restored.recipesById[recipeId];

  assert.equal(restoredRecipe.title, original.title);
  assert.equal(restoredRecipe.scanResult?.dishName, original.scanResult?.dishName);
  assert.equal(restoredRecipe.scanResult?.homemadeCost, original.scanResult?.homemadeCost);
  assert.equal(restoredRecipe.baseRecipe?.title, original.title);
});

test('a failed later correction preserves the latest successful canonical version and references', () => {
  const initial = commitScan();
  const recipeId = initial.recentRecipeIds[0];
  const liked = saveCanonicalRecipe(initial, recipeId);
  const grocery = addCanonicalRecipeToGrocery(liked, recipeId);
  const successfulRecipe = makeRecipe({ id: 'provider-current', title: 'Current corrected recipe' });
  const current = correctCanonicalRecipe(
    grocery,
    recipeId,
    successfulRecipe,
    makeScan({ dishName: successfulRecipe.title, recipeId: successfulRecipe.id }),
  );

  const rejected = correctCanonicalRecipe(
    current,
    recipeId,
    makeRecipe({ id: 'provider-invalid', ingredients: [], steps: [] }),
    makeScan({ dishName: 'Invalid correction', recipeId: 'provider-invalid' }),
  );

  assert.strictEqual(rejected, current);
  assert.equal(rejected.recipesById[recipeId].sourceRecipeId, 'provider-current');
  assert.deepEqual(rejected.recentRecipeIds, [recipeId]);
  assert.deepEqual(rejected.savedRecipeIds, [recipeId]);
  assert.deepEqual(rejected.groceryRecipeIds, [recipeId]);
});

test('identification confirmation persists on the canonical recipe without changing references', () => {
  const initial = commitScan();
  const recipeId = initial.recentRecipeIds[0];
  const confirmed = confirmCanonicalRecipeIdentification(initial, recipeId, '2026-07-26T12:00:00.000Z');

  assert.equal(confirmed.recipesById[recipeId].identificationConfirmedAt, '2026-07-26T12:00:00.000Z');
  assert.deepEqual(confirmed.recentRecipeIds, initial.recentRecipeIds);
  assert.deepEqual(confirmed.savedRecipeIds, initial.savedRecipeIds);
  assert.deepEqual(confirmed.groceryRecipeIds, initial.groceryRecipeIds);
});

test('screen navigation passes recipeId and Home action order is stable', () => {
  const resultSource = readFileSync(path.join(srcDir, 'screens', 'ResultSummaryScreen.tsx'), 'utf8');
  const detailSource = readFileSync(path.join(srcDir, 'screens', 'RecipeDetailScreen.tsx'), 'utf8');
  const homeSource = readFileSync(path.join(srcDir, 'screens', 'HomeScreen.tsx'), 'utf8');
  const entrySource = readFileSync(path.join(srcDir, 'components', 'okyo', 'ScanFab.tsx'), 'utf8');

  assert.ok(resultSource.includes("screen: 'RecipeStepsScreen'"));
  assert.ok(resultSource.includes('recipeId: selectedRecipe.id'));
  assert.equal(resultSource.includes('<Text style={styles.recipeSectionTitle}>Steps</Text>'), false);
  assert.ok(resultSource.includes('startCookingRecipe(selectedRecipe.id)'));
  assert.match(
    detailSource,
    /navigation\.navigate\('RecipeStepsScreen', \{[\s\S]{0,140}completion: false,[\s\S]{0,140}recipeId: recipe\.id/,
  );
  assert.ok(detailSource.includes("label=\"Back to Recipe\""));
  assert.ok(detailSource.includes('recipeId: recipe.id'));
  assert.equal(homeSource.includes('latestScanRecipe'), false);
  assert.equal(homeSource.includes('savedRecipes'), false);
  assert.ok(homeSource.includes('<RecentDishCard'));
  assert.ok(homeSource.includes('borderRadius: radius.card'));
  assert.ok(homeSource.indexOf('<WeekStrip') < homeSource.indexOf('<MetricCarousel'));
  assert.ok(homeSource.indexOf('<MetricCarousel') < homeSource.indexOf('Recent dishes'));
  assert.ok(homeSource.indexOf('Recent dishes') < homeSource.indexOf('Today’s ideas'));
  assert.ok(homeSource.includes('getRecommendationsForMealTime'));
  assert.ok(homeSource.includes('getMealTimeForHour'));
  assert.ok(homeSource.includes('compact'));
  // Home now surfaces exactly two ideas; the rest live behind Explore.
  assert.ok(homeSource.includes('HOME_IDEA_COUNT = 2'));
  assert.ok(homeSource.includes('slice(0, HOME_IDEA_COUNT)'));
  assert.ok(entrySource.indexOf('label="Take photo"') < entrySource.indexOf('label="Upload photo"'));
  assert.match(entrySource, /label="Upload photo"[\s\S]*label="Describe a dish"/);
});
