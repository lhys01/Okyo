// Dynamic, answer-driven copy for the Hit my macros branch. Pure functions so
// the insight / response / approach / reveal screens and their tests share one
// source of truth. No medical or clinical claims and no invented targets —
// every line restates a user preference and how Okyo will use it.
import type {
  CalorieTrackingStatus,
  MacroBarrierId,
  MacroCommitmentId,
  MacroFocusId,
  MacrosDraft,
  MacrosMealToImproveId,
  TrackingStyleId,
} from './macrosBranch';

export const MACRO_FOCUS_LABELS: Record<MacroFocusId, string> = {
  more_protein: 'More protein',
  fewer_calories: 'Fewer calories',
  more_balanced_macros: 'More balanced macros',
  better_workout_fuel: 'Better workout fuel',
  maintain: 'Maintain where I am',
  not_sure: 'I am not sure yet',
};

export const CALORIE_STATUS_LABELS: Record<CalorieTrackingStatus, string> = {
  yes_has_target: 'I have a calorie target',
  sometimes: 'I track calories sometimes',
  no: 'I do not track calories',
  not_sure: 'Not sure yet',
};

export const MACRO_BARRIER_LABELS: Record<MacroBarrierId, string> = {
  estimating_portions: 'Estimating portions',
  getting_enough_protein: 'Getting enough protein',
  inaccurate_nutrition: 'Nutrition numbers I cannot trust',
  doesnt_taste_good: 'Food that does not taste good',
  meal_prep_time: 'Meal prep takes too long',
  staying_consistent: 'Staying consistent',
  dont_know_targets: 'I do not know my targets',
};

export const MACRO_MEAL_LABELS: Record<MacrosMealToImproveId, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  it_varies: 'It varies',
};

export const TRACKING_STYLE_LABELS: Record<TrackingStyleId, string> = {
  exact_numbers: 'Exact numbers',
  flexible_ranges: 'Flexible ranges',
  simple_suggestions: 'Simple suggestions',
  just_show_info: 'Just show the information',
};

export const MACRO_COMMITMENT_LABELS: Record<MacroCommitmentId, string> = {
  few_aligned_meals: 'A few meals that hit my targets each week',
  most_days: 'Stay close most days',
  ease_in: 'I want to ease in gradually',
  not_sure: 'I am not sure yet',
};

// Screen: focus insight.
const FOCUS_INSIGHT: Record<MacroFocusId, string> = {
  more_protein: 'We’ll keep protein front and center without turning every meal into a shake.',
  fewer_calories: 'We’ll help you find lighter versions of the food you already eat.',
  more_balanced_macros: 'We’ll look at the whole plate, not just one number.',
  better_workout_fuel: 'We’ll match meals to how you train, not a generic template.',
  maintain: 'We’ll help you keep what’s already working, with less guesswork.',
  not_sure: 'We’ll start simple and let your choices sharpen the plan over time.',
};
export function focusInsightBody(focus: MacroFocusId | null): string {
  return focus ? FOCUS_INSIGHT[focus] : FOCUS_INSIGHT.not_sure;
}

// Screen: calorie insight.
const CALORIE_INSIGHT: Record<CalorieTrackingStatus, string> = {
  yes_has_target: 'We’ll work within the target you already use.',
  sometimes: 'We’ll keep calories in view without making them the whole picture.',
  no: 'No problem—we’ll focus on protein and balance instead of a calorie count.',
  not_sure: 'We’ll keep it flexible and let you add a calorie target later if you want one.',
};
export function calorieInsightBody(status: CalorieTrackingStatus | null): string {
  return status ? CALORIE_INSIGHT[status] : CALORIE_INSIGHT.not_sure;
}

// Screen: barrier response.
const BARRIER_RESPONSE: Record<MacroBarrierId, { title: string; body: string }> = {
  estimating_portions: {
    title: 'Portions get easier with reference points.',
    body: 'Okyo will show portions in plain terms so you’re not guessing by eye.',
  },
  getting_enough_protein: {
    title: 'We’ll make protein the easy default.',
    body: 'Okyo will lean toward protein-forward recipes and simple swaps that add grams.',
  },
  inaccurate_nutrition: {
    title: 'We’ll keep the numbers honest.',
    body: 'Okyo shows nutrition as an estimate, with room to adjust when something looks off.',
  },
  doesnt_taste_good: {
    title: 'Hitting macros should still taste good.',
    body: 'We’ll keep flavor and the foods you enjoy in every suggestion.',
  },
  meal_prep_time: {
    title: 'We’ll keep prep realistic.',
    body: 'Okyo will prioritize shorter recipes and meals that repeat well.',
  },
  staying_consistent: {
    title: 'Consistency beats perfect.',
    body: 'We’ll build an approach that survives an off day instead of collapsing.',
  },
  dont_know_targets: {
    title: 'You don’t need targets to start.',
    body: 'Okyo works from your preferences now, and you can set numbers whenever you want.',
  },
};
export function barrierResponse(barrier: MacroBarrierId | null): { title: string; body: string } {
  return barrier ? BARRIER_RESPONSE[barrier] : BARRIER_RESPONSE.dont_know_targets;
}

// Screen: meal insight.
const MEAL_INSIGHT: Record<MacrosMealToImproveId, string> = {
  breakfast: 'We’ll help you start the day with protein-forward, repeatable options.',
  lunch: 'We’ll focus on lunches that are quick to build and easy to keep aligned.',
  dinner: 'We’ll make dinner hit your targets without a lot of extra effort.',
  snacks: 'We’ll help you find snacks that add protein instead of just calories.',
  it_varies: 'We’ll keep the plan flexible so it works across your whole day.',
};
export function mealInsightBody(meal: MacrosMealToImproveId | null): string {
  return meal ? MEAL_INSIGHT[meal] : MEAL_INSIGHT.it_varies;
}

const FOCUS_PHRASE: Record<MacroFocusId, string> = {
  more_protein: 'More protein at',
  fewer_calories: 'Lighter',
  more_balanced_macros: 'More balanced',
  better_workout_fuel: 'Better-fueled',
  maintain: 'Steady',
  not_sure: 'Simpler',
};
const MEAL_PLURAL: Record<MacrosMealToImproveId, string> = {
  breakfast: 'breakfasts',
  lunch: 'lunches',
  dinner: 'dinners',
  snacks: 'snacks',
  it_varies: 'meals',
};
const TRACKING_QUALIFIER: Record<TrackingStyleId, string> = {
  exact_numbers: ', with the exact numbers shown',
  flexible_ranges: ', tracked in simple ranges',
  simple_suggestions: ', with simple suggestions instead of math',
  just_show_info: ', with the nutrition kept in the background',
};
function mealPlural(meal: MacrosMealToImproveId | null): string {
  return meal ? MEAL_PLURAL[meal] : 'meals';
}

// Screen: personalized approach headline.
export function approachHeadline(draft: Pick<MacrosDraft, 'macroFocus' | 'mealToImprove' | 'trackingStyle'>): string {
  const phrase = draft.macroFocus ? FOCUS_PHRASE[draft.macroFocus] : FOCUS_PHRASE.not_sure;
  const meal = mealPlural(draft.mealToImprove);
  const qualifier = draft.trackingStyle ? TRACKING_QUALIFIER[draft.trackingStyle] : '';
  return `${phrase} ${meal}${qualifier}.`;
}

const FOCUS_START: Record<MacroFocusId, string> = {
  more_protein: 'More-protein',
  fewer_calories: 'Lighter',
  more_balanced_macros: 'More balanced',
  better_workout_fuel: 'Better-fueled',
  maintain: 'Steady',
  not_sure: 'Simpler',
};

// Screens: reveal card + plan summary "Start with".
export function startingPointValue(
  draft: Pick<MacrosDraft, 'macroFocus' | 'mealToImprove' | 'flexibleCommitment'>,
  options: { lowercase?: boolean } = {},
): string {
  const gradual = draft.flexibleCommitment === 'most_days' || draft.flexibleCommitment === 'ease_in' || draft.flexibleCommitment === 'not_sure';
  const raw = gradual
    ? 'Small steps toward your targets'
    : `${draft.macroFocus ? FOCUS_START[draft.macroFocus] : FOCUS_START.not_sure} ${mealPlural(draft.mealToImprove)}`;
  return options.lowercase ? raw.charAt(0).toLowerCase() + raw.slice(1) : raw;
}

const FOCUS_VERB: Record<MacroFocusId, string> = {
  more_protein: 'get more protein into your',
  fewer_calories: 'lighten your',
  more_balanced_macros: 'balance your',
  better_workout_fuel: 'fuel your',
  maintain: 'steady your',
  not_sure: 'tune your everyday',
};
const BARRIER_CLAUSE: Record<MacroBarrierId, string> = {
  estimating_portions: 'make portions easier to judge',
  getting_enough_protein: 'make protein the default',
  inaccurate_nutrition: 'keep the numbers honest',
  doesnt_taste_good: 'keep flavor front and center',
  meal_prep_time: 'keep prep short',
  staying_consistent: 'make it easier to stay consistent',
  dont_know_targets: 'work from your preferences, not required targets',
};
const TRACKING_CLAUSE: Record<TrackingStyleId, string> = {
  exact_numbers: 'show the exact grams when you want them',
  flexible_ranges: 'keep tracking to simple ranges',
  simple_suggestions: 'give simple suggestions instead of math',
  just_show_info: 'keep the nutrition in the background',
};

// Screen: reveal — the truthful, answer-driven summary sentence.
export function revealSummary(
  draft: Pick<MacrosDraft, 'macroFocus' | 'macroBarrier' | 'mealToImprove' | 'trackingStyle'>,
): string {
  const focusVerb = draft.macroFocus ? FOCUS_VERB[draft.macroFocus] : FOCUS_VERB.not_sure;
  const meal = mealPlural(draft.mealToImprove);
  const barrier = draft.macroBarrier ? BARRIER_CLAUSE[draft.macroBarrier] : BARRIER_CLAUSE.dont_know_targets;
  const tracking = draft.trackingStyle ? TRACKING_CLAUSE[draft.trackingStyle] : 'keep tracking simple';
  return `We’ll help you ${focusVerb} ${meal}, ${barrier}, and ${tracking}.`;
}

/** Screen: plan summary — the three rows. */
export function planSummaryRows(
  draft: Pick<MacrosDraft, 'macroFocus' | 'macroBarrier' | 'mealToImprove' | 'trackingStyle'>,
): { id: string; label: string; value: string }[] {
  const rows: { id: string; label: string; value: string }[] = [];
  if (draft.macroFocus) rows.push({ id: 'focus', label: 'Focused on', value: MACRO_FOCUS_LABELS[draft.macroFocus] });
  if (draft.macroBarrier) rows.push({ id: 'barrier', label: 'Biggest barrier', value: MACRO_BARRIER_LABELS[draft.macroBarrier] });
  if (draft.mealToImprove) rows.push({ id: 'meal', label: 'Hardest meal', value: MACRO_MEAL_LABELS[draft.mealToImprove] });
  else if (draft.trackingStyle) rows.push({ id: 'tracking', label: 'Tracking style', value: TRACKING_STYLE_LABELS[draft.trackingStyle] });
  return rows.slice(0, 3);
}

/** Protein preference line for the reveal card — a preference, never advice. */
export function proteinPreferenceLine(draft: Pick<MacrosDraft, 'proteinTargetGrams'>): string {
  return draft.proteinTargetGrams ? `${draft.proteinTargetGrams}g protein a day` : 'Protein kept flexible';
}
