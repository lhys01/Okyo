import type { CanonicalRecipe } from '../../state/canonicalRecipes';
import { getCanonicalScanRecipeId, isUsableCanonicalRecipe } from '../../state/canonicalRecipes';
import type { PreferredTransformation } from './branchContracts';
import type { PrimaryGoal } from './personalizedOnboarding';

export type V4ResultSection = 'cost' | 'nutrition' | 'overview' | 'ingredients' | 'steps' | 'tools' | 'actions';

const ORDERS: Record<PrimaryGoal, readonly V4ResultSection[]> = {
  save_money: ['cost', 'overview', 'nutrition', 'ingredients', 'steps', 'tools', 'actions'],
  eat_healthier: ['nutrition', 'overview', 'cost', 'ingredients', 'steps', 'tools', 'actions'],
  hit_macros: ['nutrition', 'overview', 'cost', 'ingredients', 'steps', 'tools', 'actions'],
};

export function getV4ResultSectionOrder(goal: PrimaryGoal): readonly V4ResultSection[] {
  return ORDERS[goal];
}

export function resolveV4ResultRecipe(
  recipesById: Record<string, CanonicalRecipe>,
  recipeId: string | null,
  scanSessionId: string | null,
): CanonicalRecipe | null {
  const stableId = recipeId ?? (scanSessionId ? getCanonicalScanRecipeId(scanSessionId) : null);
  const recipe = stableId ? recipesById[stableId] : null;
  return isUsableCanonicalRecipe(recipe) ? recipe : null;
}

const TRANSFORMATION_LABELS: Record<PreferredTransformation, string> = {
  cheaper: 'Cheaper',
  more_balanced: 'More balanced',
  more_protein: 'More protein',
};

export function getV4ResolvedTransformationLabel(transformation: PreferredTransformation | null): string | null {
  return transformation ? TRANSFORMATION_LABELS[transformation] : null;
}
