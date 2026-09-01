// Hit my macros onboarding branch — state machine for the development-preview
// redesign (gated by isHitMacrosStage2PreviewEnabled). Same friendly
// food-coaching shape as the Eat Healthier redesign: an intro, seven questions,
// a dynamic insight/response beat after most of them, a reassurance moment, a
// personalized approach, a "what Okyo does" beat, a flexible-commitment
// question, a personalized reveal, and a plan summary.
//
//   intro → focus(Q) → focusInsight → proteinWeight(Q) → [proteinPreference] →
//   calorieCheck(Q) → calorieInsight → barrier(Q) → barrierResponse →
//   mealToImprove(Q) → mealInsight → trackingStyle(Q) → reassurance → approach →
//   whatOkyoDoes → commitment(Q) → reveal → complete
//
// Persistence stays version 2. Legacy step ids from the previous preview are
// remapped on hydrate so a mid-flow dev draft is never dropped.
export const MACROS_STEPS = [
  'intro',
  'focus',
  'focusInsight',
  'proteinWeight',
  'proteinPreference',
  'calorieCheck',
  'calorieInsight',
  'barrier',
  'barrierResponse',
  'mealToImprove',
  'mealInsight',
  'trackingStyle',
  'reassurance',
  'approach',
  'whatOkyoDoes',
  'commitment',
  'reveal',
  'complete',
] as const;
export type MacrosStep = typeof MACROS_STEPS[number];

/** The seven answered questions the progress bar counts. */
export const MACROS_QUESTION_STEPS: readonly MacrosStep[] = ['focus', 'proteinWeight', 'calorieCheck', 'barrier', 'mealToImprove', 'trackingStyle', 'commitment'];

export type MacroFocusId = 'more_protein' | 'fewer_calories' | 'more_balanced_macros' | 'better_workout_fuel' | 'maintain' | 'not_sure';
export type ProteinTargetStatus = 'yes_know_it' | 'flexible_range' | 'no' | 'not_sure';
export type ProteinMultiplier = 1 | 1.3 | 1.6;
export type BodyWeightUnit = 'lb' | 'kg';
export type CalorieTrackingStatus = 'yes_has_target' | 'sometimes' | 'no' | 'not_sure';
export type MacroBarrierId = 'estimating_portions' | 'getting_enough_protein' | 'inaccurate_nutrition' | 'doesnt_taste_good' | 'meal_prep_time' | 'staying_consistent' | 'dont_know_targets';
export type MacrosMealToImproveId = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'it_varies';
export type TrackingStyleId = 'exact_numbers' | 'flexible_ranges' | 'simple_suggestions' | 'just_show_info';
export type MacroCommitmentId = 'few_aligned_meals' | 'most_days' | 'ease_in' | 'not_sure';
export type ProteinTargetRange = { min: number; max: number };

export type MacrosDraft = {
  version: 2;
  currentStep: MacrosStep;
  macroFocus: MacroFocusId | null;
  bodyWeight: number | null;
  bodyWeightUnit: BodyWeightUnit;
  proteinMultiplier: ProteinMultiplier | null;
  proteinTargetStatus: ProteinTargetStatus | null;
  proteinTargetGrams: number | null;
  proteinTargetRange: ProteinTargetRange | null;
  calorieTrackingStatus: CalorieTrackingStatus | null;
  calorieTarget: number | null;
  macroBarrier: MacroBarrierId | null;
  mealToImprove: MacrosMealToImproveId | null;
  trackingStyle: TrackingStyleId | null;
  flexibleCommitment: MacroCommitmentId | null;
  // Retained — no live screen collects this any more.
  weeklyCookingCount: number | null;
  branchCompleted: boolean;
};

export const initialMacrosDraft: MacrosDraft = {
  version: 2, currentStep: 'intro', macroFocus: null, bodyWeight: null, bodyWeightUnit: 'lb', proteinMultiplier: null,
  proteinTargetStatus: null, proteinTargetGrams: null, proteinTargetRange: null, calorieTrackingStatus: null, calorieTarget: null,
  macroBarrier: null, mealToImprove: null, trackingStyle: null, flexibleCommitment: null, weeklyCookingCount: null, branchCompleted: false,
};

const focuses: MacroFocusId[] = ['more_protein', 'fewer_calories', 'more_balanced_macros', 'better_workout_fuel', 'maintain', 'not_sure'];
const proteinStatuses: ProteinTargetStatus[] = ['yes_know_it', 'flexible_range', 'no', 'not_sure'];
const multipliers: ProteinMultiplier[] = [1, 1.3, 1.6];
const calorieStatuses: CalorieTrackingStatus[] = ['yes_has_target', 'sometimes', 'no', 'not_sure'];
const barriers: MacroBarrierId[] = ['estimating_portions', 'getting_enough_protein', 'inaccurate_nutrition', 'doesnt_taste_good', 'meal_prep_time', 'staying_consistent', 'dont_know_targets'];
const mealsToImprove: MacrosMealToImproveId[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'it_varies'];
const trackingStyles: TrackingStyleId[] = ['exact_numbers', 'flexible_ranges', 'simple_suggestions', 'just_show_info'];
const commitments: MacroCommitmentId[] = ['few_aligned_meals', 'most_days', 'ease_in', 'not_sure'];

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isGrams = (value: unknown): value is number => isInt(value) && value >= 20 && value <= 400;
const isWeight = (value: unknown, unit: BodyWeightUnit): value is number => typeof value === 'number' && Number.isFinite(value) && (unit === 'lb' ? value >= 50 && value <= 700 : value >= 23 && value <= 318);

/** A user-selected preference expressed in grams per pound of body weight. */
export function calculateProteinPreferenceGrams(weight: number, unit: BodyWeightUnit, multiplier: ProteinMultiplier): number {
  const pounds = unit === 'kg' ? weight * 2.2046226218 : weight;
  return Math.round(pounds * multiplier);
}

function nextStep(state: MacrosDraft): MacrosStep {
  switch (state.currentStep) {
    case 'intro': return 'focus';
    case 'focus': return 'focusInsight';
    case 'focusInsight': return 'proteinWeight';
    case 'proteinWeight': return state.bodyWeight === null ? 'calorieCheck' : 'proteinPreference';
    case 'proteinPreference': return 'calorieCheck';
    case 'calorieCheck': return 'calorieInsight';
    case 'calorieInsight': return 'barrier';
    case 'barrier': return 'barrierResponse';
    case 'barrierResponse': return 'mealToImprove';
    case 'mealToImprove': return 'mealInsight';
    case 'mealInsight': return 'trackingStyle';
    case 'trackingStyle': return 'reassurance';
    case 'reassurance': return 'approach';
    case 'approach': return 'whatOkyoDoes';
    case 'whatOkyoDoes': return 'commitment';
    case 'commitment': return 'reveal';
    case 'reveal': return 'reveal';
    case 'complete': return 'complete';
  }
}

function previousStep(state: MacrosDraft): MacrosStep {
  switch (state.currentStep) {
    case 'intro': return 'intro';
    case 'focus': return 'intro';
    case 'focusInsight': return 'focus';
    case 'proteinWeight': return 'focusInsight';
    case 'proteinPreference': return 'proteinWeight';
    case 'calorieCheck': return state.bodyWeight === null ? 'proteinWeight' : 'proteinPreference';
    case 'calorieInsight': return 'calorieCheck';
    case 'barrier': return 'calorieInsight';
    case 'barrierResponse': return 'barrier';
    case 'mealToImprove': return 'barrierResponse';
    case 'mealInsight': return 'mealToImprove';
    case 'trackingStyle': return 'mealInsight';
    case 'reassurance': return 'trackingStyle';
    case 'approach': return 'reassurance';
    case 'whatOkyoDoes': return 'approach';
    case 'commitment': return 'whatOkyoDoes';
    case 'reveal': return 'commitment';
    case 'complete': return 'reveal';
  }
}

export function routeForMacrosDraft(draft: MacrosDraft): MacrosStep {
  if (draft.branchCompleted) return draft.currentStep === 'reveal' ? 'reveal' : 'complete';
  if (draft.macroFocus === null) return 'focus';
  if (draft.bodyWeight === null && draft.proteinTargetStatus === null) return 'proteinWeight';
  if (draft.bodyWeight !== null && draft.proteinMultiplier === null && draft.proteinTargetStatus === null) return 'proteinPreference';
  if (draft.proteinTargetStatus === null) return draft.bodyWeight === null ? 'proteinWeight' : 'proteinPreference';
  if (draft.calorieTrackingStatus === null) return 'calorieCheck';
  if (draft.macroBarrier === null) return 'barrier';
  if (draft.mealToImprove === null) return 'mealToImprove';
  if (draft.trackingStyle === null) return 'trackingStyle';
  if (draft.flexibleCommitment === null) return 'commitment';
  return 'reveal';
}

const LEGACY_STEPS: Record<string, MacrosStep> = {
  bodyWeight: 'proteinWeight',
  calorieTracking: 'calorieCheck',
  frequency: 'commitment',
  acknowledgment: 'focus',
  proteinTarget: 'proteinWeight',
};

function normalStep(rawStep: unknown, legacy: boolean, draft: MacrosDraft): MacrosStep {
  if (typeof rawStep === 'string') {
    if (legacy && (rawStep === 'intro' || rawStep === 'acknowledgment')) {
      return draft.macroFocus ? (draft.proteinTargetStatus ? 'calorieCheck' : 'proteinWeight') : 'focus';
    }
    if (LEGACY_STEPS[rawStep]) return LEGACY_STEPS[rawStep];
    if (MACROS_STEPS.includes(rawStep as MacrosStep)) return rawStep as MacrosStep;
  }
  return routeForMacrosDraft(draft);
}

function isReachableStep(draft: MacrosDraft, step: MacrosStep): boolean {
  const hasFocus = draft.macroFocus !== null;
  const hasProtein = draft.proteinTargetStatus !== null;
  const hasCalorie = draft.calorieTrackingStatus !== null;
  const hasBarrier = draft.macroBarrier !== null;
  const hasMeal = draft.mealToImprove !== null;
  const hasTracking = draft.trackingStyle !== null;
  const hasCommitment = draft.flexibleCommitment !== null;
  switch (step) {
    case 'intro': return !hasFocus && !hasProtein && !hasCalorie && !hasBarrier && !hasMeal && !hasTracking && !hasCommitment;
    case 'focus': return true;
    case 'focusInsight': return hasFocus;
    case 'proteinWeight': return hasFocus;
    case 'proteinPreference': return hasFocus && draft.bodyWeight !== null;
    case 'calorieCheck': return hasFocus && hasProtein;
    case 'calorieInsight': return hasCalorie;
    case 'barrier': return hasCalorie;
    case 'barrierResponse': return hasBarrier;
    case 'mealToImprove': return hasBarrier;
    case 'mealInsight': return hasMeal;
    case 'trackingStyle': return hasMeal;
    case 'reassurance': return hasTracking;
    case 'approach': return hasTracking;
    case 'whatOkyoDoes': return hasTracking;
    case 'commitment': return hasTracking;
    case 'reveal': return hasCommitment;
    case 'complete': return draft.branchCompleted;
  }
}

export function normalizeMacrosDraft(value: unknown): MacrosDraft {
  if (!value || typeof value !== 'object') return { ...initialMacrosDraft };
  const raw = value as Record<string, unknown>;
  const legacy = raw.version === 1;
  if (raw.version !== 2 && !legacy) return { ...initialMacrosDraft };
  const focus = focuses.includes(raw.macroFocus as MacroFocusId) ? raw.macroFocus as MacroFocusId : null;
  const unit: BodyWeightUnit = raw.bodyWeightUnit === 'kg' ? 'kg' : 'lb';
  const weight = isWeight(raw.bodyWeight, unit) ? raw.bodyWeight : null;
  const multiplier = multipliers.includes(raw.proteinMultiplier as ProteinMultiplier) ? raw.proteinMultiplier as ProteinMultiplier : null;
  const proteinStatus = proteinStatuses.includes(raw.proteinTargetStatus as ProteinTargetStatus) ? raw.proteinTargetStatus as ProteinTargetStatus : null;
  const grams = proteinStatus === 'yes_know_it' && isGrams(raw.proteinTargetGrams) ? raw.proteinTargetGrams : null;
  const rawRange = raw.proteinTargetRange as Partial<ProteinTargetRange> | null | undefined;
  const range = proteinStatus === 'flexible_range' && rawRange && isGrams(rawRange.min) && isGrams(rawRange.max) && rawRange.min <= rawRange.max ? { min: rawRange.min, max: rawRange.max } : null;
  const calorieStatus = calorieStatuses.includes(raw.calorieTrackingStatus as CalorieTrackingStatus) ? raw.calorieTrackingStatus as CalorieTrackingStatus : null;
  const calorieTarget = calorieStatus === 'yes_has_target' && isInt(raw.calorieTarget) && raw.calorieTarget >= 800 && raw.calorieTarget <= 6000 ? raw.calorieTarget : null;
  const barrier = barriers.includes(raw.macroBarrier as MacroBarrierId) ? raw.macroBarrier as MacroBarrierId : null;
  const meal = mealsToImprove.includes(raw.mealToImprove as MacrosMealToImproveId) ? raw.mealToImprove as MacrosMealToImproveId : null;
  const trackingStyle = trackingStyles.includes(raw.trackingStyle as TrackingStyleId) ? raw.trackingStyle as TrackingStyleId : null;
  const commitment = commitments.includes(raw.flexibleCommitment as MacroCommitmentId) ? raw.flexibleCommitment as MacroCommitmentId : null;
  const count = isInt(raw.weeklyCookingCount) && raw.weeklyCookingCount >= 0 && raw.weeklyCookingCount <= 21 ? raw.weeklyCookingCount : null;
  const draft: MacrosDraft = {
    version: 2, currentStep: 'intro', macroFocus: focus, bodyWeight: weight, bodyWeightUnit: unit, proteinMultiplier: multiplier,
    proteinTargetStatus: proteinStatus, proteinTargetGrams: grams, proteinTargetRange: range, calorieTrackingStatus: calorieStatus, calorieTarget,
    macroBarrier: barrier, mealToImprove: meal, trackingStyle, flexibleCommitment: commitment, weeklyCookingCount: count, branchCompleted: raw.branchCompleted === true,
  };
  const requestedStep = normalStep(raw.currentStep, legacy, draft);
  const currentStep = draft.branchCompleted
    ? routeForMacrosDraft({ ...draft, currentStep: requestedStep })
    : isReachableStep(draft, requestedStep) ? requestedStep : routeForMacrosDraft(draft);
  return { ...draft, currentStep };
}

export type MacrosEvent =
  | { type: 'FOCUS_SELECTED'; focus: MacroFocusId }
  | { type: 'BODY_WEIGHT_SAVED'; weight: number; unit: BodyWeightUnit }
  | { type: 'BODY_WEIGHT_CLEARED' }
  | { type: 'BODY_WEIGHT_UNIT_SELECTED'; unit: BodyWeightUnit }
  | { type: 'BODY_WEIGHT_SKIPPED' }
  | { type: 'PROTEIN_MULTIPLIER_SELECTED'; multiplier: ProteinMultiplier }
  | { type: 'PROTEIN_STATUS_SELECTED'; status: ProteinTargetStatus }
  | { type: 'PROTEIN_GRAMS_SAVED'; grams: number }
  | { type: 'PROTEIN_RANGE_SAVED'; min: number; max: number }
  | { type: 'CALORIE_STATUS_SELECTED'; status: CalorieTrackingStatus }
  | { type: 'CALORIE_TARGET_SAVED'; calories: number; isAdultConfirmed: boolean }
  | { type: 'BARRIER_SELECTED'; barrier: MacroBarrierId }
  | { type: 'MEAL_TO_IMPROVE_SELECTED'; meal: MacrosMealToImproveId }
  | { type: 'TRACKING_STYLE_SELECTED'; style: TrackingStyleId }
  | { type: 'COMMITMENT_SELECTED'; commitment: MacroCommitmentId }
  | { type: 'FREQUENCY_SAVED'; count: number }
  | { type: 'NEXT_PRESSED' } | { type: 'BACK_PRESSED' } | { type: 'BRANCH_COMPLETED' } | { type: 'HYDRATED'; draft: unknown };

export function macrosReducer(state: MacrosDraft, event: MacrosEvent): MacrosDraft {
  if (event.type === 'HYDRATED') return normalizeMacrosDraft(event.draft);
  const next: MacrosDraft = { ...state };
  if (event.type === 'FOCUS_SELECTED' && focuses.includes(event.focus)) next.macroFocus = event.focus;
  if (event.type === 'BODY_WEIGHT_UNIT_SELECTED' && event.unit !== next.bodyWeightUnit) { next.bodyWeightUnit = event.unit; next.bodyWeight = null; next.proteinMultiplier = null; next.proteinTargetStatus = null; next.proteinTargetGrams = null; }
  if (event.type === 'BODY_WEIGHT_SAVED' && isWeight(event.weight, event.unit)) { next.bodyWeight = event.weight; next.bodyWeightUnit = event.unit; next.proteinMultiplier = null; next.proteinTargetStatus = null; next.proteinTargetGrams = null; next.proteinTargetRange = null; }
  if (event.type === 'BODY_WEIGHT_CLEARED') { next.bodyWeight = null; next.proteinMultiplier = null; next.proteinTargetStatus = null; next.proteinTargetGrams = null; next.proteinTargetRange = null; }
  if (event.type === 'BODY_WEIGHT_SKIPPED') { next.bodyWeight = null; next.proteinMultiplier = null; next.proteinTargetStatus = 'not_sure'; next.proteinTargetGrams = null; next.proteinTargetRange = null; }
  if (event.type === 'PROTEIN_MULTIPLIER_SELECTED' && next.bodyWeight !== null && multipliers.includes(event.multiplier)) { next.proteinMultiplier = event.multiplier; next.proteinTargetStatus = 'yes_know_it'; next.proteinTargetGrams = calculateProteinPreferenceGrams(next.bodyWeight, next.bodyWeightUnit, event.multiplier); next.proteinTargetRange = null; }
  if (event.type === 'PROTEIN_STATUS_SELECTED' && proteinStatuses.includes(event.status)) { next.proteinTargetStatus = event.status; next.proteinTargetGrams = null; next.proteinTargetRange = null; next.proteinMultiplier = null; }
  if (event.type === 'PROTEIN_GRAMS_SAVED' && next.proteinTargetStatus === 'yes_know_it' && isGrams(event.grams)) next.proteinTargetGrams = event.grams;
  if (event.type === 'PROTEIN_RANGE_SAVED' && next.proteinTargetStatus === 'flexible_range' && isGrams(event.min) && isGrams(event.max) && event.min <= event.max) next.proteinTargetRange = { min: event.min, max: event.max };
  if (event.type === 'CALORIE_STATUS_SELECTED' && calorieStatuses.includes(event.status)) { next.calorieTrackingStatus = event.status; next.calorieTarget = null; }
  if (event.type === 'CALORIE_TARGET_SAVED' && next.calorieTrackingStatus === 'yes_has_target' && event.isAdultConfirmed && isInt(event.calories) && event.calories >= 800 && event.calories <= 6000) next.calorieTarget = event.calories;
  if (event.type === 'BARRIER_SELECTED' && barriers.includes(event.barrier)) next.macroBarrier = event.barrier;
  if (event.type === 'MEAL_TO_IMPROVE_SELECTED' && mealsToImprove.includes(event.meal)) next.mealToImprove = event.meal;
  if (event.type === 'TRACKING_STYLE_SELECTED' && trackingStyles.includes(event.style)) next.trackingStyle = event.style;
  if (event.type === 'COMMITMENT_SELECTED' && commitments.includes(event.commitment)) next.flexibleCommitment = event.commitment;
  if (event.type === 'FREQUENCY_SAVED' && isInt(event.count) && event.count >= 0 && event.count <= 21) next.weeklyCookingCount = event.count;
  if (event.type === 'BRANCH_COMPLETED') return { ...next, branchCompleted: true, currentStep: 'complete' };
  if (event.type === 'NEXT_PRESSED') next.currentStep = nextStep(next);
  if (event.type === 'BACK_PRESSED') next.currentStep = previousStep(next);
  return next;
}
