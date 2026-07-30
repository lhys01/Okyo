import type { NutritionEstimate } from '../mocks';

export const nutritionBounds = {
  calories: 5000,
  proteinGrams: 300,
  carbohydratesGrams: 500,
  fatGrams: 300,
  fiberGrams: 150,
} as const;

export function isValidNutritionEstimate(value: NutritionEstimate | null | undefined): value is NutritionEstimate {
  if (!value) return false;
  const required = ['calories', 'proteinGrams', 'carbohydratesGrams', 'fatGrams'] as const;
  if (!required.every((key) => isValidNutritionValue(value[key], nutritionBounds[key]))) return false;
  return value.fiberGrams === undefined || isValidNutritionValue(value.fiberGrams, nutritionBounds.fiberGrams);
}

export function getCaloriesFromMacros(value: Pick<
  NutritionEstimate,
  'proteinGrams' | 'carbohydratesGrams' | 'fatGrams'
>) {
  return (value.proteinGrams * 4) + (value.carbohydratesGrams * 4) + (value.fatGrams * 9);
}

export function isNutritionCalorieEstimateConsistent(value: NutritionEstimate) {
  if (!isValidNutritionEstimate(value)) {
    return false;
  }

  const macroCalories = getCaloriesFromMacros(value);
  const tolerance = Math.max(20, macroCalories * 0.1);
  return Math.abs(value.calories - macroCalories) <= tolerance;
}

export function normalizeNutritionEstimate(
  value: NutritionEstimate | null | undefined,
): NutritionEstimate | null {
  if (!isValidNutritionEstimate(value)) {
    return null;
  }

  if (isNutritionCalorieEstimateConsistent(value)) {
    return value;
  }

  return {
    ...value,
    calories: Math.round(getCaloriesFromMacros(value)),
  };
}

function isValidNutritionValue(value: number, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
}
