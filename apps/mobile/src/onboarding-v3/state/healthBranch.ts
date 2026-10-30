import { createHealthGoal, normalizeOnboardingGoal, type OnboardingGoal } from './onboardingGoal';

// Health Revision 3: problem → goal → solution → one final plan.
// Version 1 and legacy answer mappings remain compatible with existing drafts.
export const HEALTH_STEPS = [
  'intro', 'problem', 'barrier', 'mealToImprove', 'meaning', 'mealPriority', 'foodStyle', 'commitment', 'goal',
  'solutionValue', 'reveal', 'complete',
] as const;
export type HealthLegacyStep = 'problemAcknowledgement' | 'problemDiagnosis' | 'cookingFrequency';
export type HealthStep = typeof HEALTH_STEPS[number] | HealthLegacyStep;
const healthStepIds = new Set<string>([...HEALTH_STEPS, 'problemAcknowledgement', 'problemDiagnosis', 'cookingFrequency']);
export const HEALTH_QUESTION_STEPS: readonly HealthStep[] = ['problem', 'barrier', 'mealToImprove', 'meaning', 'mealPriority', 'foodStyle', 'commitment'];
export const HEALTH_PROGRESS_QUESTION_STEPS = ['problem', 'barrier', 'mealToImprove', 'meaning', 'mealPriority', 'foodStyle', 'commitment', 'goal', 'solutionValue'] as const;
export const HEALTH_PROGRESS_QUESTION_INDEX: Record<HealthStep, number> = {
  intro: 0, problem: 1, barrier: 2, problemAcknowledgement: 2, mealToImprove: 3, cookingFrequency: 3,
  problemDiagnosis: 3, meaning: 4, mealPriority: 5, foodStyle: 6, commitment: 7,
  solutionValue: 7, goal: 7, reveal: 7, complete: 7,
};
export type HealthProblemId = 'too_much_takeout' | 'meals_unbalanced' | 'not_enough_whole_foods' | 'portions_off' | 'low_energy' | 'eating_inconsistent';
export type CookingFrequencyId = 'almost_never' | 'one_to_two_week' | 'three_to_four_week' | 'five_to_six_week' | 'every_day';
export type MealPriorityId = 'tastes_good' | 'quick_to_make' | 'keeps_me_full' | 'costs_less' | 'simple_ingredients';

export type HealthDefinitionId =
  | 'more_balanced_meals'
  | 'more_whole_foods'
  | 'more_vegetables_fruit'
  | 'more_energy'
  | 'better_portions'
  | 'less_takeout';
export type HealthBarrierId =
  | 'not_enough_time'
  | 'too_expensive'
  | 'dont_know_what_to_cook'
  | 'feels_boring'
  | 'struggle_consistency'
  | 'too_hungry_tired';
export type MealToImproveId = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'it_varies';
export type FoodStyleId =
  | 'comfort_food'
  | 'fresh_colorful'
  | 'high_protein'
  | 'quick_simple'
  | 'international'
  | 'a_bit_of_everything';
export type HealthCommitmentId = 'most_meals_healthier' | 'one_meal_daily' | 'few_meals_weekly' | 'small_changes_days' | 'one_change_at_a_time';
export type HealthGoalId =
  | 'one_daily'
  | 'four_week'
  | 'two_takeout'
  | 'cook_home_three'
  | 'whole_foods_daily'
  | 'healthier_breakfast_four'
  | 'balanced_meals_five'
  | 'small_change_daily'
  | 'custom';
export type HealthGoalTypeId =
  | 'healthier_meals'
  | 'replace_takeout'
  | 'cook_at_home'
  | 'balanced_meals'
  | 'whole_foods'
  | 'steady_energy'
  | 'better_portions'
  | 'steady_routine';

export type HealthGoalTypeDefinition = Readonly<{
  defaultCount: number;
  countQuestion: string;
  durationQuestion: string;
  preview: (count: number) => string;
  targetUnit: 'meals_per_week' | 'takeout_meals_per_week';
}>;

export const healthGoalTypeDefinitions: Readonly<Record<HealthGoalTypeId, HealthGoalTypeDefinition>> = {
  healthier_meals: { defaultCount: 12, countQuestion: 'How many healthier meals do you want to aim for?', durationQuestion: 'How long do you want to give yourself?', preview: (count) => `${count} healthier meals`, targetUnit: 'meals_per_week' },
  replace_takeout: { defaultCount: 8, countQuestion: 'How many takeout meals do you want to replace?', durationQuestion: 'How long do you want to give yourself?', preview: (count) => `Replace ${count} takeout meals`, targetUnit: 'takeout_meals_per_week' },
  cook_at_home: { defaultCount: 10, countQuestion: 'How many meals do you want to cook at home?', durationQuestion: 'How long do you want to give yourself?', preview: (count) => `Cook ${count} meals at home`, targetUnit: 'meals_per_week' },
  balanced_meals: { defaultCount: 12, countQuestion: 'How many balanced meals do you want to build?', durationQuestion: 'How long do you want to practice this?', preview: (count) => `Build ${count} balanced meals`, targetUnit: 'meals_per_week' },
  whole_foods: { defaultCount: 12, countQuestion: 'How many meals do you want to add whole foods to?', durationQuestion: 'How long do you want to build this habit?', preview: (count) => `Add whole foods to ${count} meals`, targetUnit: 'meals_per_week' },
  steady_energy: { defaultCount: 10, countQuestion: 'How many meals do you want to make for steadier energy?', durationQuestion: 'How long do you want to build this habit?', preview: (count) => `Build ${count} steadier-energy meals`, targetUnit: 'meals_per_week' },
  better_portions: { defaultCount: 10, countQuestion: 'How many meals do you want to practice better portions with?', durationQuestion: 'How long do you want to practice this?', preview: (count) => `Practice better portions for ${count} meals`, targetUnit: 'meals_per_week' },
  steady_routine: { defaultCount: 14, countQuestion: 'How many meals do you want to make part of a steadier routine?', durationQuestion: 'How long do you want to build this routine?', preview: (count) => `Build a steadier routine for ${count} meals`, targetUnit: 'meals_per_week' },
};

export type HealthGoalDefinition = Readonly<{
  title: string;
  targetValue: number;
  targetUnit: 'meal_per_day' | 'meals_per_week' | 'takeout_meals_per_week' | 'change_per_day' | 'custom';
  durationDays: number;
}>;

export const healthGoalDefinitions: Readonly<Record<Exclude<HealthGoalId, 'custom'>, HealthGoalDefinition>> = {
  one_daily: { title: 'One healthier meal a day', targetValue: 1, targetUnit: 'meal_per_day', durationDays: 14 },
  four_week: { title: 'Four healthier meals a week', targetValue: 4, targetUnit: 'meals_per_week', durationDays: 28 },
  two_takeout: { title: 'Replace two takeout meals a week', targetValue: 2, targetUnit: 'takeout_meals_per_week', durationDays: 28 },
  cook_home_three: { title: 'Cook at home three times a week', targetValue: 3, targetUnit: 'meals_per_week', durationDays: 28 },
  whole_foods_daily: { title: 'Add whole foods to one meal a day', targetValue: 1, targetUnit: 'meal_per_day', durationDays: 21 },
  healthier_breakfast_four: { title: 'Make breakfast healthier four days a week', targetValue: 4, targetUnit: 'meals_per_week', durationDays: 28 },
  balanced_meals_five: { title: 'Eat more balanced meals five days a week', targetValue: 5, targetUnit: 'meals_per_week', durationDays: 28 },
  small_change_daily: { title: 'Start with one small change a day', targetValue: 1, targetUnit: 'change_per_day', durationDays: 14 },
};

// Retained so previously persisted dev drafts keep resolving; no screen collects
// these any more. Kept in the draft + reducer so existing events do not break.
export type FavoriteFoodTradeoffId = 'yes_often' | 'sometimes' | 'rarely' | 'no';
export type RecipeDealbreakerId =
  | 'bland'
  | 'too_long'
  | 'hard_to_find_ingredients'
  | 'portion_too_small'
  | 'too_many_steps'
  | 'too_expensive'
  | 'nothing_need_better_ideas';

export type HealthDraft = {
  version: 1;
  currentStep: HealthStep;
  healthProblem: HealthProblemId | null;
  cookingFrequency: CookingFrequencyId | null;
  mealPriority: MealPriorityId | null;
  healthDefinition: HealthDefinitionId | null;
  healthBarrier: HealthBarrierId | null;
  mealToImprove: MealToImproveId | null;
  foodStyles: FoodStyleId[];
  flexibleCommitment: HealthCommitmentId | null;
  healthGoal: HealthGoalId | null;
  healthGoalType: HealthGoalTypeId | null;
  goalTargetCount: number | null;
  goalDurationWeeks: number | null;
  customHealthGoal: string;
  goal: OnboardingGoal | null;
  // Deprecated preview answers — retained, never rendered.
  favoriteFoodTradeoff: FavoriteFoodTradeoffId | null;
  recipeDealbreaker: RecipeDealbreakerId | null;
  weeklyCookingCount: number | null;
  branchCompleted: boolean;
};

export type HealthGoalSummary = { title: string; detail: string };

export function getHealthGoalSummary(draft: HealthDraft): HealthGoalSummary | null {
  if (!draft.branchCompleted || !draft.goal || !draft.goalTargetCount || !draft.goalDurationWeeks) return null;
  const cadence = draft.goal.targetUnit === 'meal_per_day'
    ? `${draft.goalTargetCount} ${draft.goalTargetCount === 1 ? 'meal' : 'meals'} per day`
    : draft.goal.targetUnit === 'takeout_meals_per_week'
      ? `${draft.goalTargetCount} takeout meals per week`
      : draft.goal.targetUnit === 'change_per_day'
        ? `${draft.goalTargetCount} ${draft.goalTargetCount === 1 ? 'change' : 'changes'} per day`
        : `${draft.goalTargetCount} meals per week`;
  return { title: draft.goal.displayTitle, detail: `${cadence} · ${draft.goalDurationWeeks} ${draft.goalDurationWeeks === 1 ? 'week' : 'weeks'}` };
}

export const initialHealthDraft: HealthDraft = {
  version: 1,
  currentStep: 'intro',
  healthProblem: null,
  cookingFrequency: null,
  mealPriority: null,
  healthDefinition: null,
  healthBarrier: null,
  mealToImprove: null,
  foodStyles: [],
  flexibleCommitment: null,
  healthGoal: null,
  healthGoalType: null,
  goalTargetCount: null,
  goalDurationWeeks: null,
  customHealthGoal: '',
  goal: null,
  favoriteFoodTradeoff: null,
  recipeDealbreaker: null,
  weeklyCookingCount: null,
  branchCompleted: false,
};

const problems: HealthProblemId[] = ['too_much_takeout', 'meals_unbalanced', 'not_enough_whole_foods', 'portions_off', 'low_energy', 'eating_inconsistent'];
const frequencies: CookingFrequencyId[] = ['almost_never', 'one_to_two_week', 'three_to_four_week', 'five_to_six_week', 'every_day'];
const priorities: MealPriorityId[] = ['tastes_good', 'quick_to_make', 'keeps_me_full', 'costs_less', 'simple_ingredients'];
const LEGACY_COMMITMENTS: Record<string, HealthCommitmentId> = { small_changes_daily: 'small_changes_days', improve_gradually: 'one_change_at_a_time' };
const definitions: HealthDefinitionId[] = ['more_balanced_meals', 'more_whole_foods', 'more_vegetables_fruit', 'more_energy', 'better_portions', 'less_takeout'];
const barriers: HealthBarrierId[] = ['not_enough_time', 'too_expensive', 'dont_know_what_to_cook', 'feels_boring', 'struggle_consistency', 'too_hungry_tired'];
const mealsToImprove: MealToImproveId[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'it_varies'];
const foodStylesList: FoodStyleId[] = ['comfort_food', 'fresh_colorful', 'high_protein', 'quick_simple', 'international', 'a_bit_of_everything'];
const commitments: HealthCommitmentId[] = ['most_meals_healthier', 'one_meal_daily', 'few_meals_weekly', 'small_changes_days', 'one_change_at_a_time'];
const healthGoals: HealthGoalId[] = ['one_daily', 'four_week', 'two_takeout', 'cook_home_three', 'whole_foods_daily', 'healthier_breakfast_four', 'balanced_meals_five', 'small_change_daily', 'custom'];
const healthGoalTypes: HealthGoalTypeId[] = ['healthier_meals', 'replace_takeout', 'cook_at_home', 'balanced_meals', 'whole_foods', 'steady_energy', 'better_portions', 'steady_routine'];
const tradeoffs: FavoriteFoodTradeoffId[] = ['yes_often', 'sometimes', 'rarely', 'no'];
const dealbreakers: RecipeDealbreakerId[] = ['bland', 'too_long', 'hard_to_find_ingredients', 'portion_too_small', 'too_many_steps', 'too_expensive', 'nothing_need_better_ideas'];

// Previous-preview ids → current ids. Keeps a mid-flow dev draft valid.
const LEGACY_DEFINITIONS: Record<string, HealthDefinitionId> = { more_vegetables: 'more_vegetables_fruit', less_processed_food: 'less_takeout' };
const LEGACY_BARRIERS: Record<string, HealthBarrierId> = { short_on_time: 'not_enough_time', cost: 'too_expensive', dont_know_what_to_make: 'dont_know_what_to_cook', boring: 'feels_boring', staying_consistent: 'struggle_consistency', cravings_win: 'too_hungry_tired' };
const LEGACY_FOOD_STYLES: Record<string, FoodStyleId> = { bowls_and_grains: 'fresh_colorful', pasta_and_noodles: 'comfort_food', handhelds_and_wraps: 'quick_simple', meat_or_seafood: 'high_protein', plant_based_meals: 'fresh_colorful', global_flavors: 'international' };

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function coerceDefinition(value: unknown): HealthDefinitionId | null {
  if (typeof value !== 'string') return null;
  if (definitions.includes(value as HealthDefinitionId)) return value as HealthDefinitionId;
  return LEGACY_DEFINITIONS[value] ?? null;
}
function coerceBarrier(value: unknown): HealthBarrierId | null {
  if (typeof value !== 'string') return null;
  if (barriers.includes(value as HealthBarrierId)) return value as HealthBarrierId;
  return LEGACY_BARRIERS[value] ?? null;
}
function coerceFoodStyle(value: unknown): FoodStyleId | null {
  if (typeof value !== 'string') return null;
  if (foodStylesList.includes(value as FoodStyleId)) return value as FoodStyleId;
  return LEGACY_FOOD_STYLES[value] ?? null;
}

export function routeForHealthDraft(draft: HealthDraft): HealthStep {
  // A completed branch may be deliberately backed out to its reveal screen.
  if (draft.branchCompleted) return draft.currentStep === 'reveal' ? 'reveal' : 'complete';
  if (isHealthStepReachable(draft, draft.currentStep)) return draft.currentStep;
  if (draft.healthProblem === null) return 'problem';
  if (draft.healthBarrier === null) return 'barrier';
  if (draft.mealToImprove === null) return 'mealToImprove';
  if (draft.healthDefinition === null) return 'meaning';
  if (draft.mealPriority === null) return 'mealPriority';
  if (draft.foodStyles.length === 0) return 'foodStyle';
  if (draft.flexibleCommitment === null) return 'commitment';
  if (draft.healthGoalType === null) return 'goal';
  if (draft.goalTargetCount === null || draft.goalDurationWeeks === null || draft.goal === null) return 'solutionValue';
  return 'reveal';
}

function isHealthStepReachable(draft: HealthDraft, step: HealthStep): boolean {
  const hasProblem = draft.healthProblem !== null;
  const hasBarrier = hasProblem && draft.healthBarrier !== null;
  const hasMeal = hasBarrier && draft.mealToImprove !== null;
  const hasDefinition = hasMeal && draft.healthDefinition !== null;
  const hasPriority = hasDefinition && draft.mealPriority !== null;
  const hasStyles = hasPriority && draft.foodStyles.length > 0;
  const hasCommitment = hasStyles && draft.flexibleCommitment !== null;
  const hasGoalType = hasCommitment && draft.healthGoalType !== null;
  const hasGoal = hasGoalType && draft.goalTargetCount !== null && draft.goalDurationWeeks !== null && draft.goal !== null && draft.goal.goalBranch === 'eat_healthier';
  switch (step) {
    case 'intro': return !draft.healthProblem && !draft.healthBarrier && !draft.mealToImprove && !draft.cookingFrequency && !draft.healthDefinition && !draft.mealPriority && !draft.foodStyles.length && !draft.flexibleCommitment && !draft.healthGoal && !draft.customHealthGoal && !draft.goal;
    case 'problem': return true;
    case 'barrier': return hasProblem;
    case 'mealToImprove': return hasBarrier;
    case 'meaning': return hasMeal;
    case 'mealPriority': return hasDefinition;
    case 'foodStyle': return hasPriority;
    case 'commitment': return hasStyles;
    case 'goal': return hasCommitment;
    case 'solutionValue': return hasGoalType;
    case 'reveal': return hasGoal;
    case 'complete': return draft.branchCompleted;
    case 'problemAcknowledgement':
    case 'problemDiagnosis':
    case 'cookingFrequency': return false;
  }
}

export function normalizeHealthDraft(value: unknown): HealthDraft {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return { ...initialHealthDraft };
  const raw = value as Partial<HealthDraft> & Record<string, unknown>;
  const definition = coerceDefinition(raw.healthDefinition);
  const barrier = coerceBarrier(raw.healthBarrier);
  const meal = mealsToImprove.includes(raw.mealToImprove as MealToImproveId) ? (raw.mealToImprove as MealToImproveId) : null;
  const rawStyles = Array.isArray(raw.foodStyles) ? raw.foodStyles : [];
  const mapped = rawStyles.map(coerceFoodStyle).filter((id): id is FoodStyleId => id !== null);
  const foodStyles: FoodStyleId[] = mapped.includes('a_bit_of_everything') ? ['a_bit_of_everything'] : [...new Set(mapped)];
  const commitment = commitments.includes(raw.flexibleCommitment as HealthCommitmentId) ? (raw.flexibleCommitment as HealthCommitmentId) : typeof raw.flexibleCommitment === 'string' ? LEGACY_COMMITMENTS[raw.flexibleCommitment] ?? null : null;
  const healthGoal = healthGoals.includes(raw.healthGoal as HealthGoalId) ? raw.healthGoal as HealthGoalId : null;
  const healthGoalType = healthGoalTypes.includes(raw.healthGoalType as HealthGoalTypeId) ? raw.healthGoalType as HealthGoalTypeId : null;
  const goalTargetCount = isInt(raw.goalTargetCount) && raw.goalTargetCount >= 1 && raw.goalTargetCount <= 30 ? raw.goalTargetCount : null;
  const goalDurationWeeks = isInt(raw.goalDurationWeeks) && raw.goalDurationWeeks >= 2 && raw.goalDurationWeeks <= 8 ? raw.goalDurationWeeks : null;
  const customHealthGoal = typeof raw.customHealthGoal === 'string' ? raw.customHealthGoal.trim().slice(0, 80) : '';
  const tradeoff = tradeoffs.includes(raw.favoriteFoodTradeoff as FavoriteFoodTradeoffId) ? (raw.favoriteFoodTradeoff as FavoriteFoodTradeoffId) : null;
  const dealbreaker = dealbreakers.includes(raw.recipeDealbreaker as RecipeDealbreakerId) ? (raw.recipeDealbreaker as RecipeDealbreakerId) : null;
  const count = isInt(raw.weeklyCookingCount) && raw.weeklyCookingCount >= 0 && raw.weeklyCookingCount <= 21 ? raw.weeklyCookingCount : null;
  const normalizedGoal = normalizeOnboardingGoal(raw.goal);
  const goal = healthGoal === 'custom' && !customHealthGoal && !healthGoalType ? null : normalizedGoal;
  const draft: HealthDraft = {
    version: 1,
    currentStep: typeof raw.currentStep === 'string' && healthStepIds.has(raw.currentStep) ? raw.currentStep as HealthStep : 'intro',
    healthProblem: problems.includes(raw.healthProblem as HealthProblemId) ? raw.healthProblem as HealthProblemId : null,
    cookingFrequency: frequencies.includes(raw.cookingFrequency as CookingFrequencyId) ? raw.cookingFrequency as CookingFrequencyId : null,
    mealPriority: priorities.includes(raw.mealPriority as MealPriorityId) ? raw.mealPriority as MealPriorityId : null,
    healthDefinition: definition,
    healthBarrier: barrier,
    mealToImprove: meal,
    foodStyles,
    flexibleCommitment: commitment,
    healthGoal,
    healthGoalType,
    goalTargetCount,
    goalDurationWeeks,
    customHealthGoal,
    goal,
    favoriteFoodTradeoff: tradeoff,
    recipeDealbreaker: dealbreaker,
    weeklyCookingCount: count,
    branchCompleted: raw.branchCompleted === true,
  };
  return { ...draft, currentStep: routeForHealthDraft(draft) };
}

export type HealthEvent =
  | { type: 'PROBLEM_SELECTED'; problem: HealthProblemId }
  | { type: 'COOKING_FREQUENCY_SELECTED'; frequency: CookingFrequencyId }
  | { type: 'MEAL_PRIORITY_SELECTED'; priority: MealPriorityId }
  | { type: 'DEFINITION_SELECTED'; definition: HealthDefinitionId }
  | { type: 'BARRIER_SELECTED'; barrier: HealthBarrierId }
  | { type: 'MEAL_TO_IMPROVE_SELECTED'; meal: MealToImproveId }
  | { type: 'FOOD_STYLE_TOGGLED'; foodStyle: FoodStyleId }
  | { type: 'COMMITMENT_SELECTED'; commitment: HealthCommitmentId }
  | { type: 'HEALTH_GOAL_SELECTED'; goal: HealthGoalId }
  | { type: 'HEALTH_GOAL_TYPE_SELECTED'; goalType: HealthGoalTypeId }
  | { type: 'HEALTH_GOAL_TARGET_CHANGED'; value: number }
  | { type: 'HEALTH_GOAL_DURATION_CHANGED'; value: number }
  | { type: 'HEALTH_CUSTOM_GOAL_CHANGED'; value: string }
  // Retained events — no live screen dispatches these any more.
  | { type: 'TRADEOFF_SELECTED'; tradeoff: FavoriteFoodTradeoffId }
  | { type: 'DEALBREAKER_SELECTED'; dealbreaker: RecipeDealbreakerId }
  | { type: 'FREQUENCY_SAVED'; count: number }
  | { type: 'NEXT_PRESSED'; skipSteps?: readonly HealthStep[] }
  | { type: 'BACK_PRESSED'; skipSteps?: readonly HealthStep[] }
  | { type: 'BRANCH_COMPLETED' }
  | { type: 'HYDRATED'; draft: unknown };

export function healthReducer(state: HealthDraft, event: HealthEvent): HealthDraft {
  if (event.type === 'HYDRATED') return normalizeHealthDraft(event.draft);
  const next = { ...state, foodStyles: [...state.foodStyles] };
  if (event.type === 'PROBLEM_SELECTED' && problems.includes(event.problem)) next.healthProblem = event.problem;
  if (event.type === 'COOKING_FREQUENCY_SELECTED' && frequencies.includes(event.frequency)) { next.cookingFrequency = event.frequency; next.healthGoal = null; next.goal = null; }
  if (event.type === 'MEAL_PRIORITY_SELECTED' && priorities.includes(event.priority)) next.mealPriority = event.priority;
  if (event.type === 'DEFINITION_SELECTED' && definitions.includes(event.definition)) next.healthDefinition = event.definition;
  if (event.type === 'BARRIER_SELECTED' && barriers.includes(event.barrier)) next.healthBarrier = event.barrier;
  if (event.type === 'MEAL_TO_IMPROVE_SELECTED' && mealsToImprove.includes(event.meal)) { next.mealToImprove = event.meal; next.healthGoal = null; next.goal = null; }
  if (event.type === 'FOOD_STYLE_TOGGLED') {
    next.foodStyles = event.foodStyle === 'a_bit_of_everything'
      ? ['a_bit_of_everything']
      : next.foodStyles.includes(event.foodStyle)
        ? next.foodStyles.filter((f) => f !== event.foodStyle)
        : [...next.foodStyles.filter((f) => f !== 'a_bit_of_everything'), event.foodStyle];
  }
  if (event.type === 'COMMITMENT_SELECTED' && commitments.includes(event.commitment)) { next.flexibleCommitment = event.commitment; next.healthGoal = null; next.goal = null; }
  if (event.type === 'HEALTH_GOAL_SELECTED' && healthGoals.includes(event.goal)) {
    next.healthGoal = event.goal;
    if (event.goal === 'custom') {
      next.goal = next.customHealthGoal ? createHealthGoal(next.customHealthGoal, 1, 14, undefined, 'custom') : null;
    } else {
      const definition = healthGoalDefinitions[event.goal];
      const meal = next.mealToImprove && next.mealToImprove !== 'it_varies' ? ` ${next.mealToImprove}` : '';
      const mealPlural = next.mealToImprove === 'breakfast' ? 'breakfasts'
        : next.mealToImprove === 'lunch' ? 'lunches'
          : next.mealToImprove === 'dinner' ? 'dinners'
            : next.mealToImprove === 'snacks' ? 'snacks' : null;
      const title = event.goal === 'one_daily' && meal
        ? `One healthier${meal} a day`
        : event.goal === 'four_week' && mealPlural
          ? `Four healthier ${mealPlural} each week`
          : event.goal === 'cook_home_three' && next.mealToImprove === 'dinner'
            ? 'Cook dinner at home three times a week'
            : definition.title;
      next.goal = createHealthGoal(title, definition.targetValue, definition.durationDays, undefined, definition.targetUnit);
    }
  }
  if (event.type === 'HEALTH_GOAL_TYPE_SELECTED' && healthGoalTypes.includes(event.goalType)) {
    next.healthGoalType = event.goalType;
    next.healthGoal = null;
    next.goalTargetCount = healthGoalTypeDefinitions[event.goalType].defaultCount;
    next.goalDurationWeeks = 4;
    next.goal = null;
  }
  if (event.type === 'HEALTH_GOAL_TARGET_CHANGED' && isInt(event.value) && event.value >= 1 && event.value <= 30) next.goalTargetCount = event.value;
  if (event.type === 'HEALTH_GOAL_DURATION_CHANGED' && isInt(event.value) && event.value >= 2 && event.value <= 8) next.goalDurationWeeks = event.value;
  if ((event.type === 'HEALTH_GOAL_TYPE_SELECTED' || event.type === 'HEALTH_GOAL_TARGET_CHANGED' || event.type === 'HEALTH_GOAL_DURATION_CHANGED') && next.healthGoalType && next.goalTargetCount && next.goalDurationWeeks) {
    const count = next.goalTargetCount;
    const weeks = next.goalDurationWeeks;
    const definition = healthGoalTypeDefinitions[next.healthGoalType];
    const title = definition.preview(count);
    const unit = definition.targetUnit;
    const weeklyTarget = count / weeks;
    next.goal = { ...createHealthGoal(title, count, weeks * 7, undefined, unit), weeklyTarget };
    next.healthGoal = 'custom';
  }
  if (event.type === 'HEALTH_CUSTOM_GOAL_CHANGED') {
    next.customHealthGoal = event.value.trim().slice(0, 80);
    next.healthGoal = 'custom';
    next.goal = next.customHealthGoal ? createHealthGoal(next.customHealthGoal, 1, 14, undefined, 'custom') : null;
  }
  if (event.type === 'TRADEOFF_SELECTED' && tradeoffs.includes(event.tradeoff)) next.favoriteFoodTradeoff = event.tradeoff;
  if (event.type === 'DEALBREAKER_SELECTED' && dealbreakers.includes(event.dealbreaker)) next.recipeDealbreaker = event.dealbreaker;
  if (event.type === 'FREQUENCY_SAVED' && isInt(event.count) && event.count >= 0 && event.count <= 21) next.weeklyCookingCount = event.count;
  if (event.type === 'BRANCH_COMPLETED') { next.branchCompleted = true; next.currentStep = 'complete'; }
  if (event.type === 'NEXT_PRESSED') {
    if (next.currentStep === 'goal' && (next.healthGoal === null || next.goal === null)) return { ...next, currentStep: 'goal' };
    if (event.skipSteps?.includes('solutionValue') && next.currentStep === 'goal' && next.healthGoalType) {
      const definition = healthGoalTypeDefinitions[next.healthGoalType];
      const count = next.goalTargetCount ?? definition.defaultCount;
      const weeks = next.goalDurationWeeks ?? 4;
      next.goalTargetCount = count;
      next.goalDurationWeeks = weeks;
      next.goal = { ...createHealthGoal(definition.preview(count), count, weeks * 7, undefined, definition.targetUnit), weeklyTarget: count / weeks };
      next.healthGoal = 'custom';
    }
    const liveStep = HEALTH_STEPS.includes(next.currentStep as typeof HEALTH_STEPS[number]) ? next.currentStep as typeof HEALTH_STEPS[number] : routeForHealthDraft(next) as typeof HEALTH_STEPS[number];
    const index = HEALTH_STEPS.indexOf(liveStep); next.currentStep = HEALTH_STEPS[Math.min(index + 1, HEALTH_STEPS.length - 1)];
    while (event.skipSteps?.includes(next.currentStep) && next.currentStep !== 'reveal' && next.currentStep !== 'complete') {
      const skippedIndex = HEALTH_STEPS.indexOf(next.currentStep);
      next.currentStep = HEALTH_STEPS[Math.min(skippedIndex + 1, HEALTH_STEPS.length - 1)];
    }
  }
  if (event.type === 'BACK_PRESSED') { const liveStep = HEALTH_STEPS.includes(next.currentStep as typeof HEALTH_STEPS[number]) ? next.currentStep as typeof HEALTH_STEPS[number] : routeForHealthDraft(next) as typeof HEALTH_STEPS[number]; const index = HEALTH_STEPS.indexOf(liveStep); next.currentStep = HEALTH_STEPS[Math.max(index - 1, 0)]; while (event.skipSteps?.includes(next.currentStep) && next.currentStep !== 'intro') { const previousIndex = HEALTH_STEPS.indexOf(next.currentStep); next.currentStep = HEALTH_STEPS[Math.max(previousIndex - 1, 0)]; } }
  const normalized = normalizeHealthDraft(next);
  // Reducer transitions own transient screens; normalization resolves persisted snapshots on hydrate.
  return { ...normalized, currentStep: next.currentStep };
}
