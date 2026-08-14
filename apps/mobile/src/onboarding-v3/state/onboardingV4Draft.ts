import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  emptyHealthBranchAnswers,
  emptyMacroBranchAnswers,
  emptyMacroCalculatorInputs,
  emptyNotSureBranchAnswers,
  emptySavingsBranchAnswers,
  isHealthBarrier,
  isHealthierDefinition,
  isMacroFocus,
  isMacroTargetPath,
  isPreferredTransformation,
  isTakeoutFrequencyBucket,
  isUniversalNeed,
  resolveNotSurePrimaryGoal,
  type HealthBranchAnswers,
  type MacroBranchAnswers,
  type NotSureBranchAnswers,
  type PreferredTransformation,
  type SavingsBranchAnswers,
} from './branchContracts';
import {
  emptyDietarySafetyAnswers,
  normalizeCustomDietaryEntries,
  type DietarySafetyAnswers,
} from './dietaryContracts';
import { isFuturePrimaryGoal, isPrimaryGoal, type FuturePrimaryGoal, type PrimaryGoal } from './personalizedOnboarding';
import type { ActivityLevel, BiologicalSexForEstimate } from './nutritionTargets';
import { MAX_MEAL_DESCRIPTION_LENGTH } from '../../utils/mealDescription';

/**
 * The versioned V4 onboarding draft (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 04, corrected) — reconciles Step 03's temporary primary-goal-only
 * store (`onboardingV4Profile.ts`, now replaced by this module) into a real,
 * typed ownership model:
 *
 * - `initialGoal`: exactly what the user tapped on the Primary Goal screen —
 *   may be `not_sure`. Kept forever for analytics/onboarding history.
 * - `resolvedPrimaryGoal`: one of the three canonical app goals, or `null`
 *   while a `not_sure` user hasn't picked a `preferredTransformation` yet.
 *   For the three direct goals, this is set immediately and equals
 *   `initialGoal`. For `not_sure`, `setOnboardingV4PreferredTransformation`
 *   resolves it via `resolveNotSurePrimaryGoal` — resolution happens here,
 *   at onboarding time, before the personal plan and first scan; Step 09's
 *   post-recipe chips consume this already-resolved value, they do not
 *   create it.
 * - Per-branch answers (typed in branchContracts.ts) and their derived
 *   calculations.
 *
 * This is a DRAFT, not a second permanent profile: it exists only for the
 * duration of onboarding, is distinct from `PersonalizedOnboardingProfile`
 * (personalizedOnboarding.ts, the app's one canonical profile), and is
 * intended to be merged into that canonical profile and then retired —
 * `onboardingV4CanonicalBridge.ts` is the pure, tested merge function; the
 * actual "merge, then clear the draft" completion lifecycle is explicitly
 * NOT implemented yet (see the module-level TODO at the bottom).
 */
export type OnboardingV4Draft = {
  initialGoal: FuturePrimaryGoal | null;
  resolvedPrimaryGoal: PrimaryGoal | null;
  savingsAnswers: SavingsBranchAnswers;
  healthAnswers: HealthBranchAnswers;
  macroAnswers: MacroBranchAnswers;
  notSureAnswers: NotSureBranchAnswers;
  /** Step 06. Modeled separately (allergies/restrictions/dislikes/completed) — see dietaryContracts.ts. */
  dietaryAnswers: DietarySafetyAnswers;
  /**
   * Step 06 repair. Set true the moment the user leaves personalInsight via
   * CONTINUE (it collects no answer of its own, so there is nothing else to
   * key "have they seen this" off of). Distinguishes "hasn't reached the
   * insight yet" from "reached dietary safety and it's simply incomplete" on
   * resume — without this, both cases were indistinguishable from the draft
   * alone and every resume fell back to personalInsight, silently skipping
   * a user's partially-filled dietary selections back to an earlier screen.
   */
  insightViewed: boolean;
  /** Step 07. True only after `commitOnboardingV4PlanToCanonicalProfile` has resolved successfully — gates plan -> scanEntry and resume routing. */
  planCommitted: boolean;
  /** Step 07. First-scan input in progress — persisted so resume can restore it. The picked image itself is never persisted (size/staleness); only which method was chosen and whether an image is currently held in memory for this session. */
  scanInput: OnboardingV4ScanInputState;
};

export type OnboardingV4ScanInputMethod = 'camera' | 'library' | 'description';

export type OnboardingV4ScanInputState = {
  method: OnboardingV4ScanInputMethod | null;
  /** Normalized, length-limited free text — never sent to analytics/logs (see mealDescription.ts's validator, reused as-is). */
  description: string;
  /** Whether an image is currently held in the running session for this method — the binary itself lives only in OnboardingV4.tsx's component state, never in this persisted draft. */
  hasSelectedImage: boolean;
};

export const emptyOnboardingV4ScanInputState: OnboardingV4ScanInputState = Object.freeze({
  method: null,
  description: '',
  hasSelectedImage: false,
});

export const emptyOnboardingV4Draft: OnboardingV4Draft = Object.freeze({
  initialGoal: null,
  resolvedPrimaryGoal: null,
  savingsAnswers: emptySavingsBranchAnswers,
  healthAnswers: emptyHealthBranchAnswers,
  macroAnswers: emptyMacroBranchAnswers,
  notSureAnswers: emptyNotSureBranchAnswers,
  dietaryAnswers: emptyDietarySafetyAnswers,
  insightViewed: false,
  planCommitted: false,
  scanInput: emptyOnboardingV4ScanInputState,
});

/**
 * Sets the goal a user taps on the Primary Goal screen. For the three direct
 * goals, `resolvedPrimaryGoal` is set to the same value immediately. For
 * `not_sure`, `initialGoal` is preserved but `resolvedPrimaryGoal` stays
 * `null` — it must never be written as `'not_sure'` into any canonical
 * consumer that only supports the three real goals.
 */
export function setOnboardingV4InitialGoal(draft: OnboardingV4Draft, goal: FuturePrimaryGoal): OnboardingV4Draft {
  return { ...draft, initialGoal: goal, resolvedPrimaryGoal: isPrimaryGoal(goal) ? goal : null };
}

/**
 * Resolves a `not_sure` user's `resolvedPrimaryGoal` at onboarding time (the
 * corrected Step 04 contract — no longer deferred to Step 09). No-ops (and
 * does not overwrite an existing resolution) for a draft whose `initialGoal`
 * isn't `not_sure`; a direct-goal draft's `resolvedPrimaryGoal` is already
 * set by `setOnboardingV4InitialGoal` and must never be second-guessed by a
 * transformation-chip tap.
 */
export function setOnboardingV4PreferredTransformation(draft: OnboardingV4Draft, transformation: PreferredTransformation): OnboardingV4Draft {
  if (draft.initialGoal !== 'not_sure') return draft;
  return {
    ...draft,
    notSureAnswers: { ...draft.notSureAnswers, preferredTransformation: transformation },
    resolvedPrimaryGoal: resolveNotSurePrimaryGoal(transformation),
  };
}

// Reuses the same storage key Step 03 already wrote to (`onboardingV4Profile.ts`,
// now removed) — this key itself has never changed shape publicly, only its
// JSON payload; the envelope/schemaVersion below is what's new.
export const ONBOARDING_V4_DRAFT_STORAGE_KEY = 'okyo:onboarding-v4-profile:v1';

/**
 * Step 03's bare, unversioned `{"primaryGoal": ...}` shape (no envelope) is
 * treated as schema version 1 — it predates this envelope entirely, but is a
 * materially different (much narrower) schema from version 2 below, so it
 * gets its own version number rather than sharing one with the current
 * shape, even though it was never literally tagged `schemaVersion: 1` on
 * disk.
 */
export const ONBOARDING_V4_DRAFT_SCHEMA_VERSION_LEGACY_STEP03 = 1 as const;
/** Step 04's expanded draft shape (full branch answers, resolvedPrimaryGoal, preferredTransformation) — no dietaryAnswers field. */
export const ONBOARDING_V4_DRAFT_SCHEMA_VERSION_V4_STEP04 = 2 as const;
/** Adds `dietaryAnswers` (Step 06). */
export const ONBOARDING_V4_DRAFT_SCHEMA_VERSION_STEP06 = 3 as const;
/** Adds `insightViewed` (Step 06 repair, resume-behavior fix). */
export const ONBOARDING_V4_DRAFT_SCHEMA_VERSION_STEP06_REPAIR = 4 as const;
/** The current shape — adds `planCommitted`/`scanInput` (Step 07). */
export const ONBOARDING_V4_DRAFT_SCHEMA_VERSION = 5 as const;

type OnboardingV4DraftEnvelope = { schemaVersion: number; draft: unknown };

function isEnvelope(value: unknown): value is OnboardingV4DraftEnvelope {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && typeof (value as { schemaVersion?: unknown }).schemaVersion === 'number'
    && typeof (value as { draft?: unknown }).draft === 'object' && (value as { draft?: unknown }).draft !== null;
}

/**
 * Step 03 wrote a bare, unversioned `{"primaryGoal": FuturePrimaryGoal | null}`
 * object (no envelope) — this is the exact and only legacy shape that can
 * exist on a device that ran this session's Step 03 build. Detected by the
 * presence of a `primaryGoal` key and the absence of an envelope.
 */
function isLegacyStep03Shape(value: unknown): value is { primaryGoal: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'primaryGoal');
}

function migrateLegacyStep03Draft(legacy: { primaryGoal: unknown }): OnboardingV4Draft {
  const goal = isFuturePrimaryGoal(legacy.primaryGoal) ? legacy.primaryGoal : null;
  return goal ? setOnboardingV4InitialGoal(emptyOnboardingV4Draft, goal) : { ...emptyOnboardingV4Draft };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Field-by-field validation (not a whole-object trust/discard decision) — a single malformed field never wipes its valid siblings. */
function normalizeSavingsAnswers(value: unknown): SavingsBranchAnswers {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<SavingsBranchAnswers>;
  return {
    takeoutFrequency: isTakeoutFrequencyBucket(candidate.takeoutFrequency) ? candidate.takeoutFrequency : null,
    spendPerMealDollars: asFiniteNumber(candidate.spendPerMealDollars) ?? null,
  };
}

function normalizeHealthAnswers(value: unknown): HealthBranchAnswers {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<HealthBranchAnswers>;
  return {
    healthierDefinition: isHealthierDefinition(candidate.healthierDefinition) ? candidate.healthierDefinition : null,
    healthBarrier: isHealthBarrier(candidate.healthBarrier) ? candidate.healthBarrier : null,
  };
}

function normalizeKnownTargets(value: unknown): MacroBranchAnswers['knownTargets'] {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const result: MacroBranchAnswers['knownTargets'] = {};
  const calories = asFiniteNumber(candidate.calories);
  const proteinGrams = asFiniteNumber(candidate.proteinGrams);
  const carbsGrams = asFiniteNumber(candidate.carbsGrams);
  const fatGrams = asFiniteNumber(candidate.fatGrams);
  if (calories !== undefined) result.calories = calories;
  if (proteinGrams !== undefined) result.proteinGrams = proteinGrams;
  if (carbsGrams !== undefined) result.carbsGrams = carbsGrams;
  if (fatGrams !== undefined) result.fatGrams = fatGrams;
  return result;
}

const BIOLOGICAL_SEXES: readonly BiologicalSexForEstimate[] = ['female', 'male', 'prefer_not_to_say'];
const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['mostly_sitting', 'lightly_active', 'active', 'very_active'];

function normalizeCalculatorInputs(value: unknown): MacroBranchAnswers['calculatorInputs'] {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<MacroBranchAnswers['calculatorInputs']>;
  const biologicalSex = asString(candidate.biologicalSex);
  const activityLevel = asString(candidate.activityLevel);
  return {
    ageYears: asFiniteNumber(candidate.ageYears) ?? null,
    heightCm: asFiniteNumber(candidate.heightCm) ?? null,
    weightKg: asFiniteNumber(candidate.weightKg) ?? null,
    biologicalSex: biologicalSex && (BIOLOGICAL_SEXES as readonly string[]).includes(biologicalSex) ? (biologicalSex as BiologicalSexForEstimate) : null,
    activityLevel: activityLevel && (ACTIVITY_LEVELS as readonly string[]).includes(activityLevel) ? (activityLevel as ActivityLevel) : null,
    trainingDaysPerWeek: asFiniteNumber(candidate.trainingDaysPerWeek) ?? null,
  };
}

function normalizeMacroAnswers(value: unknown): MacroBranchAnswers {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<MacroBranchAnswers>;
  return {
    macroFocus: isMacroFocus(candidate.macroFocus) ? candidate.macroFocus : null,
    targetPath: isMacroTargetPath(candidate.targetPath) ? candidate.targetPath : null,
    knownTargets: normalizeKnownTargets(candidate.knownTargets),
    calculatorInputs: candidate.calculatorInputs ? normalizeCalculatorInputs(candidate.calculatorInputs) : emptyMacroCalculatorInputs,
  };
}

function normalizeNotSureAnswers(value: unknown): NotSureBranchAnswers {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<NotSureBranchAnswers>;
  return {
    universalNeed: isUniversalNeed(candidate.universalNeed) ? candidate.universalNeed : null,
    preferredTransformation: isPreferredTransformation(candidate.preferredTransformation) ? candidate.preferredTransformation : null,
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? normalizeCustomDietaryEntries(value) : [];
}

/**
 * Never reinterprets an allergy as a restriction/dislike or vice versa — each
 * group is read from its own named field only, never merged or cross-filled.
 * `noneOfThese` is trusted from storage only when every group is genuinely
 * empty (a stored `noneOfThese: true` alongside a non-empty group is
 * self-contradictory corrupted data — the groups win, `noneOfThese` is
 * dropped rather than silently hiding real answers).
 */
function normalizeDietarySafetyAnswers(value: unknown): DietarySafetyAnswers {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<DietarySafetyAnswers>;
  const allergies = asStringArray(candidate.allergies);
  const restrictions = asStringArray(candidate.restrictions);
  const dislikes = asStringArray(candidate.dislikes);
  const groupsEmpty = allergies.length === 0 && restrictions.length === 0 && dislikes.length === 0;
  return {
    allergies,
    restrictions,
    dislikes,
    noneOfThese: candidate.noneOfThese === true && groupsEmpty,
    completed: candidate.completed === true,
  };
}

const SCAN_INPUT_METHODS: readonly OnboardingV4ScanInputMethod[] = ['camera', 'library', 'description'];
function isScanInputMethod(value: unknown): value is OnboardingV4ScanInputMethod {
  return typeof value === 'string' && (SCAN_INPUT_METHODS as readonly string[]).includes(value);
}

/** Never persists the picked image binary — only the method and the normalized description text, both small and safe to round-trip through storage. */
function normalizeScanInputState(value: unknown): OnboardingV4ScanInputState {
  const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<OnboardingV4ScanInputState>;
  const description = asString(candidate.description) ?? '';
  return {
    method: isScanInputMethod(candidate.method) ? candidate.method : null,
    description: description.trim().slice(0, MAX_MEAL_DESCRIPTION_LENGTH),
    hasSelectedImage: candidate.hasSelectedImage === true,
  };
}

/**
 * Normalizes a candidate draft field-by-field, so a single malformed or
 * unrecognized field never discards its valid siblings — this is also what
 * makes an unrecognized `schemaVersion` (a future minor bump, or corruption)
 * safe to attempt normalizing through directly rather than wiping to empty:
 * any recognizable field is kept, anything not is dropped to its default.
 */
function normalizeOnboardingV4Draft(value: unknown): OnboardingV4Draft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...emptyOnboardingV4Draft };
  const candidate = value as Partial<OnboardingV4Draft>;
  const initialGoal = isFuturePrimaryGoal(candidate.initialGoal) ? candidate.initialGoal : null;
  const resolvedFromStored = isPrimaryGoal(candidate.resolvedPrimaryGoal) ? candidate.resolvedPrimaryGoal : null;
  return {
    initialGoal,
    // Never trust a stored resolvedPrimaryGoal that disagrees with what
    // initialGoal alone would resolve to for a direct goal — recompute
    // instead of trusting possibly-corrupted persisted state, except for the
    // not_sure->resolved case (an onboarding-time preferredTransformation
    // resolution), which is legitimately independent of initialGoal.
    resolvedPrimaryGoal: initialGoal && isPrimaryGoal(initialGoal) ? initialGoal : resolvedFromStored,
    savingsAnswers: normalizeSavingsAnswers(candidate.savingsAnswers),
    healthAnswers: normalizeHealthAnswers(candidate.healthAnswers),
    macroAnswers: normalizeMacroAnswers(candidate.macroAnswers),
    notSureAnswers: normalizeNotSureAnswers(candidate.notSureAnswers),
    // Absent on any pre-Step-06 (v1/v2) stored draft — defaults cleanly to
    // the empty/unanswered state via normalizeDietarySafetyAnswers(undefined),
    // which is exactly the v2->v3 migration: no separate migration function
    // needed since this normalizer already defaults every missing field.
    dietaryAnswers: normalizeDietarySafetyAnswers(candidate.dietaryAnswers),
    // Absent on any pre-repair (v1/v2/v3) stored draft — defaults to false.
    // Safe because resumeOnboardingV4Step (onboardingV4Reducer.ts) checks
    // dietaryAnswers.completed BEFORE insightViewed: a v3 draft that had
    // already completed dietary safety still resumes at 'plan', never
    // incorrectly bounced back to personalInsight by this defaulted flag.
    insightViewed: candidate.insightViewed === true,
    // Step 07. Absent on any pre-Step-07 stored draft — defaults cleanly to
    // false/empty via the same field-by-field pattern; resumeOnboardingV4Step
    // checks dietaryAnswers.completed before planCommitted, so a v4-schema
    // draft that never reached Step 07 still resumes at 'plan', never crashes.
    planCommitted: candidate.planCommitted === true,
    scanInput: normalizeScanInputState(candidate.scanInput),
  };
}

type OnboardingV4DraftStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export function createOnboardingV4DraftPersistence(storage: OnboardingV4DraftStorage) {
  return {
    async readDraft(): Promise<OnboardingV4Draft> {
      let raw: string | null = null;
      try {
        raw = await storage.getItem(ONBOARDING_V4_DRAFT_STORAGE_KEY);
      } catch {
        return { ...emptyOnboardingV4Draft };
      }
      if (!raw) return { ...emptyOnboardingV4Draft };

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { ...emptyOnboardingV4Draft };
      }

      // Any envelope — current version, a future/unknown version, or even a
      // stale version 1 written as a real envelope by some intermediate
      // build — is normalized field-by-field rather than rejected outright,
      // so valid answers under an unexpected version number are still kept.
      if (isEnvelope(parsed)) return normalizeOnboardingV4Draft(parsed.draft);
      if (isLegacyStep03Shape(parsed)) return migrateLegacyStep03Draft(parsed);
      return { ...emptyOnboardingV4Draft };
    },
    async writeDraft(draft: OnboardingV4Draft): Promise<OnboardingV4Draft> {
      const sanitized = normalizeOnboardingV4Draft(draft);
      const envelope: OnboardingV4DraftEnvelope = { schemaVersion: ONBOARDING_V4_DRAFT_SCHEMA_VERSION, draft: sanitized };
      await storage.setItem(ONBOARDING_V4_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
      return sanitized;
    },
  };
}

export const onboardingV4DraftPersistence = createOnboardingV4DraftPersistence(AsyncStorage);

/**
 * TODO (a later step, not Step 04): once V4 onboarding truly completes for a
 * user with a `resolvedPrimaryGoal`, that step must (a) call
 * `mergeOnboardingV4DraftIntoCanonicalProfile` (onboardingV4CanonicalBridge.ts)
 * and persist the result via the existing `onboardingV3Persistence.writePersonalizedProfile`,
 * then (b) clear this draft's storage key so a finished onboarding doesn't
 * keep resurrecting stale draft answers on a later resume. Until that step
 * exists, the draft is intentionally left in place after every write so
 * onboarding resume keeps working (decision: preserve for resume takes
 * priority over cleanup until real completion logic exists).
 */
