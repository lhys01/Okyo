// Dynamic, answer-driven copy for the Eat Healthier branch. Pure functions so
// the insight/response/approach/reveal screens and their tests share one source
// of truth. No medical claims, no invented metrics — every line is a plain
// restatement of what the user chose and how Okyo will use it.
import type {
  HealthBarrierId,
  HealthCommitmentId,
  HealthDefinitionId,
  HealthDraft,
  FoodStyleId,
  MealToImproveId,
} from './healthBranch';

export const HEALTH_DEFINITION_LABELS: Record<HealthDefinitionId, string> = {
  more_balanced_meals: 'More balanced meals',
  more_whole_foods: 'More whole foods',
  more_vegetables_fruit: 'More vegetables and fruit',
  more_energy: 'More energy',
  better_portions: 'Better portions',
  less_takeout: 'Less takeout',
  something_else: 'Something else',
};

export const HEALTH_BARRIER_LABELS: Record<HealthBarrierId, string> = {
  not_enough_time: 'I do not have enough time',
  too_expensive: 'Healthy food feels too expensive',
  dont_know_what_to_cook: 'I do not know what to cook',
  feels_boring: 'Healthy meals feel boring',
  struggle_consistency: 'I struggle to stay consistent',
  too_hungry_tired: 'I am usually too hungry or tired',
  something_else: 'Something else',
};

export const MEAL_TO_IMPROVE_LABELS: Record<MealToImproveId, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  it_varies: 'It varies',
};

export const FOOD_STYLE_LABELS: Record<FoodStyleId, string> = {
  comfort_food: 'Comfort food',
  fresh_colorful: 'Fresh and colorful',
  high_protein: 'High-protein meals',
  quick_simple: 'Quick and simple',
  international: 'International flavors',
  a_bit_of_everything: 'A little bit of everything',
};

export const HEALTH_COMMITMENT_LABELS: Record<HealthCommitmentId, string> = {
  few_meals_weekly: 'A few healthier meals each week',
  small_changes_daily: 'Small changes most days',
  improve_gradually: 'I want to improve gradually',
  not_sure: 'I am not sure yet',
};

// Screen 3 — personalized insight after "what healthier means".
const MEANING_INSIGHT: Record<HealthDefinitionId, string> = {
  more_balanced_meals: 'We’ll help you build meals that feel satisfying and well-rounded.',
  more_whole_foods: 'We’ll make it easier to add nourishing ingredients without making meals boring.',
  more_vegetables_fruit: 'We’ll find simple ways to add more color and variety to your meals.',
  more_energy: 'We’ll focus on meals that feel satisfying and support your everyday routine.',
  better_portions: 'We’ll help you find portions that feel comfortable—not restrictive.',
  less_takeout: 'We’ll find easy homemade options for the meals you usually order.',
  something_else: 'We’ll shape your recipes and suggestions around what matters most to you.',
};
export function meaningInsightBody(definition: HealthDefinitionId | null): string {
  return definition ? MEANING_INSIGHT[definition] : MEANING_INSIGHT.something_else;
}

// Screen 5 — response to the biggest obstacle.
const BARRIER_RESPONSE: Record<HealthBarrierId, { title: string; body: string }> = {
  not_enough_time: {
    title: 'We’ll keep it practical.',
    body: 'Okyo will prioritize simple recipes, shorter prep, and meals that fit busy days.',
  },
  too_expensive: {
    title: 'Healthy does not have to be expensive.',
    body: 'We’ll look for affordable ingredients and flexible recipes that make sense for your budget.',
  },
  dont_know_what_to_cook: {
    title: 'You do not have to figure it out alone.',
    body: 'Okyo will turn your ideas and ingredients into clear recipes you can actually follow.',
  },
  feels_boring: {
    title: 'Healthy food should still be exciting.',
    body: 'We’ll keep flavor, variety, and the foods you enjoy at the center.',
  },
  struggle_consistency: {
    title: 'Small changes are easier to keep.',
    body: 'We’ll help you build an approach that is flexible instead of all-or-nothing.',
  },
  too_hungry_tired: {
    title: 'We’ll keep meals filling.',
    body: 'Okyo will lean toward satisfying portions and simple recipes for the days you’re running low.',
  },
  something_else: {
    title: 'We’ll work with your real life.',
    body: 'Okyo adapts recipes and suggestions to the parts of cooking that get in your way.',
  },
};
export function barrierResponse(barrier: HealthBarrierId | null): { title: string; body: string } {
  return barrier ? BARRIER_RESPONSE[barrier] : BARRIER_RESPONSE.something_else;
}

// Screen 7 — meal-specific insight.
const MEAL_INSIGHT: Record<MealToImproveId, string> = {
  breakfast: 'We’ll help you start the day with easier, more satisfying options.',
  lunch: 'We’ll focus on lunches that are practical, filling, and easy to repeat.',
  dinner: 'We’ll make dinner feel more balanced without making it feel like work.',
  snacks: 'We’ll help you find snacks that fit your hunger and your routine.',
  it_varies: 'We’ll keep the plan flexible so it can work across your whole day.',
};
export function mealInsightBody(meal: MealToImproveId | null): string {
  return meal ? MEAL_INSIGHT[meal] : MEAL_INSIGHT.it_varies;
}

const MEANING_PHRASE: Record<HealthDefinitionId, string> = {
  more_balanced_meals: 'More balanced',
  more_whole_foods: 'More whole foods in your',
  more_vegetables_fruit: 'More color and variety in your',
  more_energy: 'More satisfying',
  better_portions: 'Right-sized',
  less_takeout: 'More homemade',
  something_else: 'Better everyday',
};
const MEAL_PLURAL: Record<MealToImproveId, string> = {
  breakfast: 'breakfasts',
  lunch: 'lunches',
  dinner: 'dinners',
  snacks: 'snacks',
  it_varies: 'meals',
};
const BARRIER_QUALIFIER: Record<HealthBarrierId, string> = {
  not_enough_time: ', without complicated recipes',
  too_expensive: ', on an everyday budget',
  dont_know_what_to_cook: ', with recipes you can follow',
  feels_boring: ', without losing flavor',
  struggle_consistency: ', in steps you can keep',
  too_hungry_tired: ', that still fill you up',
  something_else: '',
};
function mealPlural(meal: MealToImproveId | null): string {
  return meal ? MEAL_PLURAL[meal] : 'meals';
}

// Screen 10 — the approach headline, composed from every answer.
export function approachHeadline(draft: Pick<HealthDraft, 'healthDefinition' | 'healthBarrier' | 'mealToImprove' | 'foodStyles'>): string {
  const phrase = draft.healthDefinition ? MEANING_PHRASE[draft.healthDefinition] : MEANING_PHRASE.something_else;
  const meal = mealPlural(draft.mealToImprove);
  let qualifier = draft.healthBarrier ? BARRIER_QUALIFIER[draft.healthBarrier] : '';
  if (!qualifier && draft.foodStyles.includes('comfort_food')) qualifier = ', without giving up comfort food';
  return `${phrase} ${meal}${qualifier}.`;
}

const MEANING_START: Record<HealthDefinitionId, string> = {
  more_balanced_meals: 'More balanced',
  more_whole_foods: 'More nourishing',
  more_vegetables_fruit: 'More colorful',
  more_energy: 'More satisfying',
  better_portions: 'Right-sized',
  less_takeout: 'More homemade',
  something_else: 'Easier',
};

// Screens 13 & 14 — the coral commitment card value.
export function startingPointValue(
  draft: Pick<HealthDraft, 'healthDefinition' | 'mealToImprove' | 'flexibleCommitment'>,
  options: { lowercase?: boolean } = {},
): string {
  const gradual = draft.flexibleCommitment === 'small_changes_daily' || draft.flexibleCommitment === 'improve_gradually' || draft.flexibleCommitment === 'not_sure';
  const raw = gradual
    ? 'Small changes that fit your routine'
    : `${draft.healthDefinition ? MEANING_START[draft.healthDefinition] : MEANING_START.something_else} ${mealPlural(draft.mealToImprove)}`;
  return options.lowercase ? raw.charAt(0).toLowerCase() + raw.slice(1) : raw;
}

const BARRIER_CLAUSE: Record<HealthBarrierId, string> = {
  not_enough_time: 'keep things practical when time is tight',
  too_expensive: 'find options that fit your budget',
  dont_know_what_to_cook: 'turn your ideas into clear recipes',
  feels_boring: 'keep flavor and variety front and center',
  struggle_consistency: 'make it easier to stay consistent',
  too_hungry_tired: 'keep portions filling',
  something_else: 'work around what gets in your way',
};
const STYLE_CLAUSE: Record<FoodStyleId, string> = {
  comfort_food: 'keep room for the comfort food you love',
  fresh_colorful: 'lean into fresh, colorful plates',
  high_protein: 'keep protein at the center',
  quick_simple: 'stick to quick, simple cooking',
  international: 'keep global flavors in the mix',
  a_bit_of_everything: 'keep plenty of variety',
};
const MEANING_VERB: Record<HealthDefinitionId, string> = {
  more_balanced_meals: 'make more balanced',
  more_whole_foods: 'add more whole foods to your',
  more_vegetables_fruit: 'add more color to your',
  more_energy: 'build more satisfying',
  better_portions: 'find comfortable portions for your',
  less_takeout: 'cook more of your',
  something_else: 'improve your everyday',
};

// Screen 13 — the truthful, answer-driven summary sentence.
export function revealSummary(
  draft: Pick<HealthDraft, 'healthDefinition' | 'healthBarrier' | 'mealToImprove' | 'foodStyles'>,
): string {
  const meaningVerb = draft.healthDefinition ? MEANING_VERB[draft.healthDefinition] : MEANING_VERB.something_else;
  const meal = mealPlural(draft.mealToImprove);
  const barrier = draft.healthBarrier ? BARRIER_CLAUSE[draft.healthBarrier] : BARRIER_CLAUSE.something_else;
  const style = draft.foodStyles.length ? STYLE_CLAUSE[draft.foodStyles[0]] : 'choose recipes that still match the food you enjoy';
  return `We’ll help you ${meaningVerb} ${meal}, ${barrier}, and ${style}.`;
}

/** Screen 14 — the three plan-summary rows. */
export function planSummaryRows(
  draft: Pick<HealthDraft, 'healthDefinition' | 'healthBarrier' | 'mealToImprove' | 'foodStyles'>,
): { id: string; label: string; value: string }[] {
  const rows: { id: string; label: string; value: string }[] = [];
  if (draft.healthDefinition) rows.push({ id: 'meaning', label: 'Healthier means', value: HEALTH_DEFINITION_LABELS[draft.healthDefinition] });
  if (draft.healthBarrier) rows.push({ id: 'barrier', label: 'Biggest barrier', value: HEALTH_BARRIER_LABELS[draft.healthBarrier] });
  if (draft.mealToImprove) rows.push({ id: 'meal', label: 'Starting with', value: MEAL_TO_IMPROVE_LABELS[draft.mealToImprove] });
  else if (draft.foodStyles.length) rows.push({ id: 'style', label: 'Food you enjoy', value: draft.foodStyles.map((s) => FOOD_STYLE_LABELS[s]).join(', ') });
  return rows.slice(0, 3);
}
