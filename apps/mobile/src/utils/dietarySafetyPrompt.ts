import type { FoodPreferenceConflict, FoodPreferences } from '../state/foodPreferences';

/**
 * Repair of Step 06 item 6: one typed computation, reused by every reachable
 * recipe-result/pre-Cook surface (`OnboardingRecipePreview.tsx`,
 * `RecipeDetailScreen.tsx`'s `openCookingSteps`) so the two screens can no
 * longer diverge — before this, one screen only warned on an actual
 * ingredient-name match and the other only ever showed a generic reminder,
 * so a user could get a stronger prompt on one screen than the other for the
 * exact same recipe and preferences.
 *
 * - `none`: no saved allergies at all — zero extra Cook friction.
 * - `general_reminder`: allergies are saved but automated matching found no
 *   conflict in this recipe's ingredient names. Explicitly does NOT imply the
 *   recipe is safe — automated matching can miss things (misspelled
 *   ingredients, custom/unrecognized allergy text, indirect derivatives).
 * - `possible_conflict`: automated matching found a probable allergy or
 *   restriction match. Always described as "possible," never a guarantee.
 */
export type DietarySafetyPromptLevel = 'none' | 'general_reminder' | 'possible_conflict';

export function classifyDietarySafetyPrompt(
  preferences: Pick<FoodPreferences, 'allergies'>,
  conflicts: readonly Pick<FoodPreferenceConflict, 'category'>[],
): DietarySafetyPromptLevel {
  const hasSeriousConflict = conflicts.some((conflict) => conflict.category === 'allergy' || conflict.category === 'restriction');
  if (hasSeriousConflict) return 'possible_conflict';
  if (preferences.allergies.length > 0) return 'general_reminder';
  return 'none';
}
