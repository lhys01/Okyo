export const DIETARY_RESTRICTIONS = [
  'Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Gluten', 'Shellfish',
  'Fish', 'Soy', 'Sesame', 'Pork', 'Beef', 'Alcohol',
] as const;

export const DIETARY_DISLIKES = [
  'Mushrooms', 'Olives', 'Cilantro', 'Spicy food', 'Onions', 'Seafood', 'Very sweet',
] as const;

import { EMPTY_FOOD_PREFERENCES, normalizeFoodPreferences, type FoodPreferences } from '../../state/foodPreferences';

export type DietarySelection = FoodPreferences;

export const EMPTY_DIETARY_SELECTION: DietarySelection = EMPTY_FOOD_PREFERENCES;

export const normalizeDietarySelection = normalizeFoodPreferences;
