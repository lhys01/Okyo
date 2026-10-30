import { normalizeFoodPreferences, type FoodPreferences } from '../../state/foodPreferences';

export type CanonicalDietaryHandoff = {
  preferences: FoodPreferences;
  dietaryDislikes: string[];
  dietaryRestrictions: string[];
};

/** The one safety-preserving boundary between onboarding answers and recipes. */
export function createCanonicalDietaryHandoff(value: unknown): CanonicalDietaryHandoff {
  const preferences = normalizeFoodPreferences(value);
  return {
    preferences,
    dietaryRestrictions: [...preferences.allergies, ...preferences.restrictions],
    dietaryDislikes: [...preferences.avoidances, ...preferences.dislikes],
  };
}
