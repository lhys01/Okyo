import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCaloriesFromMacros,
  isNutritionCalorieEstimateConsistent,
  isValidNutritionEstimate,
  normalizeNutritionEstimate,
} from './nutrition';

const valid = { calories: 520, proteinGrams: 35, carbohydratesGrams: 48, fatGrams: 20 };

test('nutrition accepts four primary values and optional fiber', () => {
  assert.equal(isValidNutritionEstimate(valid), true);
  assert.equal(isValidNutritionEstimate({ ...valid, fiberGrams: 7 }), true);
});

test('nutrition rejects negative, non-finite, and implausibly high values', () => {
  for (const bad of [
    { ...valid, calories: -1 },
    { ...valid, proteinGrams: Number.NaN },
    { ...valid, carbohydratesGrams: Number.POSITIVE_INFINITY },
    { ...valid, fatGrams: 301 },
    { ...valid, fiberGrams: 151 },
  ]) {
    assert.equal(isValidNutritionEstimate(bad), false);
  }
});

test('nutrition checks estimated calories against protein, carbohydrate, and fat energy', () => {
  assert.equal(getCaloriesFromMacros(valid), 512);
  assert.equal(isNutritionCalorieEstimateConsistent(valid), true);
  assert.equal(isNutritionCalorieEstimateConsistent({ ...valid, calories: 1200 }), false);
  assert.equal(isNutritionCalorieEstimateConsistent({
    calories: 210,
    proteinGrams: 18,
    carbohydratesGrams: 20,
    fatGrams: 8,
  }), true);
  assert.equal(isNutritionCalorieEstimateConsistent({
    calories: 200,
    proteinGrams: 18,
    carbohydratesGrams: 20,
    fatGrams: 8,
  }), false);
});

test('nutrition normalizes clear calorie and macronutrient disagreement without changing valid macros', () => {
  const normalized = normalizeNutritionEstimate({ ...valid, calories: 1200 });
  assert.deepEqual(normalized, { ...valid, calories: 512 });
  assert.equal(normalizeNutritionEstimate({ ...valid, proteinGrams: -1 }), null);
});
