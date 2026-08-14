import { correctScanRecipe } from '../../api/client';
import type { CanonicalRecipe } from '../../state/canonicalRecipes';
import { foodPreferencesPersistence, toApiFoodPreferences } from '../../state/foodPreferences';
import { useOkyoStore } from '../../state/useOkyoStore';
import { buildCorrectionRequest, getRecipeCorrectionSourceId } from '../../utils/recipeCorrection';
import { onboardingV3Persistence } from '../state/onboardingV3Persistence';
import { buildGoalContext } from '../state/goalContext';
import type { OnboardingV4CorrectionResult, OnboardingV4PendingPremiumAction } from '../state/onboardingV4PremiumAction';

export async function requestOnboardingV4Customization(action: OnboardingV4PendingPremiumAction, recipe: CanonicalRecipe): Promise<OnboardingV4CorrectionResult> {
  if (action.type !== 'customize' || !action.customizationText?.trim()) throw new Error('A customization request is required.');
  const sourceRecipeId = getRecipeCorrectionSourceId(recipe);
  const [preferences, profile] = await Promise.all([
    foodPreferencesPersistence.read(),
    onboardingV3Persistence.readPersonalizedProfile(),
  ]);
  const request = buildCorrectionRequest({
    correctionRequestId: action.actionId,
    correctionNote: action.customizationText,
    expectedSourceRecipeId: sourceRecipeId,
    canonicalRecipeId: recipe.id,
    currentRecipe: recipe,
    goalContext: buildGoalContext(profile),
    mode: recipe.selectedMode,
  });
  const response = await correctScanRecipe(sourceRecipeId, { ...request, ...toApiFoodPreferences(preferences) });
  const correctedRecipe = response.recipe ?? response.recipes?.[0] ?? null;
  if (!correctedRecipe || !response.scan) throw new Error('Okyo returned an incomplete customization. Try again.');
  return { recipe: correctedRecipe, scan: response.scan };
}

export function isOnboardingV4CustomizationApplied(action: OnboardingV4PendingPremiumAction, result: OnboardingV4CorrectionResult) {
  const current = useOkyoStore.getState().recipesById[action.recipeId];
  return Boolean(current && current.sourceRecipeId === result.recipe.id && current.scanResult?.id === result.scan.id);
}

export function applyOnboardingV4Customization(recipeId: string, result: OnboardingV4CorrectionResult) {
  return useOkyoStore.getState().correctRecipe(recipeId, result.recipe, result.scan);
}
