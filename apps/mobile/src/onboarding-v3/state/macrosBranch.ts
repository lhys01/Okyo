import {
  addLocalDays,
  localDateKey,
  normalizeOnboardingGoal,
  type OnboardingGoal,
} from "./onboardingGoal";
import {
  calculateNutritionTargets,
  emptyNutritionProfile,
  type NutritionProfile,
} from "./nutritionTargets";

/** Compact, food-first macros path. Legacy field names remain so persisted V1–V3 drafts migrate safely. */
export const MACROS_STEPS = [
  "intro",
  "problem",
  "barrier",
  "diagnosis",
  "mealPriority",
  "targetMode",
  "estimateDetails",
  "knownTargets",
  "reveal",
  "complete",
] as const;
export type MacrosStep = (typeof MACROS_STEPS)[number];
export type LegacyMacrosStep =
  | "proteinTarget"
  | "calorieTarget"
  | "goal"
  | "goalDuration"
  | "cookingFrequency"
  | "mealToImprove"
  | "outcome"
  | "foodStyle"
  | "pace"
  | "approach";
export const MACROS_PROGRESS_TOTAL = 7;
export const MACROS_PROGRESS_QUESTION_STEPS = ['problem', 'barrier', 'diagnosis', 'mealPriority', 'targetMode', 'estimateDetails', 'knownTargets'] as const;
export const MACROS_PROGRESS_QUESTION_INDEX: Record<
  MacrosStep | LegacyMacrosStep,
  number
> = {
  intro: 0,
  problem: 1,
  barrier: 2,
  diagnosis: 3,
  mealPriority: 4,
  targetMode: 5,
  estimateDetails: 6,
  knownTargets: 6,
  reveal: 7,
  complete: 7,
  proteinTarget: 6,
  calorieTarget: 6,
  goal: 6,
  goalDuration: 6,
  cookingFrequency: 3,
  mealToImprove: 3,
  outcome: 3,
  foodStyle: 4,
  pace: 4,
  approach: 3,
};

export type MacroFocusId =
  | "low_protein"
  | "calorie_inconsistency"
  | "meals_miss_targets"
  | "portion_confusion"
  | "tracking_friction"
  | "food_uncertainty";
export type MacroBarrierId =
  | "boring"
  | "time"
  | "hunger"
  | "cost"
  | "eating_out"
  | "planning"
  | "consistency";
export type MacrosMealToImproveId =
  "breakfast" | "lunch" | "dinner" | "snacks" | "it_varies";
export type CookingFrequencyId =
  | "almost_never"
  | "one_to_two_week"
  | "three_to_four_week"
  | "five_to_six_week"
  | "every_day";
export type MacroOutcomeId =
  | "more_protein"
  | "closer_calories"
  | "more_consistent"
  | "better_portions"
  | "meals_fit_targets"
  | "stop_guessing";
export type MacroMealPriorityId =
  | "tastes_good"
  | "keeps_me_full"
  | "quick_to_make"
  | "simple_ingredients"
  | "fits_budget"
  | "feels_familiar"
  | "high_protein"
  | "fits_calories";
export type MacroRecipePriorityId = Exclude<
  MacroMealPriorityId,
  "high_protein" | "fits_calories"
>;
export type MacroFoodStyleId =
  | "comfort_food"
  | "fresh_colorful"
  | "high_protein"
  | "quick_simple"
  | "international"
  | "a_bit_of_everything";
export type MacroPaceId =
  | "very_consistent"
  | "weekly_rhythm"
  | "start_gradually"
  | "one_meal_at_a_time";
export type MacroTargetMode =
  | "calculate_estimate"
  | "known_targets"
  | "keep_flexible"
  | "protein_and_calories"
  | "protein_only";
export type MacroGoalId =
  | "protein_five"
  | "macro_five"
  | "streak_seven"
  | "meal_daily"
  | "meals_fourteen"
  | "meals_fit_five"
  | "portions_five"
  | "tracking_simple"
  | "plan_three"
  | "custom";
export type MacroGoalDurationWeeks = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type MacrosDraft = {
  version: 4;
  currentStep: MacrosStep | LegacyMacrosStep;
  macroFocus: MacroFocusId | null;
  macroBarrier: MacroBarrierId | null;
  mealToImprove: MacrosMealToImproveId | null;
  cookingFrequency: CookingFrequencyId | null;
  macroOutcome: MacroOutcomeId | null;
  mealPriority: MacroMealPriorityId | null;
  recipePriorities: MacroRecipePriorityId[];
  foodStyles: MacroFoodStyleId[];
  flexibleCommitment: MacroPaceId | null;
  targetMode: MacroTargetMode | null;
  proteinTargetGrams: number | null;
  calorieTarget: number | null;
  calorieTargetManuallyEdited: boolean;
  carbTargetGrams: number | null;
  fatTargetGrams: number | null;
  estimateProfile: NutritionProfile;
  weeklyChangePounds: number;
  macroGoal: MacroGoalId | null;
  customMacroGoal: string;
  goalDurationWeeks: MacroGoalDurationWeeks;
  goal: OnboardingGoal | null;
  branchCompleted: boolean;
};
export const initialMacrosDraft: MacrosDraft = {
  version: 4,
  currentStep: "intro",
  macroFocus: null,
  macroBarrier: null,
  mealToImprove: null,
  cookingFrequency: null,
  mealPriority: null,
  macroOutcome: null,
  recipePriorities: [],
  foodStyles: [],
  flexibleCommitment: null,
  targetMode: null,
  proteinTargetGrams: null,
  calorieTarget: null,
  calorieTargetManuallyEdited: false,
  carbTargetGrams: null,
  fatTargetGrams: null,
  estimateProfile: { ...emptyNutritionProfile },
  weeklyChangePounds: 0,
  macroGoal: null,
  customMacroGoal: "",
  goalDurationWeeks: 4,
  goal: null,
  branchCompleted: false,
};

const oneOf =
  <T extends string>(list: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === "string" && list.includes(value as T);
const isFocus = oneOf<MacroFocusId>([
  "low_protein",
  "calorie_inconsistency",
  "meals_miss_targets",
  "portion_confusion",
  "tracking_friction",
  "food_uncertainty",
]);
const isBarrier = oneOf<MacroBarrierId>([
  "boring",
  "time",
  "hunger",
  "cost",
  "eating_out",
  "planning",
  "consistency",
]);
const isMeal = oneOf<MacrosMealToImproveId>([
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
  "it_varies",
]);
const isCooking = oneOf<CookingFrequencyId>([
  "almost_never",
  "one_to_two_week",
  "three_to_four_week",
  "five_to_six_week",
  "every_day",
]);
const isOutcome = oneOf<MacroOutcomeId>([
  "more_protein",
  "closer_calories",
  "more_consistent",
  "better_portions",
  "meals_fit_targets",
  "stop_guessing",
]);
const isPriority = oneOf<MacroMealPriorityId>([
  "tastes_good",
  "keeps_me_full",
  "quick_to_make",
  "simple_ingredients",
  "fits_budget",
  "feels_familiar",
  "high_protein",
  "fits_calories",
]);
const isRecipePriority = oneOf<MacroRecipePriorityId>([
  "tastes_good",
  "keeps_me_full",
  "quick_to_make",
  "simple_ingredients",
  "fits_budget",
  "feels_familiar",
]);
const isFoodStyle = oneOf<MacroFoodStyleId>([
  "comfort_food",
  "fresh_colorful",
  "high_protein",
  "quick_simple",
  "international",
  "a_bit_of_everything",
]);
const isPace = oneOf<MacroPaceId>([
  "very_consistent",
  "weekly_rhythm",
  "start_gradually",
  "one_meal_at_a_time",
]);
const isTargetMode = oneOf<MacroTargetMode>([
  "calculate_estimate",
  "known_targets",
  "keep_flexible",
  "protein_and_calories",
  "protein_only",
]);
const isGoal = oneOf<MacroGoalId>([
  "protein_five",
  "macro_five",
  "streak_seven",
  "meal_daily",
  "meals_fourteen",
  "meals_fit_five",
  "portions_five",
  "tracking_simple",
  "plan_three",
  "custom",
]);
const validProtein = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 40 &&
  value <= 350 &&
  value % 5 === 0;
const validCalories = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1200 &&
  value <= 4200 &&
  value % 25 === 0;
const validMacro = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 500 &&
  value % 5 === 0;
const validWeeklyChange = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -2 &&
  value <= 2 &&
  Math.round(value * 2) === value * 2;
const isDuration = (value: unknown): value is MacroGoalDurationWeeks =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 10;
const LEGACY_FOCUS: Record<string, MacroFocusId> = {
  more_protein: "low_protein",
  fewer_calories: "calorie_inconsistency",
  more_balanced_macros: "meals_miss_targets",
  better_workout_fuel: "meals_miss_targets",
  maintain: "portion_confusion",
  not_sure: "food_uncertainty",
};
const LEGACY_BARRIER: Record<string, MacroBarrierId> = {
  estimating_portions: "planning",
  getting_enough_protein: "hunger",
  inaccurate_nutrition: "planning",
  doesnt_taste_good: "planning",
  meal_prep_time: "time",
  staying_consistent: "consistency",
  dont_know_targets: "planning",
};

export const macroGoalDefinitions: Readonly<
  Record<
    Exclude<MacroGoalId, "custom">,
    { title: string; targetValue: number; targetUnit: string }
  >
> = {
  protein_five: {
    title: "Get enough protein 5 days a week",
    targetValue: 5,
    targetUnit: "protein_days_per_week",
  },
  macro_five: {
    title: "Stay closer to my calories 5 days a week",
    targetValue: 5,
    targetUnit: "days_per_week",
  },
  streak_seven: {
    title: "Build a 7-day consistency streak",
    targetValue: 7,
    targetUnit: "day_streak",
  },
  meal_daily: {
    title: "Make one macro-friendly meal a day",
    targetValue: 1,
    targetUnit: "meal_per_day",
  },
  meals_fourteen: {
    title: "Complete 14 macro-friendly meals",
    targetValue: 14,
    targetUnit: "meals",
  },
  meals_fit_five: {
    title: "Make meals fit your targets 5 days a week",
    targetValue: 5,
    targetUnit: "days_per_week",
  },
  portions_five: {
    title: "Build better portions 5 days a week",
    targetValue: 5,
    targetUnit: "days_per_week",
  },
  tracking_simple: {
    title: "Make macro tracking easier 5 days a week",
    targetValue: 5,
    targetUnit: "days_per_week",
  },
  plan_three: {
    title: "Plan 3 macro-friendly meals each week",
    targetValue: 3,
    targetUnit: "meals_per_week",
  },
};
function makeGoal(
  id: MacroGoalId,
  custom: string,
  weeks: MacroGoalDurationWeeks,
  startDate = localDateKey(),
): OnboardingGoal | null {
  if (id === "custom" && !custom.trim()) return null;
  const definition =
    id === "custom"
      ? {
          title: custom.trim().slice(0, 80),
          targetValue: 1,
          targetUnit: "custom",
        }
      : macroGoalDefinitions[id];
  const durationDays = weeks * 7;
  return {
    goalBranch: "hit_macros",
    goalType: "macro_adherence",
    targetValue: definition.targetValue,
    targetUnit: definition.targetUnit,
    startDate,
    targetDate: addLocalDays(startDate, durationDays),
    durationDays,
    ...(definition.targetUnit.includes("week")
      ? { weeklyTarget: definition.targetValue }
      : {}),
    displayTitle: definition.title,
  };
}
function defaultGoal(focus: MacroFocusId | null): MacroGoalId {
  if (focus === "low_protein") return "protein_five";
  if (focus === "calorie_inconsistency") return "macro_five";
  if (focus === "portion_confusion") return "portions_five";
  if (focus === "tracking_friction") return "tracking_simple";
  if (focus === "food_uncertainty") return "plan_three";
  return "meals_fit_five";
}
function normalizeTargetMode(value: unknown): MacroTargetMode | null {
  if (!isTargetMode(value)) return null;
  return value === "protein_and_calories" || value === "protein_only"
    ? "known_targets"
    : value;
}
function normalizedEstimateProfile(value: unknown): NutritionProfile {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const number = (key: string, min: number, max: number) =>
    typeof raw[key] === "number" &&
    Number.isFinite(raw[key]) &&
    raw[key]! >= min &&
    raw[key]! <= max
      ? (raw[key] as number)
      : null;
  return {
    ...emptyNutritionProfile,
    ageYears: number("ageYears", 13, 100),
    heightCm: number("heightCm", 120, 230),
    weightKg: number("weightKg", 35, 300),
    biologicalSex:
      raw.biologicalSex === "female" ||
      raw.biologicalSex === "male" ||
      raw.biologicalSex === "non_binary" ||
      raw.biologicalSex === "prefer_not_to_say"
        ? raw.biologicalSex
        : null,
    activityLevel:
      raw.activityLevel === "mostly_sitting" ||
      raw.activityLevel === "lightly_active" ||
      raw.activityLevel === "active" ||
      raw.activityLevel === "very_active"
        ? raw.activityLevel
        : null,
    goal:
      raw.goal === "lose_fat" ||
      raw.goal === "maintain" ||
      raw.goal === "build_muscle" ||
      raw.goal === "improve_performance" ||
      raw.goal === "hit_protein"
        ? raw.goal
        : null,
    desiredRatePerWeek:
      raw.desiredRatePerWeek === "slow" || raw.desiredRatePerWeek === "moderate"
        ? raw.desiredRatePerWeek
        : null,
    trainingDaysPerWeek: number("trainingDaysPerWeek", 0, 7),
    activityHoursPerWeek: number("activityHoursPerWeek", 0, 56),
    proteinPreference: null,
    manualProteinTargetGrams: null,
    isMinor: raw.isMinor === true || number("ageYears", 13, 17) !== null,
  };
}
function weeklyChangeFromProfile(profile: NutritionProfile): number {
  if (profile.goal === "lose_fat")
    return profile.desiredRatePerWeek === "moderate" ? -1 : -0.5;
  if (profile.goal === "build_muscle")
    return profile.desiredRatePerWeek === "moderate" ? 1 : 0.5;
  return 0;
}

export function routeForMacrosDraft(draft: MacrosDraft): MacrosStep {
  if (draft.branchCompleted) return "complete";
  if (!draft.macroFocus) return "problem";
  if (!draft.macroBarrier) return "barrier";
  if (!draft.macroOutcome) return "diagnosis";
  if (draft.recipePriorities.length < 1) return "mealPriority";
  if (!draft.targetMode) return "targetMode";
  if (
    draft.targetMode === "calculate_estimate" &&
    (!draft.proteinTargetGrams || !draft.calorieTarget)
  )
    return "estimateDetails";
  return "reveal";
}

export function normalizeMacrosDraft(value: unknown): MacrosDraft {
  if (!value || typeof value !== "object") return { ...initialMacrosDraft };
  const raw = value as Record<string, unknown>;
  const legacy = raw.version !== 4;
  const macroFocus = isFocus(raw.macroFocus)
    ? raw.macroFocus
    : typeof raw.macroFocus === "string"
      ? (LEGACY_FOCUS[raw.macroFocus] ?? null)
      : null;
  const macroBarrier = isBarrier(raw.macroBarrier)
    ? raw.macroBarrier
    : typeof raw.macroBarrier === "string"
      ? (LEGACY_BARRIER[raw.macroBarrier] ?? null)
      : null;
  const oldPriority =
    isPriority(raw.mealPriority) && isRecipePriority(raw.mealPriority)
      ? raw.mealPriority
      : null;
  const rawPriorities = Array.isArray(raw.recipePriorities)
    ? raw.recipePriorities.filter(isRecipePriority)
    : oldPriority
      ? [oldPriority]
      : [];
  const recipePriorities = [
    ...new Set(rawPriorities),
  ] as MacroRecipePriorityId[];
  const proteinTargetGrams = validProtein(raw.proteinTargetGrams)
    ? raw.proteinTargetGrams
    : null;
  const calorieTarget = validCalories(raw.calorieTarget)
    ? raw.calorieTarget
    : null;
  const targetMode =
    normalizeTargetMode(raw.targetMode) ??
    (legacy ? (proteinTargetGrams ? "known_targets" : "keep_flexible") : null);
  const goalDurationWeeks = isDuration(raw.goalDurationWeeks)
    ? raw.goalDurationWeeks
    : 4;
  const macroGoal = isGoal(raw.macroGoal)
    ? raw.macroGoal
    : macroFocus
      ? defaultGoal(macroFocus)
      : null;
  const goal =
    normalizeOnboardingGoal(raw.goal) ??
    (macroGoal
      ? makeGoal(
          macroGoal,
          typeof raw.customMacroGoal === "string" ? raw.customMacroGoal : "",
          goalDurationWeeks,
        )
      : null);
  const estimateProfile = normalizedEstimateProfile(raw.estimateProfile);
  const weeklyChangePounds = validWeeklyChange(raw.weeklyChangePounds)
    ? raw.weeklyChangePounds
    : weeklyChangeFromProfile(estimateProfile);
  const draft: MacrosDraft = {
    ...initialMacrosDraft,
    currentStep: "intro",
    macroFocus,
    macroBarrier,
    mealToImprove: isMeal(raw.mealToImprove) ? raw.mealToImprove : null,
    cookingFrequency: isCooking(raw.cookingFrequency)
      ? raw.cookingFrequency
      : null,
    macroOutcome: isOutcome(raw.macroOutcome)
      ? raw.macroOutcome
      : macroFocus === "low_protein"
        ? "more_protein"
        : macroFocus === "calorie_inconsistency"
          ? "closer_calories"
          : macroFocus === "portion_confusion"
            ? "better_portions"
            : macroFocus
              ? "meals_fit_targets"
              : null,
    mealPriority: oldPriority,
    recipePriorities,
    foodStyles: Array.isArray(raw.foodStyles)
      ? raw.foodStyles.filter(isFoodStyle)
      : [],
    flexibleCommitment: isPace(raw.flexibleCommitment)
      ? raw.flexibleCommitment
      : null,
    targetMode,
    proteinTargetGrams,
    calorieTarget,
    calorieTargetManuallyEdited: raw.calorieTargetManuallyEdited === true,
    carbTargetGrams: validMacro(raw.carbTargetGrams)
      ? raw.carbTargetGrams
      : null,
    fatTargetGrams: validMacro(raw.fatTargetGrams) ? raw.fatTargetGrams : null,
    estimateProfile,
    weeklyChangePounds,
    macroGoal,
    customMacroGoal:
      typeof raw.customMacroGoal === "string"
        ? raw.customMacroGoal.slice(0, 80)
        : "",
    goalDurationWeeks,
    goal,
    branchCompleted: raw.branchCompleted === true,
  };
  const requested =
    !legacy &&
    typeof raw.currentStep === "string" &&
    MACROS_STEPS.includes(raw.currentStep as MacrosStep)
      ? (raw.currentStep as MacrosStep)
      : routeForMacrosDraft(draft);
  const route = routeForMacrosDraft(draft);
  draft.currentStep = draft.branchCompleted
    ? "complete"
    : MACROS_STEPS.indexOf(requested) <= MACROS_STEPS.indexOf(route)
      ? requested
      : route;
  return draft;
}

/** Reuse the age collected by the canonical onboarding screen, without asking again. */
export function reuseOnboardingAge(draft: MacrosDraft, ageYears: number | null): MacrosDraft {
  if (ageYears === null || draft.estimateProfile.ageYears === ageYears) return draft;
  const estimateProfile = { ...draft.estimateProfile, ageYears, isMinor: ageYears < 18 };
  const targets = calculateNutritionTargets(estimateProfile);
  return {
    ...draft,
    estimateProfile,
    ...(draft.targetMode === 'calculate_estimate' ? {
      calorieTarget: targets?.calories ?? null,
      proteinTargetGrams: targets?.proteinGrams ?? null,
      carbTargetGrams: targets?.carbsGrams ?? null,
      fatTargetGrams: targets?.fatGrams ?? null,
      calorieTargetManuallyEdited: false,
    } : {}),
  };
}

export type MacrosEvent =
  | { type: "PROBLEM_SELECTED"; problem: MacroFocusId }
  | { type: "BARRIER_SELECTED"; barrier: MacroBarrierId }
  | { type: "MEAL_TO_IMPROVE_SELECTED"; meal: MacrosMealToImproveId }
  | { type: "COOKING_FREQUENCY_SELECTED"; frequency: CookingFrequencyId }
  | { type: "OUTCOME_SELECTED"; outcome: MacroOutcomeId }
  | { type: "MEAL_PRIORITY_SELECTED"; priority: MacroMealPriorityId }
  | { type: "RECIPE_PRIORITIES_TOGGLED"; priority: MacroRecipePriorityId }
  | { type: "FOOD_STYLE_TOGGLED"; foodStyle: MacroFoodStyleId }
  | { type: "PACE_SELECTED"; pace: MacroPaceId }
  | { type: "TARGET_MODE_SELECTED"; mode: MacroTargetMode }
  | { type: "ESTIMATE_PROFILE_UPDATED"; patch: Partial<NutritionProfile> }
  | { type: "WEEKLY_CHANGE_SELECTED"; pounds: number }
  | { type: "EDIT_TARGETS_PRESSED" }
  | { type: "PROTEIN_TARGET_SAVED"; grams: number }
  | { type: "CALORIE_TARGET_SAVED"; calories: number }
  | { type: "CARB_TARGET_SAVED"; grams: number }
  | { type: "FAT_TARGET_SAVED"; grams: number }
  | { type: "MACRO_GOAL_SELECTED"; goal: MacroGoalId }
  | { type: "MACRO_CUSTOM_GOAL_CHANGED"; value: string }
  | { type: "GOAL_DURATION_SELECTED"; weeks: MacroGoalDurationWeeks }
  | { type: "NEXT_PRESSED"; skipSteps?: readonly MacrosStep[] }
  | { type: "BACK_PRESSED"; skipSteps?: readonly MacrosStep[] }
  | { type: "BRANCH_COMPLETED" }
  | { type: "HYDRATED"; draft: unknown };
function activeStep(state: MacrosDraft): MacrosStep {
  return MACROS_STEPS.includes(state.currentStep as MacrosStep)
    ? (state.currentStep as MacrosStep)
    : routeForMacrosDraft(state);
}
function nextStep(state: MacrosDraft): MacrosStep {
  const current = activeStep(state);
  if (current === "targetMode")
    return state.targetMode === "calculate_estimate"
      ? "estimateDetails"
      : state.targetMode === "known_targets"
        ? "knownTargets"
        : "reveal";
  if (current === "estimateDetails" || current === "knownTargets")
    return "reveal";
  if (current === "reveal" || current === "complete") return current;
  return MACROS_STEPS[
    Math.min(MACROS_STEPS.indexOf(current) + 1, MACROS_STEPS.length - 1)
  ];
}
function previousStep(state: MacrosDraft): MacrosStep {
  const current = activeStep(state);
  if (current === "estimateDetails" || current === "knownTargets")
    return "targetMode";
  if (current === "reveal")
    return state.targetMode === "calculate_estimate"
      ? "estimateDetails"
      : state.targetMode === "known_targets"
        ? "knownTargets"
        : "targetMode";
  if (current === "complete") return "reveal";
  return MACROS_STEPS[Math.max(MACROS_STEPS.indexOf(current) - 1, 0)];
}
export function macrosReducer(
  state: MacrosDraft,
  event: MacrosEvent,
): MacrosDraft {
  if (event.type === "HYDRATED") return normalizeMacrosDraft(event.draft);
  const next: MacrosDraft = {
    ...state,
    recipePriorities: [...state.recipePriorities],
    foodStyles: [...state.foodStyles],
  };
  if (event.type === "PROBLEM_SELECTED" && isFocus(event.problem)) {
    next.macroFocus = event.problem;
    next.macroOutcome =
      event.problem === "low_protein"
        ? "more_protein"
        : event.problem === "calorie_inconsistency"
          ? "closer_calories"
          : event.problem === "portion_confusion"
            ? "better_portions"
            : "meals_fit_targets";
    next.macroGoal = defaultGoal(event.problem);
    next.goal = makeGoal(
      next.macroGoal,
      next.customMacroGoal,
      next.goalDurationWeeks,
    );
  }
  if (event.type === "BARRIER_SELECTED" && isBarrier(event.barrier))
    next.macroBarrier = event.barrier;
  if (event.type === "MEAL_TO_IMPROVE_SELECTED" && isMeal(event.meal))
    next.mealToImprove = event.meal;
  if (event.type === "COOKING_FREQUENCY_SELECTED" && isCooking(event.frequency))
    next.cookingFrequency = event.frequency;
  if (event.type === "OUTCOME_SELECTED" && isOutcome(event.outcome))
    next.macroOutcome = event.outcome;
  if (event.type === "MEAL_PRIORITY_SELECTED" && isPriority(event.priority))
    next.mealPriority = event.priority;
  if (
    event.type === "RECIPE_PRIORITIES_TOGGLED" &&
    isRecipePriority(event.priority)
  )
    next.recipePriorities = next.recipePriorities.includes(event.priority)
      ? next.recipePriorities.filter((id) => id !== event.priority)
      : next.recipePriorities.length < 2
        ? [...next.recipePriorities, event.priority]
        : next.recipePriorities;
  if (event.type === "FOOD_STYLE_TOGGLED" && isFoodStyle(event.foodStyle))
    next.foodStyles = next.foodStyles.includes(event.foodStyle)
      ? next.foodStyles.filter((id) => id !== event.foodStyle)
      : [...next.foodStyles, event.foodStyle];
  if (event.type === "PACE_SELECTED" && isPace(event.pace))
    next.flexibleCommitment = event.pace;
  if (event.type === "TARGET_MODE_SELECTED" && isTargetMode(event.mode)) {
    next.targetMode =
      event.mode === "protein_and_calories" || event.mode === "protein_only"
        ? "known_targets"
        : event.mode;
    if (
      next.targetMode === "keep_flexible" ||
      next.targetMode === "calculate_estimate"
    ) {
      next.proteinTargetGrams = null;
      next.calorieTarget = null;
      next.calorieTargetManuallyEdited = false;
      next.carbTargetGrams = null;
      next.fatTargetGrams = null;
    }
    if (next.targetMode === "calculate_estimate") {
      next.estimateProfile = {
        ...next.estimateProfile,
        goal: next.estimateProfile.goal ?? "maintain",
        activityHoursPerWeek: next.estimateProfile.activityHoursPerWeek ?? 0,
      };
    }
  }
  if (event.type === "ESTIMATE_PROFILE_UPDATED") {
    next.estimateProfile = {
      ...next.estimateProfile,
      ...event.patch,
      isMinor:
        event.patch.ageYears !== undefined
          ? event.patch.ageYears !== null && event.patch.ageYears < 18
          : next.estimateProfile.isMinor,
    };
    const targets = calculateNutritionTargets(next.estimateProfile);
    if (targets) {
      next.proteinTargetGrams = targets.proteinGrams;
      next.calorieTarget = targets.calories;
      next.calorieTargetManuallyEdited = false;
      next.carbTargetGrams = targets.carbsGrams;
      next.fatTargetGrams = targets.fatGrams;
    } else {
      next.proteinTargetGrams = null;
      next.calorieTarget = null;
      next.calorieTargetManuallyEdited = false;
      next.carbTargetGrams = null;
      next.fatTargetGrams = null;
    }
  }
  if (
    event.type === "WEEKLY_CHANGE_SELECTED" &&
    validWeeklyChange(event.pounds)
  ) {
    const absoluteChange = Math.abs(event.pounds);
    next.weeklyChangePounds = event.pounds;
    next.estimateProfile = {
      ...next.estimateProfile,
      goal:
        event.pounds < 0
          ? "lose_fat"
          : event.pounds > 0
            ? "build_muscle"
            : "maintain",
      desiredRatePerWeek:
        absoluteChange === 0 ? null : absoluteChange >= 1 ? "moderate" : "slow",
    };
    const targets = calculateNutritionTargets(next.estimateProfile);
    if (targets) {
      next.proteinTargetGrams = targets.proteinGrams;
      next.calorieTarget = targets.calories;
      next.calorieTargetManuallyEdited = false;
      next.carbTargetGrams = targets.carbsGrams;
      next.fatTargetGrams = targets.fatGrams;
    } else {
      next.proteinTargetGrams = null;
      next.calorieTarget = null;
      next.calorieTargetManuallyEdited = false;
      next.carbTargetGrams = null;
      next.fatTargetGrams = null;
    }
  }
  if (event.type === "EDIT_TARGETS_PRESSED") {
    next.branchCompleted = false;
    next.currentStep =
      next.targetMode === "calculate_estimate"
        ? "estimateDetails"
        : next.targetMode === "known_targets"
          ? "knownTargets"
          : "targetMode";
  }
  if (event.type === "PROTEIN_TARGET_SAVED" && validProtein(event.grams))
    next.proteinTargetGrams = event.grams;
  if (event.type === "CALORIE_TARGET_SAVED" && validCalories(event.calories)) {
    next.calorieTarget = event.calories;
    next.calorieTargetManuallyEdited = next.targetMode === "calculate_estimate";
  }
  if (event.type === "CARB_TARGET_SAVED" && validMacro(event.grams))
    next.carbTargetGrams = event.grams;
  if (event.type === "FAT_TARGET_SAVED" && validMacro(event.grams))
    next.fatTargetGrams = event.grams;
  if (event.type === "MACRO_GOAL_SELECTED" && isGoal(event.goal)) {
    next.macroGoal = event.goal;
    next.goal = makeGoal(
      event.goal,
      next.customMacroGoal,
      next.goalDurationWeeks,
    );
  }
  if (event.type === "MACRO_CUSTOM_GOAL_CHANGED") {
    next.customMacroGoal = event.value.slice(0, 80);
    next.macroGoal = "custom";
    next.goal = makeGoal(
      "custom",
      next.customMacroGoal,
      next.goalDurationWeeks,
    );
  }
  if (event.type === "GOAL_DURATION_SELECTED" && isDuration(event.weeks)) {
    next.goalDurationWeeks = event.weeks;
    if (next.macroGoal)
      next.goal = makeGoal(
        next.macroGoal,
        next.customMacroGoal,
        event.weeks,
        next.goal?.startDate,
      );
  }
  if (event.type === "BRANCH_COMPLETED")
    return { ...next, branchCompleted: true, currentStep: "complete" };
  if (event.type === "NEXT_PRESSED") {
    next.currentStep = nextStep(next);
    while (event.skipSteps?.includes(next.currentStep) && next.currentStep !== "reveal" && next.currentStep !== "complete") {
      next.currentStep = nextStep({ ...next, currentStep: next.currentStep });
    }
  }
  if (event.type === "BACK_PRESSED") {
    next.currentStep = previousStep(next);
    while (event.skipSteps?.includes(next.currentStep) && next.currentStep !== "intro") {
      next.currentStep = previousStep({ ...next, currentStep: next.currentStep });
    }
  }
  return next;
}
