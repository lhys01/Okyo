import { defaultRecipe, getDefaultRecipeForMode } from './recipes';
import type { Recipe, RecipeMode } from './types';

export const recipeModes: RecipeMode[] = ['Restaurant Copy', 'Budget', 'Healthy'];

export function isRecipeMode(mode: unknown): mode is RecipeMode {
  return typeof mode === 'string' && recipeModes.includes(mode as RecipeMode);
}

export function getSafeRecipeMode(mode: unknown): RecipeMode {
  return isRecipeMode(mode) ? mode : 'Restaurant Copy';
}

export function getSafeRecipeForMode(mode: unknown): Recipe {
  const safeMode = getSafeRecipeMode(mode);
  return getDefaultRecipeForMode(safeMode) ?? defaultRecipe;
}

export function getSafeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getSafeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
