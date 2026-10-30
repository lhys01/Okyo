// Dietary selection rules. Pattern and exclusions are separate models:
// vegetarian/vegan are mutually exclusive patterns; gluten/dairy/nuts are independent.

import type { Avoid, DietPattern } from './types';

export type DietSelection = { dietPattern?: DietPattern; avoid: Avoid[] };

export const AVOID_ORDER: Avoid[] = ['gluten', 'dairy', 'nuts'];

/** Tapping a pattern selects it, or clears it when it was already active ("Nothing"). */
export function togglePattern(current: DietSelection, pattern: DietPattern | null): DietSelection {
  if (pattern === null) return { ...current, dietPattern: undefined };
  if (current.dietPattern === pattern) return { ...current, dietPattern: undefined };
  return { ...current, dietPattern: pattern };
}

export function toggleAvoid(current: DietSelection, value: Avoid): DietSelection {
  const has = current.avoid.includes(value);
  const next = has ? current.avoid.filter((a) => a !== value) : [...current.avoid, value];
  return { ...current, avoid: AVOID_ORDER.filter((a) => next.includes(a)) };
}

export function isNothingSelected(selection: DietSelection): boolean {
  return !selection.dietPattern && selection.avoid.length === 0;
}

/** Plain-language summary shown on the diet screen. Never claims allergy safety. */
export function describeDiet(selection: DietSelection): { line: string; detail: string } {
  const parts: string[] = [];
  if (selection.dietPattern === 'vegan') parts.push('be vegan');
  else if (selection.dietPattern === 'vegetarian') parts.push('be vegetarian');
  if (selection.avoid.length) {
    parts.push(`leave out ${formatList(selection.avoid)}`);
  }
  if (!parts.length) {
    return {
      line: 'Include everything.',
      detail: 'No pattern set and nothing excluded — you can change this anytime in Settings.',
    };
  }
  const detail = selection.dietPattern
    ? 'Recipes follow this pattern from your first scan.'
    : 'No eating pattern set — everything else stays on the table.';
  return { line: `${capitalize(parts.join(' and '))}.`, detail };
}

function formatList(values: string[]): string {
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
