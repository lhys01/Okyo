// Direction C onboarding — shared answer + preference types.
// RN-free on purpose: node:test loads this directly.

export type RecipePriorityAnswer = 'speed' | 'fewest_ingredients' | 'lowest_cost';

export type Problem =
  | 'decision_help'
  | 'ingredient_flexibility'
  | 'less_effort'
  | 'use_food_first'
  | 'save_time';

export type FrictionDetail =
  | 'random_ingredients'
  | 'low_energy'
  | 'cooking_for_others'
  | 'needs_substitutions'
  | 'mark_optional'
  | 'avoid_extra_shopping'
  | 'fewer_ingredients'
  | 'fewer_steps'
  | 'clearer_instructions'
  | 'less_cleanup';

export type SpoilFirst = 'produce' | 'leftovers' | 'protein' | 'opened';
export type MaxMinutes = 15 | 30 | 45;
export type Guidance = 'step_by_step' | 'light' | 'essentials';
export type DietPattern = 'vegetarian' | 'vegan';
export type Avoid = 'gluten' | 'dairy' | 'nuts';

/** One follow-up answer. Exactly one branch's shape is present. */
export type FollowUpAnswer =
  | { kind: 'friction'; value: FrictionDetail }
  | { kind: 'spoilFirst'; value: SpoilFirst }
  | { kind: 'maxMinutes'; value: MaxMinutes }
  | { kind: 'maxMinutesUnknown' }
  | { kind: 'servings'; value: 2 | 4 };

export type OnboardingAnswers = {
  problem?: Problem;
  followUp?: FollowUpAnswer;
  guidance?: Guidance;
  dietPattern?: DietPattern;
  avoid?: Avoid[];
  recipePriority?: RecipePriorityAnswer;
};

/** Mirrors the API's optional `preferences` object. Every field a closed enum. */
export type ScanPreferences = {
  priority?: Problem;
  frictionDetail?: FrictionDetail;
  spoilFirst?: SpoilFirst;
  maxMinutes?: MaxMinutes;
  servings?: 2 | 4;
  dietPattern?: DietPattern;
  avoid?: Avoid[];
  guidance?: Guidance;
  recipePriority?: RecipePriorityAnswer;
};
