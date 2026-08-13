import type { Recipe } from '../mocks';

export type SavedMealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'dessert';

const categoryOrder: SavedMealCategory[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'dessert'];

const categoryKeywords: Record<SavedMealCategory, RegExp> = {
  breakfast: /\b(breakfast|pancake|waffle|oatmeal|overnight oats|granola|cereal|french toast|avocado toast|egg muffin|breakfast burrito|smoothie|yogurt bowl)\b/i,
  lunch: /\b(wrap|sandwich|salad|soup|bowl|grain bowl|rice bowl|poke|quesadilla|flatbread|panini)\b/i,
  dinner: /\b(pasta|noodle|curry|stir[- ]?fry|taco|enchilada|chicken|beef|pork|steak|salmon|shrimp|roast|casserole|lasagna|risotto|pizza|meatball|bolognese|chili)\b/i,
  snacks: /\b(snack|trail mix|energy bite|energy ball|hummus|dip|deviled egg|fruit cup|protein bar|popcorn)\b/i,
  dessert: /\b(dessert|brownie|brownies|cake|cookie|cookies|pie|pudding|ice cream|gelato|cheesecake|muffin|donut|doughnut|cobbler|crumble|tart|fudge)\b/i,
};

/**
 * Returns only confident, stable meal buckets. Unknown recipes remain visible
 * under All instead of being assigned a misleading category.
 */
export function getSavedMealCategories(recipe: Recipe): SavedMealCategory[] {
  const mealTypes = (recipe as Recipe & { mealTypes?: unknown }).mealTypes;
  const metadata = [
    (recipe as Recipe & { mealType?: unknown }).mealType,
    ...(Array.isArray(mealTypes) ? mealTypes : []),
    (recipe as Recipe & { category?: unknown }).category,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .flatMap(normalizeMetadataCategory);

  if (metadata.length > 0) {
    return Array.from(new Set(metadata)).sort(byCategoryOrder);
  }

  const searchText = [recipe.title, recipe.description, ...(recipe.ingredients ?? []).map((ingredient) => ingredient.name)].join(' ');
  return categoryOrder.filter((category) => categoryKeywords[category].test(searchText));
}

function normalizeMetadataCategory(value: string): SavedMealCategory[] {
  if (value === 'snack') {
    return ['snacks'];
  }
  if (value === 'snacks' || value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'dessert') {
    return [value];
  }
  if (value === 'breakfast & brunch') {
    return ['breakfast'];
  }
  if (value === 'desserts & treats') {
    return ['dessert'];
  }
  if (value === 'handheld & wraps') {
    return ['lunch', 'dinner'];
  }
  if (value === 'proteins & mains' || value === 'pasta & noodles' || value === 'dinner & cooking methods') {
    return ['dinner'];
  }
  if (value === 'bowls & grains' || value === 'salads & vegetables' || value === 'soups & stews') {
    return ['lunch'];
  }
  return [];
}

function byCategoryOrder(a: SavedMealCategory, b: SavedMealCategory) {
  return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
}
