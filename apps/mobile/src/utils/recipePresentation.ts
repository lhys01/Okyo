const DEFAULT_RECIPE_DESCRIPTION = 'A practical homemade take on this dish.';

export function getRecipeDescription(
  description: string | null | undefined,
  fallback = DEFAULT_RECIPE_DESCRIPTION,
) {
  const normalized = description?.replace(/\s+/g, ' ').trim() ?? '';
  return normalized || fallback;
}

type CookingCtaRecipe = {
  id: string;
  completionState?: string;
};

export function getCookingCtaLabel(
  recipe: CookingCtaRecipe,
  activeRecipeId?: string | null,
): 'Continue Cooking' | 'Cook Again' | 'Start Cooking' {
  if (activeRecipeId === recipe.id) {
    return 'Continue Cooking';
  }

  return recipe.completionState === 'completed' ? 'Cook Again' : 'Start Cooking';
}
