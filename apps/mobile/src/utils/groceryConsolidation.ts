import type { Recipe, RecipeIngredient } from '../mocks';

export type GroceryRecipeSource = { recipeId: string; recipeTitle: string };

export type ConsolidatedGroceryItem = {
  id: string;
  name: string;
  quantity: string;
  sources: GroceryRecipeSource[];
};

type ParsedQuantity = { amount: number | null; unit: string; raw: string };

export function consolidateRecipeIngredients(recipes: Recipe[]): ConsolidatedGroceryItem[] {
  const grouped = new Map<string, ConsolidatedGroceryItem & { amount: number | null; unit: string }>();

  for (const recipe of recipes) {
    if (!recipe?.id || !Array.isArray(recipe.ingredients)) continue;
    for (const ingredient of recipe.ingredients) {
      if (!ingredient?.name?.trim()) continue;
      const normalizedName = normalizeIngredientName(ingredient.name);
      if (!normalizedName) continue;
      const parsed = parseIngredientQuantity(ingredient);
      const quantityKey = parsed.amount !== null
        ? parsed.unit || 'unitless'
        : parsed.raw.toLowerCase();
      const key = `${normalizedName}|${quantityKey}`;
      const source = { recipeId: recipe.id, recipeTitle: recipe.title };
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          amount: parsed.amount,
          id: key,
          name: ingredient.name.trim(),
          quantity: parsed.raw,
          sources: [source],
          unit: parsed.unit,
        });
        continue;
      }

      if (!existing.sources.some((item) => item.recipeId === recipe.id)) existing.sources.push(source);
      if (existing.amount !== null && parsed.amount !== null) {
        existing.amount += parsed.amount;
        existing.quantity = formatQuantity(existing.amount, existing.unit);
      }
    }
  }

  return [...grouped.values()]
    .map(({ amount: _amount, unit: _unit, ...item }) => item)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeIngredientName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /\b(eggs|tomatoes|potatoes|onions|carrots|peppers|apples|bananas|lemons|limes|tortillas)\b/g,
      (word) => ({
        eggs: 'egg', tomatoes: 'tomato', potatoes: 'potato', onions: 'onion', carrots: 'carrot',
        peppers: 'pepper', apples: 'apple', bananas: 'banana', lemons: 'lemon', limes: 'lime',
        tortillas: 'tortilla',
      })[word] ?? word,
    );
}

function parseIngredientQuantity(ingredient: RecipeIngredient): ParsedQuantity {
  const raw = ingredient.quantity?.trim() || 'as needed';
  const match = raw.match(/^(\d+(?:\.\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔])\s*(.*)$/);
  if (!match) return { amount: null, raw, unit: '' };
  return { amount: parseNumber(match[1]), raw, unit: normalizeUnit(match[2]) };
}

function parseNumber(value: string): number | null {
  const fractions: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  if (fractions[value]) return fractions[value];
  if (value.includes('/')) {
    const [numerator, denominator] = value.split('/').map((part) => Number(part.trim()));
    return denominator > 0 ? numerator / denominator : null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeUnit(value: string): string {
  const unit = value.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  const aliases: Record<string, string> = {
    tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
    tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
    cup: 'cup', cups: 'cup',
    g: 'g', gram: 'g', grams: 'g',
    kg: 'kg', kilogram: 'kg', kilograms: 'kg',
    ml: 'ml', milliliter: 'ml', milliliters: 'ml',
    l: 'l', liter: 'l', liters: 'l',
    oz: 'oz', ounce: 'oz', ounces: 'oz',
    lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  };
  return aliases[unit] ?? unit;
}

function formatQuantity(amount: number, unit: string): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}${unit ? ` ${unit}` : ''}`;
}
