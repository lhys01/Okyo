import assert from 'node:assert/strict';
import test from 'node:test';

import type { Recipe } from '../mocks';
import { classifyRecipeStepTiming, formatRecipeDuration, formatRecipeStepTiming, getRecipeStepTiming, getRecipeTiming, getStepElapsedMinutes, normalizeRecipeForCanonicalStorage, normalizeRecipeTime } from './recipeIntegrity';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-fixture',
    scanResultId: 'scan-fixture',
    title: 'Skillet Dinner',
    mode: 'Normal',
    description: 'An estimated homemade recipe.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 2,
    difficulty: 'Easy',
    estimatedHomemadeCost: 8,
    estimatedSavings: 12,
    ingredients: [{ name: 'vegetables', quantity: '2 cups' }],
    steps: ['Cook the vegetables in a skillet for 20 minutes.'],
    substitutions: [],
    pantryNote: '',
    confidenceNote: 'Estimated.',
    nutritionEstimate: {
      calories: 500,
      proteinGrams: 25,
      carbohydratesGrams: 55,
      fatGrams: 20,
    },
    ...overrides,
  };
}

test('a cooked pizza reported as one minute is normalized to a credible content-based total', () => {
  const time = normalizeRecipeTime(makeRecipe({
    title: 'Baked Vegetable Pizza',
    prepTimeMinutes: 1,
    cookTimeMinutes: 0,
    totalTimeMinutes: 1,
    steps: ['Bake the pizza until the crust is browned.'],
  }));

  assert.ok(time.cookTimeMinutes >= 12);
  assert.ok(time.totalTimeMinutes >= 13);
});

test('a normal cooked meal keeps its valid reported time', () => {
  assert.deepEqual(normalizeRecipeTime(makeRecipe()), {
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
  });
});

test('a genuinely quick no-cook snack can remain one minute', () => {
  assert.deepEqual(normalizeRecipeTime(makeRecipe({
    title: 'No-cook Snack Plate',
    prepTimeMinutes: 1,
    cookTimeMinutes: 0,
    totalTimeMinutes: 1,
    steps: ['Arrange the fruit and yogurt on a plate.'],
  })), {
    prepTimeMinutes: 1,
    cookTimeMinutes: 0,
    totalTimeMinutes: 1,
  });
});

test('malformed or missing time receives a finite positive content-based fallback', () => {
  const time = normalizeRecipeTime(makeRecipe({
    prepTimeMinutes: Number.NaN,
    cookTimeMinutes: Number.POSITIVE_INFINITY,
    totalTimeMinutes: undefined,
    steps: ['Combine the ingredients.', 'Arrange on a plate.'],
  }));

  assert.ok(Number.isFinite(time.totalTimeMinutes));
  assert.ok(time.totalTimeMinutes > 0);
});

test('guided time parsing uses elapsed units and repeated waits', () => {
  assert.equal(getStepElapsedMinutes('Refrigerate for 1 hour.', 1), 60);
  assert.equal(getStepElapsedMinutes('Let rise for 1 hour.', 1), 60);
  assert.equal(getStepElapsedMinutes('Repeat this process 3 times, chilling for 30 minutes between each fold.', 30), 90);
  assert.equal(getStepElapsedMinutes('Refrigerate for 30 minutes; repeat twice more.'), 90);
  assert.equal(getStepElapsedMinutes('Mix for 5 minutes, refrigerate for 30 minutes, then repeat twice more.'), 95);
  assert.equal(getStepElapsedMinutes('Bake for 15–20 minutes.', 18), 18);
  assert.equal(formatRecipeDuration(60), '1 hr');
  assert.equal(formatRecipeDuration(90), '1 hr 30 min');
});

test('user-facing timing separates hands-on, waiting, and total elapsed time', () => {
  const mix = getRecipeStepTiming({ text: 'Mix for 5 minutes.' });
  const chill = getRecipeStepTiming({ text: 'Refrigerate for 1 hour.' });
  const mixed = getRecipeStepTiming({ text: 'Knead for 10 minutes, then let rise for 1 hour.' });

  assert.equal(classifyRecipeStepTiming(mix), 'hands-on');
  assert.equal(classifyRecipeStepTiming(chill), 'waiting');
  assert.equal(classifyRecipeStepTiming(mixed), 'mixed');
  assert.deepEqual({ active: mixed.handsOnMinutes, waiting: mixed.passiveMinutes, total: mixed.elapsedMinutes }, { active: 10, waiting: 60, total: 70 });
  assert.match(formatRecipeStepTiming(chill), /^Waiting · ~1 hr$/);
  assert.match(formatRecipeStepTiming(mixed), /Hands-on · ~10 min · Waiting · ~1 hr/);
});

test('valid structured timing takes priority over contradictory legacy text', () => {
  const timing = getRecipeStepTiming({
    text: 'Refrigerate for 1 hour.',
    activeMinutes: 5,
    passiveMinutes: 10,
    elapsedMinutes: 15,
  });

  assert.deepEqual(timing, { activeMinutes: 5, passiveMinutes: 10, elapsedMinutes: 15, handsOnMinutes: 5 });
});

test('semantically wrong structured baking timing is corrected without double counting', () => {
  assert.deepEqual(getRecipeStepTiming({ text: 'Bake for 18 minutes.', activeMinutes: 18, passiveMinutes: 0, elapsedMinutes: 18 }), {
    activeMinutes: 0, passiveMinutes: 18, elapsedMinutes: 18, handsOnMinutes: 0,
  });
  assert.deepEqual(getRecipeStepTiming({ text: 'Bake for 30 minutes, rotating the pan halfway through.', activeMinutes: 30, passiveMinutes: 0, elapsedMinutes: 30 }), {
    activeMinutes: 2, passiveMinutes: 28, elapsedMinutes: 30, handsOnMinutes: 2,
  });
});

test('recipe timing summary keeps total at least hands-on plus waiting', () => {
  const timing = getRecipeTiming(makeRecipe({
    totalTimeMinutes: 1,
    steps: [],
    structuredSteps: [
      { text: 'Mix for 5 minutes.' },
      { text: 'Refrigerate for 1 hour.' },
      { text: 'Let rise for 45 minutes.' },
    ],
  }));

  assert.equal(timing.handsOnMinutes, 5);
  assert.equal(timing.waitingMinutes, 105);
  assert.equal(timing.totalMinutes, 110);
  assert.ok(timing.totalMinutes >= timing.handsOnMinutes + timing.waitingMinutes);
});

test('canonical storage raises total time to the sequential structured-step sum', () => {
  const normalized = normalizeRecipeTime(makeRecipe({
    totalTimeMinutes: 161,
    prepTimeMinutes: 20,
    cookTimeMinutes: 20,
    structuredSteps: [
      { text: 'Refrigerate for 1 hour.', elapsedMinutes: 60 },
      { text: 'Repeat folds, chilling for 30 minutes between each fold.', elapsedMinutes: 90 },
      { text: 'Bake for 18 minutes.', elapsedMinutes: 18 },
    ],
  }));
  assert.equal(normalized.totalTimeMinutes, 168);
});

test('canonical storage reconciles stale structured durations with written repeated waits', () => {
  const normalized = normalizeRecipeTime(makeRecipe({
    totalTimeMinutes: 79,
    prepTimeMinutes: 20,
    cookTimeMinutes: 20,
    structuredSteps: [
      { text: 'Mix for 5 minutes, refrigerate for 30 minutes, then repeat twice more.', elapsedMinutes: 30 },
      { text: 'Bake for 18 minutes.', elapsedMinutes: 18 },
    ],
  }));
  assert.equal(normalized.totalTimeMinutes, 113);
});

test('canonical normalization rejects invalid servings and nutrition and reconciles calorie disagreement', () => {
  assert.equal(normalizeRecipeForCanonicalStorage(makeRecipe({ servings: 0 })), null);
  assert.equal(normalizeRecipeForCanonicalStorage(makeRecipe({
    nutritionEstimate: {
      calories: 500,
      proteinGrams: -1,
      carbohydratesGrams: 20,
      fatGrams: 10,
    },
  })), null);

  const normalized = normalizeRecipeForCanonicalStorage(makeRecipe({
    nutritionEstimate: {
      calories: 1400,
      proteinGrams: 30,
      carbohydratesGrams: 40,
      fatGrams: 20,
    },
  }));
  assert.equal(normalized?.nutritionEstimate?.calories, 460);
});
