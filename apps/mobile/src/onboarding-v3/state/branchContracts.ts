import {
  annualTakeoutSpend,
  conservativeAnnualProjection,
  emptyPersonalizedProfile,
  estimatedHomeMealCost,
  type PersonalizedOnboardingProfile,
  type PrimaryGoal,
} from './personalizedOnboarding';
import { calculateNutritionTargets, type ActivityLevel, type BiologicalSexForEstimate, type NutritionTargets } from './nutritionTargets';

/**
 * Typed, pure branch contracts for the V4 rebuild (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 04). Defines the question option sets, calculations, and downstream-use
 * map for all four branches — no question-rendering UI (Step 05), no API/recipe
 * wiring (Step 08+). Every calculation here either reuses an existing,
 * plan-sanctioned function verbatim (`annualTakeoutSpend`, `conservativeAnnualProjection`,
 * `estimatedHomeMealCost`, `calculateNutritionTargets`) or is a small, honest
 * adapter/validator that feeds one — nothing here recomputes the money or
 * macro math those functions already own.
 */

// ---------------------------------------------------------------------------
// Downstream-use vocabulary (decision #12: no write-only fields)
// ---------------------------------------------------------------------------

export const DOWNSTREAM_USES = [
  'personal_insight',
  'personal_plan',
  'recipe_generation_guidance',
  'result_hierarchy',
  'suggested_edit',
  'paywall_benefit_order',
  'canonical_app_profile',
] as const;
export type DownstreamUse = (typeof DOWNSTREAM_USES)[number];

export const V4_BRANCH_FIELD_IDS = [
  'initialGoal',
  'resolvedPrimaryGoal',
  'savings.takeoutFrequency',
  'savings.spendPerMealDollars',
  'health.healthierDefinition',
  'health.healthBarrier',
  'macros.macroFocus',
  'macros.targetPath',
  'macros.knownTargets',
  'macros.calculatorInputs',
  'notSure.universalNeed',
  'notSure.preferredTransformation',
] as const;
export type V4BranchFieldId = (typeof V4_BRANCH_FIELD_IDS)[number];

/**
 * Every field on the complete V4 draft — including the two top-level fields
 * (`initialGoal`/`resolvedPrimaryGoal`), not just the four branches' own
 * answers — must appear here with at least one real, later-consuming use.
 * `branchContracts.test.ts` asserts exhaustiveness (every field id present,
 * no orphan entries) and that every listed use is drawn from
 * `DOWNSTREAM_USES` (no typo'd/invented consumer name can silently pass).
 */
export const V4_BRANCH_FIELD_DOWNSTREAM_USES: Readonly<Record<V4BranchFieldId, readonly DownstreamUse[]>> = Object.freeze({
  // Kept even after resolution (never overwritten) so analytics/insight copy
  // can reference what a not_sure user originally felt ("you weren't sure
  // where to start") — the one first-class field that is never merged into
  // the canonical profile itself (see onboardingV4CanonicalBridge.ts).
  initialGoal: ['personal_insight'],
  // The actual driver of everything branch-specific once set — same
  // consumer set personalizedGoalContent[primaryGoal] already feeds today.
  resolvedPrimaryGoal: ['personal_plan', 'recipe_generation_guidance', 'result_hierarchy', 'paywall_benefit_order', 'canonical_app_profile'],
  'savings.takeoutFrequency': ['personal_insight', 'personal_plan', 'recipe_generation_guidance', 'result_hierarchy', 'paywall_benefit_order'],
  'savings.spendPerMealDollars': ['personal_insight', 'personal_plan', 'recipe_generation_guidance', 'result_hierarchy', 'paywall_benefit_order'],
  'health.healthierDefinition': ['personal_insight', 'recipe_generation_guidance', 'result_hierarchy', 'suggested_edit', 'paywall_benefit_order'],
  'health.healthBarrier': ['personal_insight', 'suggested_edit'],
  'macros.macroFocus': ['personal_insight', 'recipe_generation_guidance', 'result_hierarchy', 'paywall_benefit_order'],
  'macros.targetPath': ['personal_plan', 'recipe_generation_guidance', 'canonical_app_profile'],
  'macros.knownTargets': ['recipe_generation_guidance', 'result_hierarchy', 'canonical_app_profile'],
  'macros.calculatorInputs': ['recipe_generation_guidance', 'result_hierarchy', 'canonical_app_profile'],
  'notSure.universalNeed': ['personal_insight'],
  // Resolves resolvedPrimaryGoal (see resolveNotSurePrimaryGoal below), so it
  // shares that field's full consumer set once selected.
  'notSure.preferredTransformation': ['personal_plan', 'recipe_generation_guidance', 'result_hierarchy', 'paywall_benefit_order', 'canonical_app_profile'],
});

// ---------------------------------------------------------------------------
// Save Money branch
// ---------------------------------------------------------------------------

export const TAKEOUT_FREQUENCY_BUCKETS = ['0', '1', '2–3', '4–5', '6+'] as const;
export type TakeoutFrequencyBucket = (typeof TAKEOUT_FREQUENCY_BUCKETS)[number];
export function isTakeoutFrequencyBucket(value: unknown): value is TakeoutFrequencyBucket {
  return typeof value === 'string' && (TAKEOUT_FREQUENCY_BUCKETS as readonly string[]).includes(value);
}

export type SavingsBranchAnswers = {
  takeoutFrequency: TakeoutFrequencyBucket | null;
  /** User-editable estimate of one typical order's cost, in whole dollars. "A rough estimate is perfect" — never treated as exact. */
  spendPerMealDollars: number | null;
};

export const emptySavingsBranchAnswers: SavingsBranchAnswers = Object.freeze({ takeoutFrequency: null, spendPerMealDollars: null });

/**
 * Adapter from V4's own bucket labels to the pre-existing V3 `TAKEOUT_FREQUENCY`
 * vocabulary (personalizedOnboarding.ts) that `annualTakeoutSpend`/
 * `conservativeAnnualProjection` already key off of — chosen so those
 * label strings' *numeric* weekly frequency matches exactly (`'2–3'`→'2–3
 * times a week' is a literal, direct alias; `'6+'`→'Almost every day' is the
 * closest existing bucket at the same frequency, 6/week). `'0'` intentionally
 * has no match: the reused functions' `?? 0` fallback already produces the
 * correct zero-spend result for an unrecognized label, so no dict entry is
 * needed. This is purely an adapter — it introduces no new spend formula.
 */
const TAKEOUT_BUCKET_TO_V3_LABEL: Record<Exclude<TakeoutFrequencyBucket, '0'>, string> = {
  '1': 'About once a week',
  '2–3': '2–3 times a week',
  '4–5': '4–5 times a week',
  '6+': 'Almost every day',
};

function toAdapterProfile(answers: SavingsBranchAnswers): PersonalizedOnboardingProfile {
  return {
    ...emptyPersonalizedProfile,
    savings: {
      ...emptyPersonalizedProfile.savings,
      takeoutFrequency: answers.takeoutFrequency && answers.takeoutFrequency !== '0' ? TAKEOUT_BUCKET_TO_V3_LABEL[answers.takeoutFrequency] : null,
      spendPerMeal: answers.spendPerMealDollars,
    },
  };
}

export type EstimatedAvoidedSpendRange = {
  /**
   * Never "savings" — this is spend that COULD be avoided by cooking
   * instead, not money actually saved. Distinct from a future "confirmed
   * actual savings" concept (not built yet — would require knowing a user
   * actually cooked instead of ordering; decision doc's "future weekly-savings
   * lifecycle messaging").
   */
  isEstimate: true;
  weeklyLow: number;
  weeklyHigh: number;
  monthlyLow: number;
  monthlyHigh: number;
  annualLow: number;
  annualHigh: number;
  /**
   * True whenever low/high genuinely differ — which, by the reused
   * formulas' own math, is every non-zero bucket: `conservativeAnnualProjection`
   * nets out `estimatedHomeMealCost` (the cost of cooking at home) from the
   * replaced order(s), while `annualTakeoutSpend` doesn't, so low is always
   * strictly less than high whenever there's a nonzero order to project.
   * Kept as an explicit field (rather than assumed) so the UI never has to
   * re-derive this itself, and so a future change to the underlying formulas
   * that ever did collapse low==high would be caught by this field going
   * false rather than silently rendering a fake "$X–$X" range.
   */
  hasRange: boolean;
  provenance: 'annualTakeoutSpend+conservativeAnnualProjection (personalizedOnboarding.ts)';
};

/**
 * Returns a labeled range, never a false-precision point number (plan's
 * insight requirement). The low end reuses `conservativeAnnualProjection`
 * (at most one order/week actually replaced); the high end reuses
 * `annualTakeoutSpend` (the full current spend, if every order were
 * replaced). Both are the plan-sanctioned, already-implemented functions —
 * called here, not reimplemented. Returns null when there isn't enough
 * answered yet to estimate anything.
 */
export function calculateSavingsBranchEstimate(answers: SavingsBranchAnswers): EstimatedAvoidedSpendRange | null {
  if (!answers.takeoutFrequency || !answers.spendPerMealDollars) return null;
  const adapterProfile = toAdapterProfile(answers);
  const annualHigh = annualTakeoutSpend(adapterProfile);
  const annualLow = Math.min(annualHigh, conservativeAnnualProjection(adapterProfile));
  if (annualHigh <= 0) return null;
  void estimatedHomeMealCost; // reused inside conservativeAnnualProjection; referenced here only to document the dependency
  return {
    isEstimate: true,
    weeklyLow: Math.round(annualLow / 52),
    weeklyHigh: Math.round(annualHigh / 52),
    monthlyLow: Math.round(annualLow / 12),
    monthlyHigh: Math.round(annualHigh / 12),
    annualLow,
    annualHigh,
    hasRange: annualLow < annualHigh,
    provenance: 'annualTakeoutSpend+conservativeAnnualProjection (personalizedOnboarding.ts)',
  };
}

export type EatingOutVsHomeComparison = {
  isEstimate: true;
  /** What one typical order costs, as entered — "Eating out," never "Restaurant estimate" (Step 07 terminology). */
  estimatedEatingOutCost: number;
  /** `estimatedHomeMealCost` (personalizedOnboarding.ts), reused verbatim — not a second cost formula. */
  estimatedMakeAtHomeCost: number;
  /** `estimatedEatingOutCost - estimatedMakeAtHomeCost`, per meal. Never presented as confirmed savings — see the Home-savings tracking rule, which this value does not feed. */
  projectedDifference: number;
};

/** Step 07's compact-plan first-action card needs a per-scan (not weekly/annual) comparison — reuses `estimatedHomeMealCost` directly rather than deriving it from the annual projection functions above. Returns null until both answers are in, same as `calculateSavingsBranchEstimate`. */
export function calculateEatingOutVsHomeComparison(answers: SavingsBranchAnswers): EatingOutVsHomeComparison | null {
  if (!answers.takeoutFrequency || answers.takeoutFrequency === '0' || !answers.spendPerMealDollars) return null;
  const adapterProfile = toAdapterProfile(answers);
  const estimatedMakeAtHomeCost = estimatedHomeMealCost(adapterProfile);
  return {
    isEstimate: true,
    estimatedEatingOutCost: answers.spendPerMealDollars,
    estimatedMakeAtHomeCost,
    projectedDifference: Math.round((answers.spendPerMealDollars - estimatedMakeAtHomeCost) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Eat Healthier branch
// ---------------------------------------------------------------------------

export const HEALTHIER_DEFINITIONS = ['More balanced', 'More vegetables', 'Lower calories', 'Lower sodium', 'Less processed', 'Something else'] as const;
export type HealthierDefinition = (typeof HEALTHIER_DEFINITIONS)[number];
export function isHealthierDefinition(value: unknown): value is HealthierDefinition {
  return typeof value === 'string' && (HEALTHIER_DEFINITIONS as readonly string[]).includes(value);
}

export const HEALTH_BARRIERS = ['Time', 'Cravings', 'Boring recipes', 'Confusion about what\'s healthy', 'Giving up favorites'] as const;
export type HealthBarrier = (typeof HEALTH_BARRIERS)[number];
export function isHealthBarrier(value: unknown): value is HealthBarrier {
  return typeof value === 'string' && (HEALTH_BARRIERS as readonly string[]).includes(value);
}

export type HealthBranchAnswers = {
  healthierDefinition: HealthierDefinition | null;
  healthBarrier: HealthBarrier | null;
};

export const emptyHealthBranchAnswers: HealthBranchAnswers = Object.freeze({ healthierDefinition: null, healthBarrier: null });

export type HealthTransformationGuidance = {
  /** One concrete, non-clinical example line — never a weight-loss or guarantee claim. */
  exampleLine: string;
  resultPriorityFields: readonly string[];
  suggestedEditKeys: readonly string[];
};

const HEALTH_FOCUS_GUIDANCE: Record<HealthierDefinition, HealthTransformationGuidance> = {
  'More balanced': { exampleLine: 'Add a vegetable side to a meal you already like.', resultPriorityFields: ['balance_summary'], suggestedEditKeys: ['add_vegetable_side'] },
  'More vegetables': { exampleLine: 'Swap half the starch for roasted vegetables.', resultPriorityFields: ['vegetable_count'], suggestedEditKeys: ['increase_vegetables'] },
  'Lower calories': { exampleLine: 'Use a lighter cooking method for the same dish.', resultPriorityFields: ['calories'], suggestedEditKeys: ['lighter_cooking_method'] },
  'Lower sodium': { exampleLine: 'Season with herbs and citrus instead of extra salt.', resultPriorityFields: ['sodium'], suggestedEditKeys: ['reduce_added_salt'] },
  'Less processed': { exampleLine: 'Make the sauce from scratch instead of a jarred version.', resultPriorityFields: ['ingredient_list'], suggestedEditKeys: ['scratch_ingredient_swap'] },
  'Something else': { exampleLine: 'Tell Okyo what "healthier" means to you and it adapts the recipe.', resultPriorityFields: ['custom_note'], suggestedEditKeys: ['custom_transformation'] },
};

/** Pure, exhaustive per-option mapping — no clinical or weight-loss claims (see onboardingV4DownstreamUses.test.ts's copy-safety sweep). */
export function resolveHealthTransformationGuidance(healthierDefinition: HealthierDefinition): HealthTransformationGuidance {
  return HEALTH_FOCUS_GUIDANCE[healthierDefinition];
}

// ---------------------------------------------------------------------------
// Hit My Macros branch
// ---------------------------------------------------------------------------

export const MACRO_FOCUSES = ['Protein', 'Calories', 'Balanced macros', 'Performance/fueling', 'Something else'] as const;
export type MacroFocus = (typeof MACRO_FOCUSES)[number];
export function isMacroFocus(value: unknown): value is MacroFocus {
  return typeof value === 'string' && (MACRO_FOCUSES as readonly string[]).includes(value);
}

export const MACRO_TARGET_PATHS = ['known', 'estimate', 'not_sure'] as const;
export type MacroTargetPath = (typeof MACRO_TARGET_PATHS)[number];
export function isMacroTargetPath(value: unknown): value is MacroTargetPath {
  return typeof value === 'string' && (MACRO_TARGET_PATHS as readonly string[]).includes(value);
}

export type KnownMacroTargets = Partial<{
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}>;

export type MacroCalculatorInputs = {
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  biologicalSex: BiologicalSexForEstimate | null;
  activityLevel: ActivityLevel | null;
  trainingDaysPerWeek: number | null;
};

export const emptyMacroCalculatorInputs: MacroCalculatorInputs = Object.freeze({
  ageYears: null, heightCm: null, weightKg: null, biologicalSex: null, activityLevel: null, trainingDaysPerWeek: null,
});

export type MacroBranchAnswers = {
  macroFocus: MacroFocus | null;
  targetPath: MacroTargetPath | null;
  knownTargets: KnownMacroTargets;
  calculatorInputs: MacroCalculatorInputs;
};

export const emptyMacroBranchAnswers: MacroBranchAnswers = Object.freeze({
  macroFocus: null, targetPath: null, knownTargets: Object.freeze({}), calculatorInputs: emptyMacroCalculatorInputs,
});

const MINOR_SAFE_PATHS = ['self_entered_targets', 'balanced_fueling_guidance', 'guardian_or_clinician_targets'] as const;
export type MinorSafePath = (typeof MINOR_SAFE_PATHS)[number];

export type MacroGuidanceResult =
  | { kind: 'calculated_range'; isEstimate: true; targets: NutritionTargets; rangeLowCalories: number; rangeHighCalories: number }
  | { kind: 'known_targets'; isEstimate: false; targets: KnownMacroTargets }
  | { kind: 'minor_safe_redirect'; reason: 'under_18'; message: string; allowedPaths: readonly MinorSafePath[] }
  | { kind: 'insufficient_input' };

function clampNumber(value: number | undefined, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

function sanitizeKnownTargets(knownTargets: KnownMacroTargets): KnownMacroTargets {
  return {
    calories: clampNumber(knownTargets.calories, 800, 6000),
    proteinGrams: clampNumber(knownTargets.proteinGrams, 0, 400),
    carbsGrams: clampNumber(knownTargets.carbsGrams, 0, 800),
    fatGrams: clampNumber(knownTargets.fatGrams, 0, 300),
  };
}

/**
 * The explicit under-18 safety result (decision #21). The age gate is
 * checked before any branch on `targetPath`, so it cannot be bypassed by any
 * combination of `macroFocus`/`targetPath`/calculator inputs:
 * - `targetPath = 'known'`: a minor's *self-reported* numbers are recorded
 *   as-is (Okyo never calculates a deficit for them) — `known_targets`.
 * - `targetPath = 'estimate'` or `'not_sure'`: Okyo will not calculate
 *   anything for a minor — `minor_safe_redirect`.
 * For an adult, `'estimate'` reuses `calculateNutritionTargets` verbatim
 * (not reimplemented) and returns a ±10% starting range, never a single
 * false-precision number; `'known'` sanitizes and passes through the
 * user's own numbers.
 */
export function resolveMacroGuidance(answers: MacroBranchAnswers, ageYears: number | null): MacroGuidanceResult {
  const isMinor = ageYears !== null && ageYears < 18;

  if (answers.targetPath === 'known') {
    if (Object.keys(answers.knownTargets).length === 0) return { kind: 'insufficient_input' };
    return { kind: 'known_targets', isEstimate: false, targets: sanitizeKnownTargets(answers.knownTargets) };
  }

  if (isMinor) {
    return {
      kind: 'minor_safe_redirect',
      reason: 'under_18',
      message: "We don't calculate calorie or weight targets for users under 18. You can enter your own targets, use general balanced-fueling guidance, or set targets with a parent/guardian or a qualified clinician.",
      allowedPaths: MINOR_SAFE_PATHS,
    };
  }

  if (answers.targetPath !== 'estimate') return { kind: 'insufficient_input' };

  const targets = calculateNutritionTargets({
    ageYears: answers.calculatorInputs.ageYears,
    biologicalSex: answers.calculatorInputs.biologicalSex,
    heightCm: answers.calculatorInputs.heightCm,
    weightKg: answers.calculatorInputs.weightKg,
    activityLevel: answers.calculatorInputs.activityLevel,
    trainingDaysPerWeek: answers.calculatorInputs.trainingDaysPerWeek,
    goal: macroFocusToGoal(answers.macroFocus),
    desiredRatePerWeek: null,
    proteinPreference: 'estimate',
    manualProteinTargetGrams: null,
    isMinor: false,
  });
  if (!targets) return { kind: 'insufficient_input' };

  return {
    kind: 'calculated_range',
    isEstimate: true,
    targets,
    rangeLowCalories: Math.round(targets.calories * 0.9),
    rangeHighCalories: Math.round(targets.calories * 1.1),
  };
}

export function macroFocusToGoal(macroFocus: MacroFocus | null): 'maintain' | 'improve_performance' | 'hit_protein' {
  if (macroFocus === 'Performance/fueling') return 'improve_performance';
  if (macroFocus === 'Protein') return 'hit_protein';
  return 'maintain';
}

// ---------------------------------------------------------------------------
// Not Sure branch
// ---------------------------------------------------------------------------

export const UNIVERSAL_NEEDS = ['Recreate food I see', 'Decide what to cook', 'Understand nutrition', 'Spend less', 'Just explore'] as const;
export type UniversalNeed = (typeof UNIVERSAL_NEEDS)[number];
export function isUniversalNeed(value: unknown): value is UniversalNeed {
  return typeof value === 'string' && (UNIVERSAL_NEEDS as readonly string[]).includes(value);
}

export const RESULT_TRANSFORMATION_CHIPS = ['cheaper', 'more_balanced', 'more_protein'] as const;
export type ResultTransformationChip = (typeof RESULT_TRANSFORMATION_CHIPS)[number];
/** Same vocabulary as the post-recipe result chips — asked earlier here, before the first scan, per the corrected Step 04 contract. */
export type PreferredTransformation = ResultTransformationChip;
export const PREFERRED_TRANSFORMATIONS = RESULT_TRANSFORMATION_CHIPS;
export function isPreferredTransformation(value: unknown): value is PreferredTransformation {
  return typeof value === 'string' && (RESULT_TRANSFORMATION_CHIPS as readonly string[]).includes(value);
}

export type NotSureBranchAnswers = {
  universalNeed: UniversalNeed | null;
  /**
   * Resolves `resolvedPrimaryGoal` immediately on selection (corrected Step 04
   * contract — no longer deferred to post-recipe chips): the personal plan
   * and first scan need a resolved priority before recipe generation and
   * result ordering can happen. Step 09's result-screen chips consume the
   * already-resolved value; they do not create it.
   */
  preferredTransformation: PreferredTransformation | null;
};

export const emptyNotSureBranchAnswers: NotSureBranchAnswers = Object.freeze({ universalNeed: null, preferredTransformation: null });

/**
 * Pure resolver for the not_sure -> real-goal contract. `not_sure` is never a
 * terminal state — every transformation choice resolves to one of the three
 * real `PrimaryGoal`s. Used both by `onboardingV4Draft.ts`'s
 * `setOnboardingV4PreferredTransformation` (the real, onboarding-time
 * resolution point) and by Step 09's later result-screen chips (which reuse
 * the same three option ids and this same mapping for a post-hoc change of
 * mind, not creation).
 */
export function resolveNotSurePrimaryGoal(chip: ResultTransformationChip): PrimaryGoal {
  if (chip === 'cheaper') return 'save_money';
  if (chip === 'more_balanced') return 'eat_healthier';
  return 'hit_macros';
}
