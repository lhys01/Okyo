import { createSavingsGoal, normalizeOnboardingGoal, type OnboardingGoal } from './onboardingGoal';

export const SAVE_MONEY_VISIBLE_STEPS = ['intro', 'weeklySnapshot', 'projection', 'planSetup', 'reveal'] as const;
export const SAVE_MONEY_STEPS = [...SAVE_MONEY_VISIBLE_STEPS, 'complete'] as const;
export const SAVE_MONEY_OPTIONAL_STEPS = ['projection'] as const;

export type SaveMoneyStep = typeof SAVE_MONEY_STEPS[number];
export type FrictionId = 'time' | 'energy' | 'ideas' | 'ingredients' | 'cleanup' | 'other';
export type MealTypeId = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'varies';
export type RecipePriorityId = 'lower_cost' | 'quick_easy' | 'familiar_satisfying' | 'healthier_ingredients' | 'leftovers' | 'other';
export type HouseholdSize = 1 | 2 | 3 | 4 | '5_plus';

export const HOME_MEAL_ESTIMATE_CENTS = 600;
export const DEFAULT_WEEKLY_EATING_OUT_COUNT = 4;
export const DEFAULT_EATING_OUT_COST_CENTS = 2_000;
export const DEFAULT_WEEKLY_REPLACEMENT_TARGET = 2;

export type SaveMoneyDraft = {
  version: 2;
  currentStep: SaveMoneyStep;
  weeklyEatingOutCount: number;
  eatingOutCostCents: number;
  orderingFriction: FrictionId | null;
  orderingFrictionOtherText: string;
  mealTypesToReplace: MealTypeId[];
  weeklyReplacementTarget: number;
  recipePriorities: RecipePriorityId[];
  recipePriorityOtherText: string;
  /** Compatibility mirror for older consumers. New UI reads recipePriorities. */
  recipePriority: RecipePriorityId | null;
  householdSize: HouseholdSize | null;
  /** Derived annual potential-savings target. There is no target question. */
  savingsGoalAmountCents: number | null;
  goal: OnboardingGoal | null;
  /** Preserved only when a version-1 draft contained the removed custom goal. */
  legacySavingsGoalAmountCents: number | null;
  legacyGoal: OnboardingGoal | null;
  skippedOptionalSteps: SaveMoneyStep[];
  branchCompleted: boolean;
};

export const initialSaveMoneyDraft: SaveMoneyDraft = {
  version: 2,
  currentStep: 'intro',
  weeklyEatingOutCount: DEFAULT_WEEKLY_EATING_OUT_COUNT,
  eatingOutCostCents: DEFAULT_EATING_OUT_COST_CENTS,
  orderingFriction: null,
  orderingFrictionOtherText: '',
  mealTypesToReplace: [],
  weeklyReplacementTarget: DEFAULT_WEEKLY_REPLACEMENT_TARGET,
  recipePriorities: [],
  recipePriorityOtherText: '',
  recipePriority: null,
  householdSize: null,
  savingsGoalAmountCents: null,
  goal: null,
  legacySavingsGoalAmountCents: null,
  legacyGoal: null,
  skippedOptionalSteps: [],
  branchCompleted: false,
};

const frictions: readonly FrictionId[] = ['time', 'energy', 'ideas', 'ingredients', 'cleanup', 'other'];
const meals: readonly MealTypeId[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'varies'];
const priorities: readonly RecipePriorityId[] = ['lower_cost', 'quick_easy', 'familiar_satisfying', 'healthier_ingredients', 'leftovers', 'other'];
const legacyPriorityMap: Readonly<Record<string, RecipePriorityId>> = {
  lowest_cost: 'lower_cost',
  fast_easy: 'quick_easy',
  same_taste: 'familiar_satisfying',
};
const legacyStepMap: Readonly<Record<string, SaveMoneyStep>> = {
  intro: 'intro', frequency: 'weeklySnapshot', cost: 'weeklySnapshot', spendingGraph: 'projection', friction: 'weeklySnapshot',
  encouragement: 'weeklySnapshot', mealType: 'planSetup', replacementTarget: 'weeklySnapshot', recipePriority: 'planSetup',
  reassurance: 'planSetup', householdSize: 'planSetup', goal: 'reveal', reveal: 'reveal', complete: 'complete',
};

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeCustomText = (value: unknown) => typeof value === 'string' ? value.slice(0, 120) : '';

function normalizePriority(value: unknown): RecipePriorityId | null {
  if (typeof value !== 'string') return null;
  if (priorities.includes(value as RecipePriorityId)) return value as RecipePriorityId;
  return legacyPriorityMap[value] ?? null;
}

function derivedGoalFor(count: number, costCents: number, replacementTarget: number): { amountCents: number | null; goal: OnboardingGoal | null } {
  const projection = calculateSavingsProjection({ weeklyEatingOutCount: count, eatingOutCostCents: costCents, weeklyReplacementTarget: replacementTarget });
  if (projection.annualPotentialSavingsCents <= 0) return { amountCents: null, goal: null };
  return {
    amountCents: projection.annualPotentialSavingsCents,
    goal: createSavingsGoal(projection.annualPotentialSavingsCents, projection.weeklyPotentialSavingsCents),
  };
}

export function routeForSaveMoneyDraft(draft: SaveMoneyDraft): SaveMoneyStep {
  if (draft.branchCompleted) return 'complete';
  if (draft.currentStep === 'intro') return 'intro';
  if (draft.currentStep === 'weeklySnapshot') return 'weeklySnapshot';
  if (draft.currentStep === 'projection') return 'projection';
  if (draft.currentStep === 'planSetup' || draft.recipePriorities.length === 0 || draft.householdSize === null) return 'planSetup';
  return 'reveal';
}

export function normalizeSaveMoneyDraft(value: unknown): SaveMoneyDraft {
  if (!value || typeof value !== 'object') return { ...initialSaveMoneyDraft };
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 && raw.version !== 2) return { ...initialSaveMoneyDraft };
  const isLegacy = raw.version === 1;
  const count = isInt(raw.weeklyEatingOutCount) ? clamp(raw.weeklyEatingOutCount, 0, 30) : DEFAULT_WEEKLY_EATING_OUT_COUNT;
  const cents = isInt(raw.eatingOutCostCents) ? clamp(raw.eatingOutCostCents, 100, 50_000) : DEFAULT_EATING_OUT_COST_CENTS;
  const target = isInt(raw.weeklyReplacementTarget) ? clamp(raw.weeklyReplacementTarget, 0, count) : Math.min(DEFAULT_WEEKLY_REPLACEMENT_TARGET, count);
  const friction = raw.orderingFriction === 'cravings'
    ? 'other'
    : frictions.includes(raw.orderingFriction as FrictionId) ? raw.orderingFriction as FrictionId : null;
  const selectedMeals = Array.isArray(raw.mealTypesToReplace) ? raw.mealTypesToReplace.filter((id): id is MealTypeId => meals.includes(id as MealTypeId)) : [];
  const mealTypes: MealTypeId[] = selectedMeals.includes('varies') ? ['varies'] : [...new Set(selectedMeals)];
  const selectedPriorities = Array.isArray(raw.recipePriorities)
    ? raw.recipePriorities.map(normalizePriority).filter((id): id is RecipePriorityId => id !== null)
    : [];
  const legacyPriority = normalizePriority(raw.recipePriority);
  const recipePriorities = [...new Set(legacyPriority ? [...selectedPriorities, legacyPriority] : selectedPriorities)].slice(0, 2);
  const household = raw.householdSize === '5_plus' || (isInt(raw.householdSize) && raw.householdSize >= 1 && raw.householdSize <= 4)
    ? raw.householdSize as HouseholdSize : null;
  const legacyAmount = isLegacy && isInt(raw.savingsGoalAmountCents)
    ? raw.savingsGoalAmountCents
    : isInt(raw.legacySavingsGoalAmountCents) ? raw.legacySavingsGoalAmountCents : null;
  const legacyGoal = isLegacy ? normalizeOnboardingGoal(raw.goal) : normalizeOnboardingGoal(raw.legacyGoal);
  const derived = derivedGoalFor(count, cents, target);
  const incomingStep = typeof raw.currentStep === 'string' ? raw.currentStep : 'intro';
  const currentStep = SAVE_MONEY_STEPS.includes(incomingStep as SaveMoneyStep)
    ? incomingStep as SaveMoneyStep
    : legacyStepMap[incomingStep] ?? 'intro';
  const skippedOptionalSteps = Array.isArray(raw.skippedOptionalSteps)
    ? raw.skippedOptionalSteps.filter((step): step is SaveMoneyStep => SAVE_MONEY_OPTIONAL_STEPS.includes(step as (typeof SAVE_MONEY_OPTIONAL_STEPS)[number]))
    : [];
  const draft: SaveMoneyDraft = {
    version: 2, currentStep, weeklyEatingOutCount: count, eatingOutCostCents: cents, orderingFriction: friction,
    orderingFrictionOtherText: normalizeCustomText(raw.orderingFrictionOtherText),
    mealTypesToReplace: mealTypes, weeklyReplacementTarget: target, recipePriorities,
    recipePriorityOtherText: normalizeCustomText(raw.recipePriorityOtherText), recipePriority: recipePriorities[0] ?? null,
    householdSize: household, savingsGoalAmountCents: derived.amountCents, goal: derived.goal,
    legacySavingsGoalAmountCents: legacyAmount, legacyGoal, skippedOptionalSteps: [...new Set(skippedOptionalSteps)], branchCompleted: raw.branchCompleted === true,
  };
  return { ...draft, currentStep: routeForSaveMoneyDraft(draft) };
}

export type SaveMoneyEvent =
  | { type: 'FREQUENCY_SAVED'; count: number }
  | { type: 'COST_SAVED'; cents: number }
  | { type: 'FRICTION_SELECTED'; friction: FrictionId }
  | { type: 'FRICTION_OTHER_TEXT_CHANGED'; text: string }
  | { type: 'MEAL_TYPE_TOGGLED'; mealType: MealTypeId }
  | { type: 'REPLACEMENT_TARGET_SAVED'; target: number }
  | { type: 'PRIORITY_TOGGLED'; priority: RecipePriorityId }
  | { type: 'PRIORITY_SELECTED'; priority: RecipePriorityId }
  | { type: 'PRIORITY_OTHER_TEXT_CHANGED'; text: string }
  | { type: 'HOUSEHOLD_SIZE_SELECTED'; size: HouseholdSize }
  | { type: 'NEXT_PRESSED'; skipSteps?: readonly SaveMoneyStep[]; omitRecipePriorities?: boolean }
  | { type: 'OPTIONAL_STEP_SKIPPED' }
  | { type: 'BACK_PRESSED'; skipSteps?: readonly SaveMoneyStep[] }
  | { type: 'BRANCH_COMPLETED' }
  | { type: 'HYDRATED'; draft: unknown };

export function saveMoneyReducer(state: SaveMoneyDraft, event: SaveMoneyEvent): SaveMoneyDraft {
  if (event.type === 'HYDRATED') return normalizeSaveMoneyDraft(event.draft);
  let next: SaveMoneyDraft = { ...state, mealTypesToReplace: [...state.mealTypesToReplace], recipePriorities: [...state.recipePriorities], skippedOptionalSteps: [...state.skippedOptionalSteps] };
  if (event.type === 'FREQUENCY_SAVED' && isInt(event.count) && event.count >= 0 && event.count <= 30) {
    next.weeklyEatingOutCount = event.count;
    next.weeklyReplacementTarget = Math.min(next.weeklyReplacementTarget, event.count);
  }
  if (event.type === 'COST_SAVED' && isInt(event.cents) && event.cents >= 100 && event.cents <= 50_000) next.eatingOutCostCents = event.cents;
  if (event.type === 'FRICTION_SELECTED' && frictions.includes(event.friction)) next.orderingFriction = event.friction;
  if (event.type === 'FRICTION_OTHER_TEXT_CHANGED') next.orderingFrictionOtherText = normalizeCustomText(event.text);
  if (event.type === 'MEAL_TYPE_TOGGLED') {
    next.mealTypesToReplace = event.mealType === 'varies' ? ['varies'] : next.mealTypesToReplace.includes(event.mealType)
      ? next.mealTypesToReplace.filter((meal) => meal !== event.mealType)
      : [...next.mealTypesToReplace.filter((meal) => meal !== 'varies'), event.mealType];
  }
  if (event.type === 'REPLACEMENT_TARGET_SAVED' && isInt(event.target) && event.target >= 0 && event.target <= next.weeklyEatingOutCount) next.weeklyReplacementTarget = event.target;
  if (event.type === 'PRIORITY_TOGGLED' || event.type === 'PRIORITY_SELECTED') {
    const priority = event.priority;
    next.recipePriorities = next.recipePriorities.includes(priority) ? next.recipePriorities.filter((id) => id !== priority)
      : next.recipePriorities.length < 2 ? [...next.recipePriorities, priority] : next.recipePriorities;
    next.recipePriority = next.recipePriorities[0] ?? null;
  }
  if (event.type === 'PRIORITY_OTHER_TEXT_CHANGED') next.recipePriorityOtherText = normalizeCustomText(event.text);
  if (event.type === 'HOUSEHOLD_SIZE_SELECTED') next.householdSize = event.size;
  if (event.type === 'BRANCH_COMPLETED') { next.branchCompleted = true; next.currentStep = 'complete'; }
  if (event.type === 'NEXT_PRESSED') {
    const blocked = next.currentStep === 'planSetup' && ((!event.omitRecipePriorities && next.recipePriorities.length === 0) || next.householdSize === null);
    if (!blocked && next.currentStep !== 'reveal' && next.currentStep !== 'complete') {
      const index = SAVE_MONEY_STEPS.indexOf(next.currentStep);
      next.currentStep = SAVE_MONEY_STEPS[Math.min(index + 1, SAVE_MONEY_STEPS.length - 1)];
      while (event.skipSteps?.includes(next.currentStep) && next.currentStep !== 'reveal' && next.currentStep !== 'complete') {
        const skippedIndex = SAVE_MONEY_STEPS.indexOf(next.currentStep);
        next.currentStep = SAVE_MONEY_STEPS[Math.min(skippedIndex + 1, SAVE_MONEY_STEPS.length - 1)];
      }
    }
  }
  if (event.type === 'OPTIONAL_STEP_SKIPPED' && SAVE_MONEY_OPTIONAL_STEPS.includes(next.currentStep as (typeof SAVE_MONEY_OPTIONAL_STEPS)[number])) {
    const index = SAVE_MONEY_STEPS.indexOf(next.currentStep);
    next.currentStep = SAVE_MONEY_STEPS[Math.min(index + 1, SAVE_MONEY_STEPS.length - 1)];
    if (!next.skippedOptionalSteps.includes(state.currentStep)) next.skippedOptionalSteps.push(state.currentStep);
  }
  if (event.type === 'BACK_PRESSED') {
    const index = SAVE_MONEY_STEPS.indexOf(next.currentStep);
    next.currentStep = next.currentStep === 'complete' ? 'reveal' : SAVE_MONEY_STEPS[Math.max(index - 1, 0)];
    while (event.skipSteps?.includes(next.currentStep) && next.currentStep !== 'intro') {
      const previousIndex = SAVE_MONEY_STEPS.indexOf(next.currentStep);
      next.currentStep = SAVE_MONEY_STEPS[Math.max(previousIndex - 1, 0)];
    }
    if (state.branchCompleted) next.branchCompleted = false;
  }
  const derived = derivedGoalFor(next.weeklyEatingOutCount, next.eatingOutCostCents, next.weeklyReplacementTarget);
  next.savingsGoalAmountCents = derived.amountCents;
  next.goal = derived.goal;
  const normalized = normalizeSaveMoneyDraft(next);
  return { ...normalized, currentStep: next.currentStep };
}

export function calculateEatingOutSpend(count: number, cents: number) {
  const weeklySpendCents = Math.max(0, Math.round(count)) * Math.max(0, Math.round(cents));
  const annualSpendCents = weeklySpendCents * 52;
  return { weeklySpendCents, annualSpendCents, monthlySpendCents: Math.round(annualSpendCents / 12) };
}

export function calculateSavingsProjection({ weeklyEatingOutCount, eatingOutCostCents, weeklyReplacementTarget }: {
  weeklyEatingOutCount: number; eatingOutCostCents: number; weeklyReplacementTarget: number;
}) {
  const count = clamp(Math.round(weeklyEatingOutCount), 0, 30);
  const cost = clamp(Math.round(eatingOutCostCents), 0, 50_000);
  const replacements = clamp(Math.round(weeklyReplacementTarget), 0, count);
  const estimatedHomeCostCents = Math.min(cost, HOME_MEAL_ESTIMATE_CENTS);
  const currentWeeklyCostCents = count * cost;
  const projectedWeeklyCostCents = (count - replacements) * cost + replacements * estimatedHomeCostCents;
  const weeklyPotentialSavingsCents = Math.max(0, currentWeeklyCostCents - projectedWeeklyCostCents);
  const annualPotentialSavingsCents = weeklyPotentialSavingsCents * 52;
  return {
    currentWeeklyCostCents, projectedWeeklyCostCents, weeklyPotentialSavingsCents,
    monthlyPotentialSavingsCents: Math.round(annualPotentialSavingsCents / 12), annualPotentialSavingsCents,
    estimatedHomeCostCents, replacements,
  };
}
