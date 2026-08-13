const DEFAULT_RECIPE_DESCRIPTION = 'A practical homemade take on this dish.';

export function getCompactRecipeDescription(
  description: string | null | undefined,
  fallback = DEFAULT_RECIPE_DESCRIPTION,
) {
  const normalized = description?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized) {
    return fallback;
  }

  const firstSentence = (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/)?.[0] ?? normalized)
    .replace(/\b(perfect for|great for|ideal for|delicious|mouthwatering)\b[^.!?]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,:;]+$/, '');
  const words = firstSentence.replace(/[.!?]+$/, '').split(' ').filter(Boolean);
  if (words.length <= 18) {
    return `${firstSentence.replace(/[.!?]+$/, '')}.`;
  }

  const commaClause = firstSentence.split(/[,;:]/)[0].trim();
  if (commaClause.split(' ').length >= 6 && commaClause.split(' ').length <= 18) {
    return `${commaClause}.`;
  }

  // Keep legacy descriptions to one short sentence without an ellipsis or a
  // dangling clause. New generation guidance should already produce this size.
  return `${words.slice(0, 14).join(' ').replace(/[,:;.!?]+$/, '')}.`;
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
