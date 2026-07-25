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

function isValidNutritionValue(value: number, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
}
