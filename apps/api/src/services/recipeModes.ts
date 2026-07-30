import { z } from 'zod';

import type { RecipeMode } from '../types.js';

export const CURRENT_RECIPE_MODES = [
  'Normal',
  'Lighter',
  'Healthier',
  'More Protein',
] as const satisfies readonly RecipeMode[];

const knownLegacyModeKeys = new Set([
  'budget',
  'healthy',
  'restaurant copy',
  ['restaurant', 'style'].join(' '),
]);

export const recipeModeInputSchema = z.string().transform((value, context): RecipeMode => {
  const normalized = normalizeKnownRecipeMode(value);
  if (normalized) {
    return normalized;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `Mode must be one of: ${CURRENT_RECIPE_MODES.join(', ')}.`,
  });
  return z.NEVER;
});

export function normalizeKnownRecipeMode(value: unknown): RecipeMode | null {
  if (typeof value !== 'string') {
    return null;
  }
  if ((CURRENT_RECIPE_MODES as readonly string[]).includes(value)) {
    return value as RecipeMode;
  }

  const key = normalizeModeKey(value);
  return knownLegacyModeKeys.has(key) ? 'Normal' : null;
}

export function isLegacyRecipeMode(value: unknown): value is string {
  return typeof value === 'string' &&
    normalizeKnownRecipeMode(value) === 'Normal' &&
    value !== 'Normal';
}

function normalizeModeKey(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}
