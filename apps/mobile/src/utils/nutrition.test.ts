import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidNutritionEstimate } from './nutrition';

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
