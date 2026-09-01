// Eat Healthier onboarding branch — state machine for the development-preview
// redesign (gated by isEatHealthierStage2PreviewEnabled). The flow is a
// friendly food-coaching sequence: four insight/reassurance beats sit between
// five questions so it never reads as a survey.
//
//   intro → meaning(Q) → meaningInsight → barrier(Q) → barrierResponse →
//   mealToImprove(Q) → mealInsight → foodStyle(Q) → reassurance → approach →
//   whatOkyoDoes → commitment(Q) → reveal → planSummary → complete
//
// Persistence stays version 1. Legacy answer ids from the previous preview are
// remapped on hydrate so an in-progress dev draft is never silently dropped.
export const HEALTH_STEPS = [
  'intro',
  'meaning',
  'meaningInsight',
  'barrier',
  'barrierResponse',
  'mealToImprove',
  'mealInsight',
  'foodStyle',
  'reassurance',
  'approach',
  'whatOkyoDoes',
  'commitment',
  'reveal',
  'complete',
] as const;
export type HealthStep = typeof HEALTH_STEPS[number];

/** The five answered questions the progress bar counts. */
export const HEALTH_QUESTION_STEPS: readonly HealthStep[] = ['meaning', 'barrier', 'mealToImprove', 'foodStyle', 'commitment'];

export type HealthDefinitionId =
  | 'more_balanced_meals'
  | 'more_whole_foods'
  | 'more_vegetables_fruit'
  | 'more_energy'
  | 'better_portions'
  | 'less_takeout'
  | 'something_else';
export type HealthBarrierId =
  | 'not_enough_time'
  | 'too_expensive'
  | 'dont_know_what_to_cook'
  | 'feels_boring'
  | 'struggle_consistency'
  | 'too_hungry_tired'
  | 'something_else';
export type MealToImproveId = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'it_varies';
export type FoodStyleId =
  | 'comfort_food'
  | 'fresh_colorful'
  | 'high_protein'
  | 'quick_simple'
  | 'international'
  | 'a_bit_of_everything';
export type HealthCommitmentId = 'few_meals_weekly' | 'small_changes_daily' | 'improve_gradually' | 'not_sure';

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
  healthDefinition: HealthDefinitionId | null;
  healthBarrier: HealthBarrierId | null;
  mealToImprove: MealToImproveId | null;
  foodStyles: FoodStyleId[];
  flexibleCommitment: HealthCommitmentId | null;
  // Deprecated preview answers — retained, never rendered.
  favoriteFoodTradeoff: FavoriteFoodTradeoffId | null;
  recipeDealbreaker: RecipeDealbreakerId | null;
  weeklyCookingCount: number | null;
  branchCompleted: boolean;
};

export const initialHealthDraft: HealthDraft = {
  version: 1,
  currentStep: 'intro',
  healthDefinition: null,
  healthBarrier: null,
  mealToImprove: null,
  foodStyles: [],
  flexibleCommitment: null,
  favoriteFoodTradeoff: null,
  recipeDealbreaker: null,
  weeklyCookingCount: null,
  branchCompleted: false,
};

const definitions: HealthDefinitionId[] = ['more_balanced_meals', 'more_whole_foods', 'more_vegetables_fruit', 'more_energy', 'better_portions', 'less_takeout', 'something_else'];
const barriers: HealthBarrierId[] = ['not_enough_time', 'too_expensive', 'dont_know_what_to_cook', 'feels_boring', 'struggle_consistency', 'too_hungry_tired', 'something_else'];
const mealsToImprove: MealToImproveId[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'it_varies'];
const foodStylesList: FoodStyleId[] = ['comfort_food', 'fresh_colorful', 'high_protein', 'quick_simple', 'international', 'a_bit_of_everything'];
const commitments: HealthCommitmentId[] = ['few_meals_weekly', 'small_changes_daily', 'improve_gradually', 'not_sure'];
const tradeoffs: FavoriteFoodTradeoffId[] = ['yes_often', 'sometimes', 'rarely', 'no'];
const dealbreakers: RecipeDealbreakerId[] = ['bland', 'too_long', 'hard_to_find_ingredients', 'portion_too_small', 'too_many_steps', 'too_expensive', 'nothing_need_better_ideas'];

// Previous-preview ids → current ids. Keeps a mid-flow dev draft valid.
const LEGACY_DEFINITIONS: Record<string, HealthDefinitionId> = { more_vegetables: 'more_vegetables_fruit', less_processed_food: 'less_takeout' };
const LEGACY_BARRIERS: Record<string, HealthBarrierId> = { short_on_time: 'not_enough_time', cost: 'too_expensive', dont_know_what_to_make: 'dont_know_what_to_cook', boring: 'feels_boring', staying_consistent: 'struggle_consistency', cravings_win: 'too_hungry_tired', household_wants_different: 'something_else' };
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
  if (draft.healthDefinition === null) return 'intro';
  if (draft.healthBarrier === null) return 'barrier';
  if (draft.mealToImprove === null) return 'mealToImprove';
  if (draft.foodStyles.length === 0) return 'foodStyle';
  if (draft.flexibleCommitment === null) return 'commitment';
  return 'reveal';
}

function isHealthStepReachable(draft: HealthDraft, step: HealthStep): boolean {
  const hasDefinition = draft.healthDefinition !== null;
  const hasBarrier = draft.healthBarrier !== null;
  const hasMeal = draft.mealToImprove !== null;
  const hasStyles = draft.foodStyles.length > 0;
  const hasCommitment = draft.flexibleCommitment !== null;
  switch (step) {
    case 'intro': return !hasDefinition && !hasBarrier && !hasMeal && !hasStyles && !hasCommitment;
    case 'meaning': return true;
    case 'meaningInsight': return hasDefinition;
    case 'barrier': return hasDefinition;
    case 'barrierResponse': return hasBarrier;
    case 'mealToImprove': return hasBarrier;
    case 'mealInsight': return hasMeal;
    case 'foodStyle': return hasMeal;
    case 'reassurance': return hasStyles;
    case 'approach': return hasStyles;
    case 'whatOkyoDoes': return hasStyles;
    case 'commitment': return hasStyles;
    case 'reveal': return hasCommitment;
    case 'complete': return draft.branchCompleted;
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
  const commitment = commitments.includes(raw.flexibleCommitment as HealthCommitmentId) ? (raw.flexibleCommitment as HealthCommitmentId) : null;
  const tradeoff = tradeoffs.includes(raw.favoriteFoodTradeoff as FavoriteFoodTradeoffId) ? (raw.favoriteFoodTradeoff as FavoriteFoodTradeoffId) : null;
  const dealbreaker = dealbreakers.includes(raw.recipeDealbreaker as RecipeDealbreakerId) ? (raw.recipeDealbreaker as RecipeDealbreakerId) : null;
  const count = isInt(raw.weeklyCookingCount) && raw.weeklyCookingCount >= 0 && raw.weeklyCookingCount <= 21 ? raw.weeklyCookingCount : null;
  const draft: HealthDraft = {
    version: 1,
    currentStep: HEALTH_STEPS.includes(raw.currentStep as HealthStep) ? (raw.currentStep as HealthStep) : 'intro',
    healthDefinition: definition,
    healthBarrier: barrier,
    mealToImprove: meal,
    foodStyles,
    flexibleCommitment: commitment,
    favoriteFoodTradeoff: tradeoff,
    recipeDealbreaker: dealbreaker,
    weeklyCookingCount: count,
    branchCompleted: raw.branchCompleted === true,
  };
  return { ...draft, currentStep: routeForHealthDraft(draft) };
}

export type HealthEvent =
  | { type: 'DEFINITION_SELECTED'; definition: HealthDefinitionId }
  | { type: 'BARRIER_SELECTED'; barrier: HealthBarrierId }
  | { type: 'MEAL_TO_IMPROVE_SELECTED'; meal: MealToImproveId }
  | { type: 'FOOD_STYLE_TOGGLED'; foodStyle: FoodStyleId }
  | { type: 'COMMITMENT_SELECTED'; commitment: HealthCommitmentId }
  // Retained events — no live screen dispatches these any more.
  | { type: 'TRADEOFF_SELECTED'; tradeoff: FavoriteFoodTradeoffId }
  | { type: 'DEALBREAKER_SELECTED'; dealbreaker: RecipeDealbreakerId }
  | { type: 'FREQUENCY_SAVED'; count: number }
  | { type: 'NEXT_PRESSED' }
  | { type: 'BACK_PRESSED' }
  | { type: 'BRANCH_COMPLETED' }
  | { type: 'HYDRATED'; draft: unknown };

export function healthReducer(state: HealthDraft, event: HealthEvent): HealthDraft {
  if (event.type === 'HYDRATED') return normalizeHealthDraft(event.draft);
  const next = { ...state, foodStyles: [...state.foodStyles] };
  if (event.type === 'DEFINITION_SELECTED' && definitions.includes(event.definition)) next.healthDefinition = event.definition;
  if (event.type === 'BARRIER_SELECTED' && barriers.includes(event.barrier)) next.healthBarrier = event.barrier;
  if (event.type === 'MEAL_TO_IMPROVE_SELECTED' && mealsToImprove.includes(event.meal)) next.mealToImprove = event.meal;
  if (event.type === 'FOOD_STYLE_TOGGLED') {
    next.foodStyles = event.foodStyle === 'a_bit_of_everything'
      ? ['a_bit_of_everything']
      : next.foodStyles.includes(event.foodStyle)
        ? next.foodStyles.filter((f) => f !== event.foodStyle)
        : [...next.foodStyles.filter((f) => f !== 'a_bit_of_everything'), event.foodStyle];
  }
  if (event.type === 'COMMITMENT_SELECTED' && commitments.includes(event.commitment)) next.flexibleCommitment = event.commitment;
  if (event.type === 'TRADEOFF_SELECTED' && tradeoffs.includes(event.tradeoff)) next.favoriteFoodTradeoff = event.tradeoff;
  if (event.type === 'DEALBREAKER_SELECTED' && dealbreakers.includes(event.dealbreaker)) next.recipeDealbreaker = event.dealbreaker;
  if (event.type === 'FREQUENCY_SAVED' && isInt(event.count) && event.count >= 0 && event.count <= 21) next.weeklyCookingCount = event.count;
  if (event.type === 'BRANCH_COMPLETED') { next.branchCompleted = true; next.currentStep = 'complete'; }
  if (event.type === 'NEXT_PRESSED') { const index = HEALTH_STEPS.indexOf(next.currentStep); next.currentStep = HEALTH_STEPS[Math.min(index + 1, HEALTH_STEPS.length - 1)]; }
  if (event.type === 'BACK_PRESSED') { const index = HEALTH_STEPS.indexOf(next.currentStep); next.currentStep = HEALTH_STEPS[Math.max(index - 1, 0)]; }
  const normalized = normalizeHealthDraft(next);
  // Reducer transitions own transient screens; normalization resolves persisted snapshots on hydrate.
  return { ...normalized, currentStep: next.currentStep };
}
