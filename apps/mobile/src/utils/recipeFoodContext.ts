import type { Recipe } from '../mocks';

export type RecipeFoodContext = {
  allergens: string[];
  disclaimer: string;
  summary: string;
};

const GROUPS = [
  { label: 'a grain or starchy base', terms: ['pasta', 'noodle', 'rice', 'bread', 'flour', 'potato', 'oat', 'quinoa', 'tortilla'] },
  { label: 'a protein source', terms: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'tofu', 'bean', 'lentil', 'egg', 'yogurt', 'cheese'] },
  { label: 'vegetables or herbs', terms: ['tomato', 'basil', 'spinach', 'garlic', 'onion', 'pepper', 'broccoli', 'carrot', 'mushroom', 'zucchini', 'herb'] },
] as const;

const ALLERGENS = [
  { label: 'dairy', terms: ['milk', 'cream', 'butter', 'cheese', 'parmesan', 'yogurt'] },
  { label: 'wheat/gluten', terms: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'tortilla'] },
  { label: 'egg', terms: ['egg', 'mayonnaise'] },
  { label: 'soy', terms: ['soy', 'tofu', 'miso', 'tempeh'] },
  { label: 'sesame', terms: ['sesame', 'tahini'] },
  { label: 'peanuts/tree nuts', terms: ['peanut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut'] },
  { label: 'fish', terms: ['fish', 'salmon', 'tuna', 'anchovy'] },
  { label: 'shellfish', terms: ['shrimp', 'prawn', 'crab', 'lobster', 'clam', 'mussel', 'oyster'] },
] as const;

function containsTerm(text: string, term: string) {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(text);
}

export function getRecipeFoodContext(recipe: Recipe): RecipeFoodContext {
  const ingredientText = recipe.ingredients
    .map((ingredient) => ingredient.name)
    .join(' ')
    .toLowerCase()
    .replace(/\b([a-z]+)[ -]free\b/g, '');
  const groups = GROUPS.filter((group) => group.terms.some((term) => containsTerm(ingredientText, term)))
    .map((group) => group.label);
  const allergens = ALLERGENS.filter((allergen) => allergen.terms.some((term) => containsTerm(ingredientText, term)))
    .map((allergen) => allergen.label);

  return {
    allergens,
    summary: groups.length > 0
      ? `The listed ingredients include ${formatList(groups)}.`
      : 'The ingredient list is the best guide to what is in this recipe.',
    disclaimer: 'Based on listed ingredients only. Portions, brands, and substitutions can change nutrition and allergens.',
  };
}

function formatList(values: string[]) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}
