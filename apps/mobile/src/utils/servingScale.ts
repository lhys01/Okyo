import type { RecipeIngredient } from '../mocks';

const FRACTIONS: Record<string, number> = {
  '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4,
  '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};

export function scaleIngredientQuantity(quantity: string, fromServings: number, toServings: number): string {
  if (!quantity.trim() || fromServings <= 0 || toServings <= 0 || fromServings === toServings) return quantity;
  // A range has no single safe value to scale without inventing intent.
  if (/^\s*\d+(?:\.\d+)?\s*[-–—]\s*\d/.test(quantity)) return quantity;
  const factor = toServings / fromServings;
  const match = quantity.match(/^\s*(?:(\d+)\s+(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|(\d+)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])|(\d+(?:\.\d+)?))/);
  if (!match || !match[0].trim()) return quantity;

  let value: number;
  if (match[1] && match[2] && match[3]) value = Number(match[1]) + Number(match[2]) / Number(match[3]);
  else if (match[4] && match[5]) value = Number(match[4]) / Number(match[5]);
  else if (match[7]) value = Number(match[6] ?? 0) + (FRACTIONS[match[7]] ?? 0);
  else value = Number(match[8]);
  if (!Number.isFinite(value) || value <= 0) return quantity;

  const scaled = formatAmount(value * factor);
  const remainder = quantity.slice(match[0].length).trimStart();
  return remainder ? `${scaled} ${remainder}` : scaled;
}

export function scaleIngredient(
  ingredient: RecipeIngredient,
  fromServings: number,
  toServings: number,
): RecipeIngredient {
  return { ...ingredient, quantity: scaleIngredientQuantity(ingredient.quantity, fromServings, toServings) };
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 8) / 8;
  const whole = Math.floor(rounded);
  const fraction = rounded - whole;
  const fractionLabel = Object.entries(FRACTIONS).find(([, amount]) => Math.abs(amount - fraction) < 0.001)?.[0];
  if (fractionLabel) return `${whole || ''}${whole ? ' ' : ''}${fractionLabel}`;
  return Number.isInteger(rounded) ? `${rounded}` : `${Math.round(rounded * 100) / 100}`;
}
