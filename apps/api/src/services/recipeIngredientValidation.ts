import type { GroceryListItem, Recipe, RecipeIngredient, RecipeStep } from '../types.js';

// Ingredient closure validation: recipe.ingredients is the single source of
// truth. Every step.ingredientsUsed entry and every grocery item must resolve
// to a recipe ingredient. Pure functions only — no AI calls, no side effects.

// Culinary synonym groups — each group maps to a single canonical form (index 0).
// Used to match equivalent ingredient names across different cuisines and dialects.
const INGREDIENT_SYNONYM_GROUPS: string[][] = [
  ['scallion', 'scallions', 'green onion', 'green onions', 'spring onion', 'spring onions'],
  ['cilantro', 'coriander', 'fresh coriander'],
  ['chickpea', 'chickpeas', 'garbanzo', 'garbanzo bean', 'garbanzo beans', 'garbanzos'],
  ['zucchini', 'zucchinis', 'courgette', 'courgettes'],
  ['eggplant', 'eggplants', 'aubergine', 'aubergines'],
  ['bell pepper', 'bell peppers', 'capsicum', 'capsicums'],
  ['cornstarch', 'corn starch', 'cornflour', 'corn flour'],
  ['confectioners sugar', "confectioner's sugar", 'powdered sugar', 'icing sugar'],
  ['caster sugar', 'castor sugar', 'superfine sugar'],
  ['jalapeño', 'jalapeno', 'jalapeños', 'jalapenos'],
  ['yogurt', 'yoghurt', 'yogurts', 'yoghurts'],
  ['arugula', 'rocket', 'arugulas'],
  ['shrimp', 'prawn', 'prawns', 'shrimps'],
];

const quantityPrefixPattern = new RegExp(
  [
    '^',
    '(?:about\\s+|approximately\\s+|approx\\.?\\s+)?',
    '(?:',
    '\\d+\\s+\\d+\\/\\d+',
    '|\\d+\\/\\d+',
    '|\\d+(?:\\.\\d+)?',
    '|[¼½¾⅓⅔⅛⅜⅝⅞]',
    '|one|two|three|four|five|six|seven|eight|nine|ten',
    '|a|an|half|quarter|pinch|dash|handful',
    ')',
    '\\s*',
  ].join(''),
  'i',
);

const measurementPrefixPattern = new RegExp(
  [
    '^(?:',
    'cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|grams?|g|',
    'kilograms?|kg|milliliters?|ml|liters?|l|cloves?|slices?|pieces?|cans?|jars?|',
    'packages?|packs?|bunches?|sprigs?|stalks?|heads?|fillets?|breasts?|thighs?',
    ')\\b\\s*(?:of\\s+)?',
  ].join(''),
  'i',
);

const preparationWords = new Set([
  'about', 'approximately', 'boneless', 'chilled', 'chopped', 'coarsely', 'cold',
  'cooked', 'crushed', 'cubed', 'deseeded', 'diced', 'divided', 'drained', 'dried',
  'extra', 'finely', 'fresh', 'freshly', 'frozen', 'grated', 'halved', 'julienned', 'large', 'lightly',
  'medium', 'melted', 'minced', 'optional', 'peeled', 'prepared', 'quartered',
  'rinsed', 'roughly', 'seeded', 'shredded', 'skinless', 'sliced', 'small', 'softened',
  'thinly', 'toasted', 'trimmed', 'virgin', 'warm',
]);

function normalizeIngredientText(name: string): string {
  let normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[–—-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  normalized = normalized.replace(quantityPrefixPattern, '').trim();
  normalized = normalized.replace(measurementPrefixPattern, '').trim();
  normalized = normalized
    .replace(/\b(?:for|to)\s+(?:serving|garnish|frying|cooking|greasing)\b.*$/i, '')
    .replace(/\bto taste\b$/i, '')
    .trim();

  const tokens = normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !preparationWords.has(token))
    .map(singularizeIngredientToken);
  return tokens.join(' ').trim();
}

function singularizeIngredientToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('ses') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1);
  return token;
}

// Build a normalized alias → canonical index lookup at module load time.
const INGREDIENT_SYNONYM_LOOKUP = new Map<string, number>(
  INGREDIENT_SYNONYM_GROUPS.flatMap((group, idx) =>
    group.map((alias) => [normalizeIngredientText(alias), idx]),
  ),
);

// Returns the canonical ingredient concept after removing quantities,
// punctuation, preparation descriptors, simple plurals, and known synonyms.
export function canonicalIngredientName(name: string): string {
  const normalized = normalizeIngredientText(name);
  const direct = INGREDIENT_SYNONYM_LOOKUP.get(normalized);
  if (direct !== undefined) {
    return INGREDIENT_SYNONYM_GROUPS[direct][0];
  }
  return normalized;
}

const safeGenericIngredientAliases = new Set(['oil', 'salt', 'pepper']);
const safeGenericIngredientCategoryAliases = new Map<string, Set<string>>([
  ['pasta', new Set([
    'spaghetti', 'linguine', 'fettuccine', 'tagliatelle', 'penne', 'rigatoni',
    'farfalle', 'fusilli', 'macaroni', 'orecchiette', 'bucatini', 'vermicelli',
  ])],
  ['noodle', new Set([
    'ramen', 'udon', 'soba', 'rice noodle', 'egg noodle', 'glass noodle',
  ])],
]);
const distinctIngredientProductTokens = new Set([
  'broth', 'cheese', 'cream', 'flour', 'milk', 'oil', 'paste', 'powder',
  'sauce', 'starch', 'stock', 'syrup', 'vinegar',
]);

// Returns true when two ingredient strings are considered the same after shared
// culinary normalization. Generic "oil" safely matches a named cooking oil, but
// two different named oils do not match each other.
export function ingredientsMatch(recipeIngredient: string, stepIngredient: string): boolean {
  const a = canonicalIngredientName(recipeIngredient);
  const b = canonicalIngredientName(stepIngredient);
  if (!a || !b) return false;
  if (a === b) return true;
  if (safeGenericIngredientAliases.has(a) && b.split(' ').includes(a)) return true;
  if (safeGenericIngredientAliases.has(b) && a.split(' ').includes(b)) return true;
  if (safeGenericIngredientCategoryAliases.get(a)?.has(b)) return true;
  if (safeGenericIngredientCategoryAliases.get(b)?.has(a)) return true;

  const aTokens = a.split(' ').filter(Boolean);
  const bTokens = b.split(' ').filter(Boolean);
  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longer = aTokens.length <= bTokens.length ? bTokens : aTokens;
  if (shorter.length === 0 || !shorter.every((token) => longer.includes(token))) {
    return false;
  }
  const extraTokens = longer.filter((token) => !shorter.includes(token));
  return !extraTokens.some((token) => distinctIngredientProductTokens.has(token));
}

export function findMatchingIngredientName(
  reference: string,
  ingredientNames: string[],
): string | undefined {
  return ingredientNames.find((ingredientName) => ingredientsMatch(ingredientName, reference));
}

function matchesAnyIngredient(name: string, ingredientNames: string[]): boolean {
  return findMatchingIngredientName(name, ingredientNames) !== undefined;
}

export type IngredientClosureReport = {
  unknownStepIngredients: string[];
  missingGroceryItems: string[];
};

// Checks the closure invariant on a recipe-shaped object:
// - every step.ingredientsUsed entry must match a recipe ingredient
// - every recipe ingredient must appear in groceryItems
export function validateIngredientClosure(recipe: {
  ingredients: RecipeIngredient[];
  structuredSteps?: RecipeStep[];
  groceryItems?: GroceryListItem[];
}): IngredientClosureReport {
  const ingredientNames = recipe.ingredients
    .map((ingredient) => ingredient.name.trim())
    .filter(Boolean);

  const unknownStepIngredients: string[] = [];
  for (const step of recipe.structuredSteps ?? []) {
    for (const stepIngredient of step.ingredientsUsed ?? []) {
      const trimmed = stepIngredient.trim();
      if (!trimmed) continue;
      if (!matchesAnyIngredient(trimmed, ingredientNames)) {
        unknownStepIngredients.push(trimmed);
      }
    }
  }

  const groceryNames = (recipe.groceryItems ?? [])
    .map((item) => item.name.trim())
    .filter(Boolean);
  const missingGroceryItems = ingredientNames.filter(
    (name) => !groceryNames.some((groceryName) => ingredientsMatch(name, groceryName)),
  );

  return {
    unknownStepIngredients: [...new Set(unknownStepIngredients)],
    missingGroceryItems: [...new Set(missingGroceryItems)],
  };
}

export type StepIngredientStripResult = {
  steps: RecipeStep[];
  strippedStepIngredients: string[];
};

// Removes step.ingredientsUsed entries that do not resolve to a recipe
// ingredient. Never invents ingredients and never fails — worst case a step
// simply lists fewer "use now" items. Returns new step objects (no mutation).
export function stripUnknownStepIngredients(
  steps: RecipeStep[],
  ingredients: RecipeIngredient[],
): StepIngredientStripResult {
  const ingredientNames = ingredients.map((ingredient) => ingredient.name.trim()).filter(Boolean);
  const strippedStepIngredients: string[] = [];

  const cleanedSteps = steps.map((step) => {
    if (!step.ingredientsUsed?.length) {
      return step;
    }

    const known = step.ingredientsUsed.filter((name) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (matchesAnyIngredient(trimmed, ingredientNames)) {
        return true;
      }
      strippedStepIngredients.push(trimmed);
      return false;
    });

    if (known.length === step.ingredientsUsed.length) {
      return step;
    }

    return {
      ...step,
      ingredientsUsed: known.length > 0 ? known : undefined,
    };
  });

  return {
    steps: cleanedSteps,
    strippedStepIngredients: [...new Set(strippedStepIngredients)],
  };
}

export type EnforcedIngredientClosure = {
  recipe: Recipe;
  report: IngredientClosureReport;
  strippedStepIngredients: string[];
  changed: boolean;
};

// Enforces the closure invariant on a finished recipe by stripping unknown
// step-ingredient references. Grocery regeneration is the caller's job (the
// deterministic grocery builder lives with the recipe pipeline) — this
// function only reports missing grocery coverage.
export function enforceStepIngredientClosure(recipe: Recipe): EnforcedIngredientClosure {
  const report = validateIngredientClosure(recipe);
  if (report.unknownStepIngredients.length === 0) {
    return { recipe, report, strippedStepIngredients: [], changed: false };
  }

  const { steps, strippedStepIngredients } = stripUnknownStepIngredients(
    recipe.structuredSteps ?? [],
    recipe.ingredients,
  );

  return {
    recipe: { ...recipe, structuredSteps: steps },
    report,
    strippedStepIngredients,
    changed: strippedStepIngredients.length > 0,
  };
}
