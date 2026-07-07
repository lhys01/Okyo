import type { GroceryListItem, Recipe, RecipeIngredient, RecipeStep } from '../types.js';

// Ingredient closure validation: recipe.ingredients is the single source of
// truth. Every step.ingredientsUsed entry and every grocery item must resolve
// to a recipe ingredient. Pure functions only: no AI calls, no side effects.

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
  ['jalapeno', 'jalapenos'],
  ['yogurt', 'yoghurt', 'yogurts', 'yoghurts'],
  ['arugula', 'rocket', 'arugulas'],
  ['shrimp', 'prawn', 'prawns', 'shrimps'],
  ['ground meat', 'mince', 'minced meat', 'ground beef', 'minced beef'],
];

const INGREDIENT_SYNONYM_LOOKUP = new Map<string, number>(
  INGREDIENT_SYNONYM_GROUPS.flatMap((group, idx) =>
    group.map((alias) => [alias.toLowerCase().trim(), idx]),
  ),
);

export function canonicalIngredientName(name: string): string {
  const lower = name.toLowerCase().trim();
  const direct = INGREDIENT_SYNONYM_LOOKUP.get(lower);
  if (direct !== undefined) {
    return INGREDIENT_SYNONYM_GROUPS[direct][0];
  }

  if (lower.endsWith('s') && lower.length > 3) {
    const singular = lower.slice(0, -1);
    const singularIdx = INGREDIENT_SYNONYM_LOOKUP.get(singular);
    if (singularIdx !== undefined) {
      return INGREDIENT_SYNONYM_GROUPS[singularIdx][0];
    }
  }

  return lower;
}

export function ingredientsMatch(recipeIngredient: string, stepIngredient: string): boolean {
  const a = canonicalIngredientName(recipeIngredient);
  const b = canonicalIngredientName(stepIngredient);
  return a === b || a.includes(b) || b.includes(a);
}

function matchesAnyIngredient(name: string, ingredientNames: string[]): boolean {
  return ingredientNames.some((ingredientName) => ingredientsMatch(ingredientName, name));
}

export type IngredientClosureReport = {
  unknownStepIngredients: string[];
  missingGroceryItems: string[];
};

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
      if (!trimmed) {
        continue;
      }
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
      if (!trimmed) {
        return false;
      }
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
