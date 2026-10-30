// Question + option data for the Direction C onboarding.
// Every option maps to a closed enum that reaches the recipe prompt or a named UI consumer.

import type {
  Avoid, FollowUpAnswer, Guidance, Problem, RecipePriorityAnswer,
} from './types';

export type Option<T> = { id: string; label: string; value: T; detail?: string };

export const PROBLEM_QUESTION = 'What usually gets in the way of cooking?';

export const PROBLEM_OPTIONS: Option<Problem>[] = [
  { id: 'p1', label: 'I don’t know what to make', value: 'decision_help' },
  { id: 'p2', label: 'I’m missing ingredients', value: 'ingredient_flexibility' },
  { id: 'p3', label: 'Recipes take too much effort', value: 'less_effort' },
  { id: 'p4', label: 'Food goes unused', value: 'use_food_first' },
  { id: 'p5', label: 'I don’t have enough time', value: 'save_time' },
];

export type FollowUpBranch = { question: string; options: Option<FollowUpAnswer>[] };

export const FOLLOW_UPS: Record<Problem, FollowUpBranch> = {
  decision_help: {
    question: 'When is it hardest to decide?',
    options: [
      { id: 'd1', label: 'When the fridge looks random', value: { kind: 'friction', value: 'random_ingredients' } },
      { id: 'd2', label: 'After a long day', value: { kind: 'friction', value: 'low_energy' } },
      { id: 'd3', label: 'When I’m cooking for other people', value: { kind: 'servings', value: 4 } },
    ],
  },
  ingredient_flexibility: {
    question: 'What would help most when something’s missing?',
    options: [
      { id: 'i1', label: 'Suggest a substitute', value: { kind: 'friction', value: 'needs_substitutions' } },
      { id: 'i2', label: 'Mark it optional', value: { kind: 'friction', value: 'mark_optional' } },
      { id: 'i3', label: 'Skip recipes that need a store run', value: { kind: 'friction', value: 'avoid_extra_shopping' } },
    ],
  },
  less_effort: {
    question: 'What makes a recipe feel like too much?',
    options: [
      { id: 'e1', label: 'Too many ingredients', value: { kind: 'friction', value: 'fewer_ingredients' } },
      { id: 'e2', label: 'Too many steps', value: { kind: 'friction', value: 'fewer_steps' } },
      { id: 'e3', label: 'Instructions I can’t follow', value: { kind: 'friction', value: 'clearer_instructions' } },
      { id: 'e4', label: 'Too much cleanup', value: { kind: 'friction', value: 'less_cleanup' } },
    ],
  },
  use_food_first: {
    question: 'What do you most want to use up?',
    options: [
      { id: 'u1', label: 'Produce', value: { kind: 'spoilFirst', value: 'produce' } },
      { id: 'u2', label: 'Leftovers', value: { kind: 'spoilFirst', value: 'leftovers' } },
      { id: 'u3', label: 'Meat or fish', value: { kind: 'spoilFirst', value: 'protein' } },
      { id: 'u4', label: 'Anything already opened', value: { kind: 'spoilFirst', value: 'opened' } },
    ],
  },
  save_time: {
    question: 'How much time do you usually have?',
    options: [
      { id: 't1', label: 'Under 15 minutes', value: { kind: 'maxMinutes', value: 15 } },
      { id: 't2', label: '15–30 minutes', value: { kind: 'maxMinutes', value: 30 } },
      { id: 't3', label: '30–45 minutes', value: { kind: 'maxMinutes', value: 45 } },
      { id: 't4', label: 'It depends', value: { kind: 'maxMinutesUnknown' } },
    ],
  },
};

export const GUIDANCE_QUESTION = 'How much guidance do you want?';

/** `bars` drives the visual density indicator — 6 slots, N filled. */
export const GUIDANCE_OPTIONS: (Option<Guidance> & { bars: number })[] = [
  { id: 'g1', label: 'Guide me step by step', value: 'step_by_step', bars: 6 },
  { id: 'g2', label: 'Give me a little help', value: 'light', bars: 3 },
  { id: 'g3', label: 'Just give me the essentials', value: 'essentials', bars: 1 },
];

export const AVOID_OPTIONS: Option<Avoid>[] = [
  { id: 'a1', label: 'Gluten', value: 'gluten' },
  { id: 'a2', label: 'Dairy', value: 'dairy' },
  { id: 'a3', label: 'Nuts', value: 'nuts' },
];

export const RECIPE_PRIORITY_QUESTION = 'One more thing — what matters most?';

export const RECIPE_PRIORITY_OPTIONS: Option<RecipePriorityAnswer>[] = [
  { id: 'r1', label: 'Speed', value: 'speed', detail: 'Get it on the table fast' },
  { id: 'r2', label: 'Fewest ingredients', value: 'fewest_ingredients', detail: 'Work with less, buy nothing' },
  { id: 'r3', label: 'Lowest cost', value: 'lowest_cost', detail: 'Cheapest realistic version' },
];

export const OVERVIEW_STEPS = [
  'Scan what you have',
  'Get one realistic recipe',
  'Cook it simply',
  'Use what you own first',
];
