// Precomputed C-08 example. Local only — never calls /v1/scans or any AI provider.
// The ingredient photograph is a labelled development placeholder (see PLACEHOLDER_NOTICE).

import type { OnboardingAnswers } from './types';

export const PLACEHOLDER_NOTICE =
  'Development placeholder — production acceptance blocked pending approved photograph.';

export type ExampleRecipe = {
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  totalMinutes: number;
  pansToWash: number;
  estimatedCost: string;
  costCaveat: string;
  /** Highlighted because the user's answer asked for it. Empty when nothing applies. */
  emphasis?: string;
};

const BASE_INGREDIENTS = [
  'Leftover rice', 'Black beans', 'Bell pepper', 'Onion', 'Tomato', 'Corn', 'Avocado',
];

const BASE: ExampleRecipe = {
  title: '15-Minute Vegetable Rice Bowl',
  description: 'Warm rice, beans and peppers with avocado on top.',
  ingredients: BASE_INGREDIENTS,
  steps: [
    'Warm the rice in a dry pan.',
    'Add beans, pepper, onion and corn; cook 5 minutes.',
    'Top with tomato and sliced avocado.',
  ],
  totalMinutes: 15,
  pansToWash: 1,
  estimatedCost: '$2.40',
  costCaveat: 'Example estimate. Costs vary by store and location.',
};

/**
 * The example visibly responds to the user's answers, but stays internally
 * consistent: time, steps and ingredients never contradict each other.
 */
export function buildExample(answers: OnboardingAnswers): ExampleRecipe {
  const f = answers.followUp;

  if (f?.kind === 'maxMinutes' && f.value === 15) {
    return { ...BASE, emphasis: 'Under 15 minutes, start to finish' };
  }
  if (f?.kind === 'friction' && f.value === 'fewer_ingredients') {
    return {
      ...BASE,
      ingredients: ['Leftover rice', 'Black beans', 'Bell pepper', 'Onion', 'Corn'],
      emphasis: 'Five ingredients',
    };
  }
  if (f?.kind === 'friction' && f.value === 'less_cleanup') {
    return { ...BASE, emphasis: 'One pan to wash' };
  }
  if (f?.kind === 'friction' && f.value === 'needs_substitutions') {
    return { ...BASE, emphasis: 'No avocado? Swap in a spoon of yoghurt or skip it.' };
  }
  if (f?.kind === 'spoilFirst') {
    const label: Record<string, string> = {
      produce: 'Uses the pepper, onion and tomato first',
      leftovers: 'Built around the leftover rice',
      protein: 'Beans stand in for the protein here',
      opened: 'Finishes the opened tin of corn',
    };
    return { ...BASE, emphasis: label[f.value] };
  }
  if (answers.recipePriority === 'lowest_cost') {
    return { ...BASE, emphasis: 'Cheapest realistic version' };
  }
  if (answers.recipePriority === 'fewest_ingredients') {
    return {
      ...BASE,
      ingredients: ['Leftover rice', 'Black beans', 'Bell pepper', 'Onion', 'Corn'],
      emphasis: 'Fewest ingredients',
    };
  }
  return BASE;
}

/** Chips shown over the placeholder photo. Honest about what is a guess. */
export type ExampleChip = { label: string; certain: boolean };

export const EXAMPLE_CHIPS: ExampleChip[] = [
  { label: 'rice', certain: true },
  { label: 'black beans', certain: true },
  { label: 'onion', certain: true },
  { label: 'pepper?', certain: false },
];
