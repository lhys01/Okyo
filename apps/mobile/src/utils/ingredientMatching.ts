import type { RecipeIngredient } from '../mocks';

// Shared ingredient-name matching: recipe.ingredients is the single source of
// truth. Guided cooking chips and grocery items must resolve to a recipe
// ingredient through these rules or not be shown at all.

// Common culinary synonyms — AI may use one name while the recipe uses another.
const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  scallion: ['green onion', 'spring onion'],
  'green onion': ['scallion', 'spring onion'],
  'spring onion': ['scallion', 'green onion'],
  cilantro: ['coriander', 'fresh coriander'],
  coriander: ['cilantro', 'fresh coriander'],
  cornstarch: ['corn starch', 'corn flour'],
  'corn starch': ['cornstarch', 'corn flour'],
  chickpea: ['garbanzo bean', 'garbanzo'],
  garbanzo: ['chickpea', 'garbanzo bean'],
  'garbanzo bean': ['chickpea', 'garbanzo'],
  'bell pepper': ['capsicum', 'sweet pepper'],
  capsicum: ['bell pepper', 'sweet pepper'],
  zucchini: ['courgette'],
  courgette: ['zucchini'],
  eggplant: ['aubergine'],
  aubergine: ['eggplant'],
};

export function normalizeIngredientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Resolves an ingredient name (e.g. from a guided-cooking step or grocery item)
// to an entry in the recipe ingredient list. Returns null when nothing matches —
// callers must drop unmatched names, never invent them.
export function matchIngredientToList(
  name: string,
  recipeIngredients: RecipeIngredient[],
): RecipeIngredient | null {
  const normalized = normalizeIngredientName(name);
  if (!normalized) {
    return null;
  }

  // 1. Exact match
  const exact = recipeIngredients.find((ingredient) => normalizeIngredientName(ingredient.name) === normalized);
  if (exact) {
    return exact;
  }

  // 2. Substring match (either direction)
  const substring = recipeIngredients.find((ingredient) => {
    const candidate = normalizeIngredientName(ingredient.name);
    return candidate.includes(normalized) || normalized.includes(candidate);
  });
  if (substring) {
    return substring;
  }

  // 3. All significant words present (handles "garlic" matching "2 cloves garlic, minced")
  const words = normalized.split(' ').filter((word) => word.length >= 3);
  if (words.length > 0) {
    const wordMatch = recipeIngredients.find((ingredient) => {
      const candidate = normalizeIngredientName(ingredient.name);
      return words.every(
        (word) =>
          candidate.includes(word) ||
          candidate.includes(`${word}s`) ||
          (word.endsWith('s') && candidate.includes(word.slice(0, -1))),
      );
    });
    if (wordMatch) {
      return wordMatch;
    }
  }

  // 4. Synonym lookup — handles scallions↔green onions, cilantro↔coriander, etc.
  // Also tries the singular form so "scallions" resolves via the "scallion" key.
  const singularNormalized = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
  const synonyms = INGREDIENT_SYNONYMS[normalized] ?? INGREDIENT_SYNONYMS[singularNormalized] ?? [];
  if (synonyms.length > 0) {
    const synonymMatch = recipeIngredients.find((ingredient) => {
      const candidate = normalizeIngredientName(ingredient.name);
      return synonyms.some((synonym) => candidate.includes(normalizeIngredientName(synonym)));
    });
    if (synonymMatch) {
      return synonymMatch;
    }
  }

  return null;
}

// Convenience check for grocery filtering: does this name resolve to any entry
// in the recipe ingredient list?
export function ingredientNameMatchesList(name: string, recipeIngredients: RecipeIngredient[]): boolean {
  return matchIngredientToList(name, recipeIngredients) !== null;
}
