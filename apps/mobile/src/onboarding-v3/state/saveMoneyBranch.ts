export const SAVE_MONEY_STEPS = ['intro', 'frequency', 'cost', 'spendingGraph', 'friction', 'encouragement', 'mealType', 'replacementTarget', 'recipePriority', 'reassurance', 'householdSize', 'reveal', 'complete'] as const;
export type SaveMoneyStep = typeof SAVE_MONEY_STEPS[number];
export type FrictionId = 'time' | 'energy' | 'ideas' | 'ingredients' | 'cravings' | 'cleanup' | 'other';
export type MealTypeId = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'varies';
export type RecipePriorityId = 'lowest_cost' | 'same_taste' | 'fast_easy' | 'healthier_ingredients' | 'leftovers';
export type HouseholdSize = 1 | 2 | 3 | 4 | '5_plus';
export type SaveMoneyDraft = { version: 1; currentStep: SaveMoneyStep; weeklyEatingOutCount: number | null; eatingOutCostCents: number | null; orderingFriction: FrictionId | null; mealTypesToReplace: MealTypeId[]; weeklyReplacementTarget: number | null; recipePriority: RecipePriorityId | null; householdSize: HouseholdSize | null; branchCompleted: boolean };
export const initialSaveMoneyDraft: SaveMoneyDraft = { version: 1, currentStep: 'intro', weeklyEatingOutCount: null, eatingOutCostCents: null, orderingFriction: null, mealTypesToReplace: [], weeklyReplacementTarget: null, recipePriority: null, householdSize: null, branchCompleted: false };
const frictions: FrictionId[] = ['time', 'energy', 'ideas', 'ingredients', 'cravings', 'cleanup', 'other'];
const meals: MealTypeId[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'varies'];
const priorities: RecipePriorityId[] = ['lowest_cost', 'same_taste', 'fast_easy', 'healthier_ingredients', 'leftovers'];
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
export function routeForSaveMoneyDraft(draft: SaveMoneyDraft): SaveMoneyStep {
  // A completed branch may be deliberately backed out to its reveal screen.
  // Any other completed snapshot remains at the development-only terminal step.
  if (draft.branchCompleted) return draft.currentStep === 'reveal' ? 'reveal' : 'complete';
  if (draft.weeklyEatingOutCount === null) return draft.currentStep === 'intro' ? 'intro' : 'frequency';
  if (draft.eatingOutCostCents === null) return 'cost';
  if (draft.currentStep === 'spendingGraph') return 'spendingGraph';
  if (draft.orderingFriction === null) return 'friction';
  if (draft.currentStep === 'encouragement') return 'encouragement';
  if (!draft.mealTypesToReplace.length) return 'mealType';
  if (draft.weeklyReplacementTarget === null) return 'replacementTarget';
  if (draft.recipePriority === null) return 'recipePriority';
  if (draft.currentStep === 'reassurance') return 'reassurance';
  if (draft.householdSize === null) return 'householdSize';
  if (draft.currentStep === 'reveal') return 'reveal';
  return 'reveal';
}
export function normalizeSaveMoneyDraft(value: unknown): SaveMoneyDraft {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return { ...initialSaveMoneyDraft };
  const raw = value as Partial<SaveMoneyDraft>;
  const count = isInt(raw.weeklyEatingOutCount) && raw.weeklyEatingOutCount >= 0 && raw.weeklyEatingOutCount <= 21 ? raw.weeklyEatingOutCount : null;
  const cents = isInt(raw.eatingOutCostCents) && raw.eatingOutCostCents >= 100 && raw.eatingOutCostCents <= 50000 ? raw.eatingOutCostCents : null;
  const friction = frictions.includes(raw.orderingFriction as FrictionId) ? raw.orderingFriction as FrictionId : null;
  const selected = Array.isArray(raw.mealTypesToReplace) ? raw.mealTypesToReplace.filter((id): id is MealTypeId => meals.includes(id as MealTypeId)) : [];
  const mealTypes: MealTypeId[] = selected.includes('varies') ? ['varies'] : [...new Set(selected)];
  const target = isInt(raw.weeklyReplacementTarget) && raw.weeklyReplacementTarget >= 0 && (count === null || raw.weeklyReplacementTarget <= count) ? raw.weeklyReplacementTarget : null;
  const priority = priorities.includes(raw.recipePriority as RecipePriorityId) ? raw.recipePriority as RecipePriorityId : null;
  const household = raw.householdSize === '5_plus' || (isInt(raw.householdSize) && raw.householdSize >= 1 && raw.householdSize <= 4) ? raw.householdSize as HouseholdSize : null;
  const draft: SaveMoneyDraft = { version: 1, currentStep: SAVE_MONEY_STEPS.includes(raw.currentStep as SaveMoneyStep) ? raw.currentStep as SaveMoneyStep : 'intro', weeklyEatingOutCount: count, eatingOutCostCents: cents, orderingFriction: friction, mealTypesToReplace: mealTypes, weeklyReplacementTarget: target, recipePriority: priority, householdSize: household, branchCompleted: raw.branchCompleted === true };
  return { ...draft, currentStep: routeForSaveMoneyDraft(draft) };
}
export type SaveMoneyEvent = { type: 'FREQUENCY_SAVED'; count: number } | { type: 'COST_SAVED'; cents: number } | { type: 'FRICTION_SELECTED'; friction: FrictionId } | { type: 'MEAL_TYPE_TOGGLED'; mealType: MealTypeId } | { type: 'REPLACEMENT_TARGET_SAVED'; target: number } | { type: 'PRIORITY_SELECTED'; priority: RecipePriorityId } | { type: 'HOUSEHOLD_SIZE_SELECTED'; size: HouseholdSize } | { type: 'NEXT_PRESSED' } | { type: 'BACK_PRESSED' } | { type: 'BRANCH_COMPLETED' } | { type: 'HYDRATED'; draft: unknown };
export function saveMoneyReducer(state: SaveMoneyDraft, event: SaveMoneyEvent): SaveMoneyDraft {
  if (event.type === 'HYDRATED') return normalizeSaveMoneyDraft(event.draft);
  let next = { ...state };
  if (event.type === 'FREQUENCY_SAVED' && isInt(event.count) && event.count >= 0 && event.count <= 21) next.weeklyEatingOutCount = event.count;
  if (event.type === 'COST_SAVED' && isInt(event.cents) && event.cents >= 100 && event.cents <= 50000) next.eatingOutCostCents = event.cents;
  if (event.type === 'FRICTION_SELECTED' && frictions.includes(event.friction)) next.orderingFriction = event.friction;
  if (event.type === 'MEAL_TYPE_TOGGLED') next.mealTypesToReplace = event.mealType === 'varies' ? ['varies'] : next.mealTypesToReplace.includes(event.mealType) ? next.mealTypesToReplace.filter((m) => m !== event.mealType) : [...next.mealTypesToReplace.filter((m) => m !== 'varies'), event.mealType];
  if (event.type === 'REPLACEMENT_TARGET_SAVED' && isInt(event.target) && event.target >= 0 && (next.weeklyEatingOutCount === null || event.target <= next.weeklyEatingOutCount)) next.weeklyReplacementTarget = event.target;
  if (event.type === 'PRIORITY_SELECTED') next.recipePriority = event.priority;
  if (event.type === 'HOUSEHOLD_SIZE_SELECTED') next.householdSize = event.size;
  if (event.type === 'BRANCH_COMPLETED') { next.branchCompleted = true; next.currentStep = 'complete'; }
  if (event.type === 'NEXT_PRESSED') { const index = SAVE_MONEY_STEPS.indexOf(next.currentStep); next.currentStep = SAVE_MONEY_STEPS[Math.min(index + 1, SAVE_MONEY_STEPS.length - 1)]; }
  if (event.type === 'BACK_PRESSED') { const index = SAVE_MONEY_STEPS.indexOf(next.currentStep); next.currentStep = SAVE_MONEY_STEPS[Math.max(index - 1, 0)]; }
  const normalized = normalizeSaveMoneyDraft(next);
  // Reducer transitions own transient screens (graph, encouragement, and
  // reassurance); normalization only resolves persisted snapshots on hydrate.
  return { ...normalized, currentStep: next.currentStep };
}
export function calculateEatingOutSpend(count: number, cents: number) { const weeklySpendCents = count * cents; const annualSpendCents = weeklySpendCents * 52; return { weeklySpendCents, annualSpendCents, monthlySpendCents: Math.round(annualSpendCents / 12) }; }
