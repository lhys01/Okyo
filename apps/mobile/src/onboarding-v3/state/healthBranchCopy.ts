// Answer-derived copy only: preferences are not medical causes or promises.
import type { HealthBarrierId, HealthCommitmentId, HealthDefinitionId, HealthDraft, FoodStyleId, MealToImproveId, HealthProblemId, CookingFrequencyId, MealPriorityId } from './healthBranch';

export const HEALTH_PROBLEM_LABELS: Record<HealthProblemId, string> = {
  too_much_takeout: 'Too much takeout', meals_unbalanced: 'Meals feel unbalanced',
  not_enough_whole_foods: 'Not enough whole foods', portions_off: 'Portions feel off',
  low_energy: 'Low energy', eating_inconsistent: 'Eating feels inconsistent',
};
export const HEALTH_DEFINITION_LABELS: Record<HealthDefinitionId, string> = {
  more_balanced_meals: 'More balanced meals', more_whole_foods: 'More whole foods',
  more_vegetables_fruit: 'More fruits and vegetables', more_energy: 'More energy',
  better_portions: 'Better portions', less_takeout: 'Less takeout',
};
export const HEALTH_BARRIER_LABELS: Record<HealthBarrierId, string> = {
  not_enough_time: 'Not enough time', too_expensive: 'Costs too much',
  dont_know_what_to_cook: 'Unsure what to cook', feels_boring: 'Healthy food feels boring',
  struggle_consistency: 'Hard to stay consistent', too_hungry_tired: 'Too hungry or tired',
};
export const MEAL_TO_IMPROVE_LABELS: Record<MealToImproveId, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks', it_varies: 'It varies',
};
export const COOKING_FREQUENCY_LABELS: Record<CookingFrequencyId, string> = {
  almost_never: 'Almost never', one_to_two_week: '1–2 times a week', three_to_four_week: '3–4 times a week',
  five_to_six_week: '5–6 times a week', every_day: 'Every day',
};
export const MEAL_PRIORITY_LABELS: Record<MealPriorityId, string> = {
  tastes_good: 'Tastes good', quick_to_make: 'Quick to make', keeps_me_full: 'Keeps me full',
  costs_less: 'Costs less', simple_ingredients: 'Simple ingredients',
};
export const FOOD_STYLE_LABELS: Record<FoodStyleId, string> = {
  comfort_food: 'Comfort food', fresh_colorful: 'Fresh and colorful', high_protein: 'High-protein meals',
  quick_simple: 'Quick and simple', international: 'International flavors', a_bit_of_everything: 'A little of everything',
};
export const HEALTH_COMMITMENT_LABELS: Record<HealthCommitmentId, string> = {
  most_meals_healthier: 'Make most meals healthier', one_meal_daily: 'One healthier meal a day',
  few_meals_weekly: 'A few healthier meals weekly', small_changes_days: 'Small changes a few days',
  one_change_at_a_time: 'One change at a time',
};
const PROBLEM_PHRASE: Record<HealthProblemId, string> = {
  too_much_takeout: 'too much takeout', meals_unbalanced: 'meals feeling unbalanced',
  not_enough_whole_foods: 'not enough whole foods', portions_off: 'portions feeling off',
  low_energy: 'low energy', eating_inconsistent: 'inconsistent eating',
};
const BARRIER_PHRASE: Record<HealthBarrierId, string> = {
  not_enough_time: 'not enough time', too_expensive: 'the cost',
  dont_know_what_to_cook: 'being unsure what to cook', feels_boring: 'healthy food feeling boring',
  struggle_consistency: 'difficulty staying consistent', too_hungry_tired: 'feeling too hungry or tired',
};
const BARRIER_EMPATHY: Record<HealthBarrierId, string> = {
  not_enough_time: 'Finding time is hard.',
  too_expensive: 'Eating well can get expensive.',
  dont_know_what_to_cook: 'Knowing what to cook can be hard.',
  feels_boring: 'Food should still feel enjoyable.',
  struggle_consistency: 'Staying consistent can be hard.',
  too_hungry_tired: 'Hungry or tired days can be hard.',
};
const MEAL_PLURAL: Record<MealToImproveId, string> = {
  breakfast: 'breakfasts', lunch: 'lunches', dinner: 'dinners', snacks: 'snacks', it_varies: 'meals',
};
function mealPlural(meal: MealToImproveId | null): string { return meal ? MEAL_PLURAL[meal] : 'meals'; }
function mealSingular(meal: MealToImproveId | null): string { return !meal || meal === 'it_varies' ? 'meals across your day' : meal; }

export function problemDiagnosisHeadline(meal: MealToImproveId | null): string {
  if (!meal || meal === 'it_varies') return 'You want changes across your day.';
  if (meal === 'snacks') return 'Snacks are where you want the biggest change.';
  return `${MEAL_TO_IMPROVE_LABELS[meal]} is where you want the biggest change.`;
}
export function problemAcknowledgement(barrier: HealthBarrierId | null): { title: string; body: string } {
  return {
    title: barrier ? BARRIER_EMPATHY[barrier] : 'Healthy eating can feel like a lot.',
    body: 'You don’t need a perfect routine. We’ll keep the next steps practical and close to the food you already enjoy.',
  };
}
export function problemDiagnosisBody(draft: Pick<HealthDraft, 'healthProblem' | 'healthBarrier' | 'mealToImprove' | 'cookingFrequency'>): string {
  const problem = draft.healthProblem ? PROBLEM_PHRASE[draft.healthProblem] : 'your eating routine';
  const barrier = draft.healthBarrier ? BARRIER_PHRASE[draft.healthBarrier] : 'your current challenges';
  const baseline = draft.cookingFrequency === 'almost_never' ? 'you almost never cook'
    : draft.cookingFrequency ? `you cook ${COOKING_FREQUENCY_LABELS[draft.cookingFrequency].toLowerCase()}` : 'you want a manageable start';
  return `You said ${problem} is the main issue, and ${barrier} gets in the way. Since ${baseline}, we'll start by making ${mealSingular(draft.mealToImprove)} easier.`;
}
const PRIORITY_ACTION: Record<MealPriorityId, string> = {
  tastes_good: 'keeping flavor in the mix', quick_to_make: 'keeping it quick to make', keeps_me_full: 'keeping it filling',
  costs_less: 'keeping costs down', simple_ingredients: 'keeping ingredients simple',
};
export function solutionHeadline(definition: HealthDefinitionId | null, meal: MealToImproveId | null, priority: MealPriorityId | null): string {
  const goal = definition ? HEALTH_DEFINITION_LABELS[definition] : 'A healthier routine';
  return `${goal}, starting with easier homemade ${mealPlural(meal)}.`;
}
export function solutionSupport(meal: MealToImproveId | null, priority: MealPriorityId | null): string {
  const priorityAction = priority ? PRIORITY_ACTION[priority] : 'fitting your routine';
  return `Scan or describe a dish. Okyo gives you the recipe, then helps make ${mealSingular(meal)} easier while ${priorityAction}.`;
}
const STYLE_TAIL: Record<FoodStyleId, string> = {
  comfort_food: 'still comfort food', fresh_colorful: 'with fresh, colorful ingredients',
  high_protein: 'with protein at the center', quick_simple: 'while keeping it quick and simple',
  international: 'with global flavors in the mix', a_bit_of_everything: 'with plenty of variety',
};
function commitmentStart(commitment: HealthCommitmentId | null, meal: MealToImproveId | null): string {
  const singular = meal && meal !== 'it_varies' ? meal : 'meal';
  const plural = mealPlural(meal);
  if (commitment === 'most_meals_healthier') return `more homemade ${plural}`;
  if (commitment === 'one_meal_daily') return `one easier homemade ${singular} a day`;
  if (commitment === 'few_meals_weekly') return `a few easier homemade ${plural} each week`;
  if (commitment === 'small_changes_days') return `small changes to homemade ${plural} a few days a week`;
  if (commitment === 'one_change_at_a_time') return `one easier homemade ${singular} at a time`;
  return `easier homemade ${plural}`;
}
export function revealSummary(draft: Pick<HealthDraft, 'healthDefinition' | 'mealToImprove' | 'foodStyles' | 'flexibleCommitment'>): string {
  const start = commitmentStart(draft.flexibleCommitment, draft.mealToImprove);
  const goal = draft.healthDefinition ? HEALTH_DEFINITION_LABELS[draft.healthDefinition].toLowerCase() : 'a healthier routine';
  const style = draft.foodStyles.length ? STYLE_TAIL[draft.foodStyles[0]] : 'around the food you enjoy';
  return `Start with ${start} — ${goal}, ${style}.`;
}
export function planSummaryRows(draft: HealthDraft): { id: string; label: string; value: string }[] {
  return [
    { id: 'problem', label: 'Your main challenge', value: draft.healthProblem ? HEALTH_PROBLEM_LABELS[draft.healthProblem] : 'Not yet specified' },
    { id: 'barrier', label: 'What gets in the way', value: draft.healthBarrier ? HEALTH_BARRIER_LABELS[draft.healthBarrier] : 'Not yet specified' },
    { id: 'meal', label: 'Hardest meal', value: draft.mealToImprove ? MEAL_TO_IMPROVE_LABELS[draft.mealToImprove] : 'Not yet specified' },
    { id: 'goal', label: 'Your goal', value: draft.healthDefinition ? HEALTH_DEFINITION_LABELS[draft.healthDefinition] : 'Not yet specified' },
    { id: 'priority', label: 'What matters most', value: draft.mealPriority ? MEAL_PRIORITY_LABELS[draft.mealPriority] : 'Not yet specified' },
    { id: 'pace', label: 'Starting pace', value: draft.flexibleCommitment ? HEALTH_COMMITMENT_LABELS[draft.flexibleCommitment] : 'Not yet specified' },
  ];
}
