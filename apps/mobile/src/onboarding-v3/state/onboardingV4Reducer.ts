import type {
  HealthBarrier,
  HealthierDefinition,
  KnownMacroTargets,
  MacroCalculatorInputs,
  MacroFocus,
  MacroTargetPath,
  PreferredTransformation,
  TakeoutFrequencyBucket,
  UniversalNeed,
} from './branchContracts';
import {
  addDietaryAllergy,
  addDietaryRestriction,
  completeDietarySafety,
  isDietarySafetyAnswered,
  removeDietaryAllergy,
  removeDietaryRestriction,
  selectNoneOfTheseDietary,
  setDietaryDislikes,
} from './dietaryContracts';
import { isFuturePrimaryGoal, type FuturePrimaryGoal, type PrimaryGoal } from './personalizedOnboarding';
import {
  emptyOnboardingV4Draft,
  setOnboardingV4InitialGoal,
  setOnboardingV4PreferredTransformation,
  type OnboardingV4Draft,
  type OnboardingV4ScanInputMethod,
} from './onboardingV4Draft';
import type { OnboardingV4Step } from './onboardingV4Route';
import type { OnboardingV4InFlightScan } from './onboardingV4ScanPersistence';
import type { OnboardingV4PendingPremiumAction } from './onboardingV4PremiumAction';

/**
 * Pure reducer for the V4 flow (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 03/04/05): `splash → promise → primaryGoal → branchQ1 → branchQ2 →
 * [macroDetails] → personalInsight`. New and separate from
 * `onboardingV3Reducer` (onboardingV3Machine.ts) — that reducer is not
 * imported or modified here. Holds the versioned `OnboardingV4Draft`
 * (onboardingV4Draft.ts, Step 04) as its `draft` slot.
 */
export type OnboardingV4State = {
  step: OnboardingV4Step;
  draft: OnboardingV4Draft;
  inFlightScan: OnboardingV4InFlightScan | null;
  freeRecipeConsumed: boolean;
  analysisId: string | null;
  recipeId: string | null;
  scanError: string | null;
  pendingPremiumAction: OnboardingV4PendingPremiumAction | null;
  paywallError: string | null;
};

export type OnboardingV4Event =
  | { type: 'HYDRATE'; draft: OnboardingV4Draft; inFlightScan?: OnboardingV4InFlightScan | null; freeRecipeConsumed?: boolean; recipeId?: string | null; pendingPremiumAction?: OnboardingV4PendingPremiumAction | null }
  | { type: 'SPLASH_FINISHED' }
  | { type: 'CONTINUE' }
  | { type: 'BACK' }
  | { type: 'GOAL_SELECTED'; goal: FuturePrimaryGoal }
  | { type: 'SAVINGS_TAKEOUT_FREQUENCY_ANSWERED'; value: TakeoutFrequencyBucket }
  | { type: 'SAVINGS_SPEND_PER_MEAL_ANSWERED'; value: number }
  | { type: 'HEALTH_DEFINITION_ANSWERED'; value: HealthierDefinition }
  | { type: 'HEALTH_BARRIER_ANSWERED'; value: HealthBarrier }
  | { type: 'MACRO_FOCUS_ANSWERED'; value: MacroFocus }
  | { type: 'MACRO_TARGET_PATH_ANSWERED'; value: MacroTargetPath }
  | { type: 'MACRO_KNOWN_TARGETS_ANSWERED'; value: KnownMacroTargets }
  | { type: 'MACRO_CALCULATOR_INPUTS_ANSWERED'; value: MacroCalculatorInputs }
  | { type: 'NOT_SURE_UNIVERSAL_NEED_ANSWERED'; value: UniversalNeed }
  | { type: 'NOT_SURE_TRANSFORMATION_ANSWERED'; value: PreferredTransformation }
  | { type: 'DIETARY_ALLERGY_TOGGLED'; value: string }
  | { type: 'DIETARY_RESTRICTION_TOGGLED'; value: string }
  | { type: 'DIETARY_DISLIKES_CHANGED'; value: string[] }
  | { type: 'DIETARY_NONE_OF_THESE_TOGGLED' }
  | { type: 'DIETARY_SAVED' }
  | { type: 'PLAN_COMMITTED' }
  | { type: 'SCAN_INPUT_METHOD_SELECTED'; method: OnboardingV4ScanInputMethod }
  | { type: 'SCAN_IMAGE_SELECTED' }
  | { type: 'SCAN_IMAGE_CLEARED' }
  | { type: 'SCAN_DESCRIPTION_CHANGED'; value: string }
  | { type: 'PHOTO_CONFIRMED'; inFlightScan: OnboardingV4InFlightScan }
  | { type: 'DESCRIPTION_SUBMITTED'; inFlightScan: OnboardingV4InFlightScan }
  | { type: 'RESUME_SCAN' }
  | { type: 'IN_FLIGHT_CLEARED' }
  | { type: 'ANALYSIS_SUCCEEDED'; analysisId: string }
  | { type: 'ANALYSIS_REJECTED'; message: string }
  | { type: 'ANALYSIS_FAILED'; message: string }
  | { type: 'ANALYSIS_CANCELLED' }
  | { type: 'RECIPE_FAILED'; message: string }
  | { type: 'TRANSACTION_RECOVERABLE_FAILURE'; message: string }
  | { type: 'RESULT_RESTORED'; recipeId: string }
  | { type: 'PREMIUM_ACTION_PERSISTED'; action: OnboardingV4PendingPremiumAction }
  | { type: 'PREMIUM_ACTION_EXECUTING'; action: OnboardingV4PendingPremiumAction }
  | { type: 'PAYWALL_REQUIRED'; action: OnboardingV4PendingPremiumAction }
  | { type: 'PAYWALL_ERROR'; message: string }
  | { type: 'PAYWALL_DISMISSED'; action: OnboardingV4PendingPremiumAction }
  | { type: 'PREMIUM_ACTION_FAILED'; action: OnboardingV4PendingPremiumAction; message: string }
  | { type: 'PREMIUM_ACTION_RESUMED'; action: OnboardingV4PendingPremiumAction }
  | { type: 'RETURN_TO_RECIPE'; action?: OnboardingV4PendingPremiumAction }
  | { type: 'RECIPE_READY'; recipeId: string };

export const initialOnboardingV4State: OnboardingV4State = Object.freeze({
  step: 'splash',
  draft: emptyOnboardingV4Draft,
  inFlightScan: null,
  freeRecipeConsumed: false,
  analysisId: null,
  recipeId: null,
  scanError: null,
  pendingPremiumAction: null,
  paywallError: null,
});

export function getOnboardingV4PremiumDestinationStep(action: OnboardingV4PendingPremiumAction | null): 'recipe' | 'paywall' | 'postPurchase' {
  if (!action || action.status === 'dismissed' || action.status === 'pending_entitlement') return 'recipe';
  if (action.status === 'paywall') return 'paywall';
  if (action.status === 'completed' && action.type === 'customize') return 'recipe';
  return 'postPurchase';
}

/** hit_macros needs the compact grouped form only for the two paths that actually use calculated/entered numbers — not_sure never reaches macroDetails, even if resolved to hit_macros, per Step 05's contract. */
function requiresMacroDetails(draft: OnboardingV4Draft): boolean {
  return draft.initialGoal === 'hit_macros'
    && (draft.macroAnswers.targetPath === 'known' || draft.macroAnswers.targetPath === 'estimate');
}

function stepAfterBranchQ2(draft: OnboardingV4Draft): OnboardingV4Step {
  return requiresMacroDetails(draft) ? 'macroDetails' : 'personalInsight';
}

const EMPTY_MACRO_CALCULATOR_INPUTS: OnboardingV4Draft['macroAnswers']['calculatorInputs'] = Object.freeze({
  ageYears: null, heightCm: null, weightKg: null, biologicalSex: null, activityLevel: null, trainingDaysPerWeek: null,
});

export function onboardingV4Reducer(state: OnboardingV4State, event: OnboardingV4Event): OnboardingV4State {
  if (event.type === 'HYDRATE') return { ...state, draft: event.draft, inFlightScan: event.inFlightScan ?? null, freeRecipeConsumed: event.freeRecipeConsumed ?? false, recipeId: event.recipeId ?? null, pendingPremiumAction: event.pendingPremiumAction ?? null };
  if (event.type === 'RESULT_RESTORED') return { ...state, step: getOnboardingV4PremiumDestinationStep(state.pendingPremiumAction), recipeId: event.recipeId, freeRecipeConsumed: true, inFlightScan: null };

  switch (state.step) {
    case 'splash':
      // Resume at the last incomplete meaningful step, derived purely from
      // the (by now hydrated — HYDRATE is dispatched on mount, before
      // splash's own ~700ms+ timer fires) draft's completeness, rather than
      // always restarting at Promise.
      return event.type === 'SPLASH_FINISHED' ? { ...state, step: state.freeRecipeConsumed && state.recipeId ? getOnboardingV4PremiumDestinationStep(state.pendingPremiumAction) : resumeOnboardingV4Step(state.draft) } : state;

    case 'promise':
      return event.type === 'CONTINUE' ? { ...state, step: 'primaryGoal' } : state;

    case 'primaryGoal':
      if (event.type === 'GOAL_SELECTED' && isFuturePrimaryGoal(event.goal)) {
        return { ...state, step: 'branchQ1', draft: setOnboardingV4InitialGoal(state.draft, event.goal) };
      }
      return event.type === 'BACK' ? { ...state, step: 'promise' } : state;

    case 'branchQ1': {
      if (event.type === 'BACK') return { ...state, step: 'primaryGoal' };
      if (event.type === 'SAVINGS_TAKEOUT_FREQUENCY_ANSWERED' && state.draft.initialGoal === 'save_money') {
        return { ...state, draft: { ...state.draft, savingsAnswers: { ...state.draft.savingsAnswers, takeoutFrequency: event.value } } };
      }
      if (event.type === 'HEALTH_DEFINITION_ANSWERED' && state.draft.initialGoal === 'eat_healthier') {
        return { ...state, draft: { ...state.draft, healthAnswers: { ...state.draft.healthAnswers, healthierDefinition: event.value } } };
      }
      if (event.type === 'MACRO_FOCUS_ANSWERED' && state.draft.initialGoal === 'hit_macros') {
        return { ...state, draft: { ...state.draft, macroAnswers: { ...state.draft.macroAnswers, macroFocus: event.value } } };
      }
      if (event.type === 'NOT_SURE_UNIVERSAL_NEED_ANSWERED' && state.draft.initialGoal === 'not_sure') {
        return { ...state, draft: { ...state.draft, notSureAnswers: { ...state.draft.notSureAnswers, universalNeed: event.value } } };
      }
      if (event.type === 'CONTINUE' && isBranchQ1Answered(state.draft)) return { ...state, step: 'branchQ2' };
      return state;
    }

    case 'branchQ2': {
      if (event.type === 'BACK') return { ...state, step: 'branchQ1' };
      if (event.type === 'SAVINGS_SPEND_PER_MEAL_ANSWERED' && state.draft.initialGoal === 'save_money') {
        return { ...state, draft: { ...state.draft, savingsAnswers: { ...state.draft.savingsAnswers, spendPerMealDollars: event.value } } };
      }
      if (event.type === 'HEALTH_BARRIER_ANSWERED' && state.draft.initialGoal === 'eat_healthier') {
        return { ...state, draft: { ...state.draft, healthAnswers: { ...state.draft.healthAnswers, healthBarrier: event.value } } };
      }
      if (event.type === 'MACRO_TARGET_PATH_ANSWERED' && state.draft.initialGoal === 'hit_macros') {
        // Changing the target path invalidates whichever compact-form answers
        // belonged to the *other* path — the form shown differs entirely, so
        // stale entered-vs-estimated values are cleared rather than carried
        // forward silently (dependent-answer recompute on upstream change).
        if (event.value === state.draft.macroAnswers.targetPath) return state;
        return {
          ...state,
          draft: {
            ...state.draft,
            macroAnswers: { ...state.draft.macroAnswers, targetPath: event.value, knownTargets: {}, calculatorInputs: EMPTY_MACRO_CALCULATOR_INPUTS },
          },
        };
      }
      if (event.type === 'NOT_SURE_TRANSFORMATION_ANSWERED' && state.draft.initialGoal === 'not_sure') {
        return { ...state, draft: setOnboardingV4PreferredTransformation(state.draft, event.value) };
      }
      if (event.type === 'CONTINUE' && isBranchQ2Answered(state.draft)) {
        return { ...state, step: stepAfterBranchQ2(state.draft) };
      }
      return state;
    }

    case 'macroDetails': {
      if (event.type === 'BACK') return { ...state, step: 'branchQ2' };
      if (event.type === 'MACRO_KNOWN_TARGETS_ANSWERED') {
        return { ...state, draft: { ...state.draft, macroAnswers: { ...state.draft.macroAnswers, knownTargets: event.value } } };
      }
      if (event.type === 'MACRO_CALCULATOR_INPUTS_ANSWERED') {
        return { ...state, draft: { ...state.draft, macroAnswers: { ...state.draft.macroAnswers, calculatorInputs: event.value } } };
      }
      if (event.type === 'CONTINUE' && isMacroDetailsAnswered(state.draft)) return { ...state, step: 'personalInsight' };
      return state;
    }

    case 'personalInsight':
      if (event.type === 'BACK') return { ...state, step: requiresMacroDetails(state.draft) ? 'macroDetails' : 'branchQ2' };
      // Marking insightViewed here (not on mount/view) means BACKing out of
      // dietarySafety and returning does not re-trigger it a second time —
      // it is already true from the first CONTINUE, exactly matching the
      // "insight viewed" semantics resumeOnboardingV4Step depends on.
      return event.type === 'CONTINUE' ? { ...state, step: 'dietarySafety', draft: { ...state.draft, insightViewed: true } } : state;

    case 'dietarySafety': {
      if (event.type === 'BACK') return { ...state, step: 'personalInsight' };
      if (event.type === 'DIETARY_ALLERGY_TOGGLED') {
        const has = state.draft.dietaryAnswers.allergies.includes(event.value);
        const dietaryAnswers = has ? removeDietaryAllergy(state.draft.dietaryAnswers, event.value) : addDietaryAllergy(state.draft.dietaryAnswers, event.value);
        return { ...state, draft: { ...state.draft, dietaryAnswers } };
      }
      if (event.type === 'DIETARY_RESTRICTION_TOGGLED') {
        const has = state.draft.dietaryAnswers.restrictions.includes(event.value);
        const dietaryAnswers = has ? removeDietaryRestriction(state.draft.dietaryAnswers, event.value) : addDietaryRestriction(state.draft.dietaryAnswers, event.value);
        return { ...state, draft: { ...state.draft, dietaryAnswers } };
      }
      if (event.type === 'DIETARY_DISLIKES_CHANGED') {
        return { ...state, draft: { ...state.draft, dietaryAnswers: setDietaryDislikes(state.draft.dietaryAnswers, event.value) } };
      }
      if (event.type === 'DIETARY_NONE_OF_THESE_TOGGLED') {
        const dietaryAnswers = state.draft.dietaryAnswers.noneOfThese
          ? { ...state.draft.dietaryAnswers, noneOfThese: false }
          : selectNoneOfTheseDietary(state.draft.dietaryAnswers);
        return { ...state, draft: { ...state.draft, dietaryAnswers } };
      }
      if (event.type === 'DIETARY_SAVED' && isDietarySafetyAnswered(state.draft.dietaryAnswers)) {
        return { ...state, step: 'plan', draft: { ...state.draft, dietaryAnswers: completeDietarySafety(state.draft.dietaryAnswers) } };
      }
      return state;
    }

    case 'plan': {
      if (event.type === 'BACK') return { ...state, step: 'dietarySafety' };
      // The real async canonical-profile commit happens in OnboardingV4.tsx
      // (onboardingV4CanonicalCommit.ts) — this reducer only records success
      // once that write has actually resolved, exactly like DIETARY_SAVED.
      if (event.type === 'PLAN_COMMITTED') return { ...state, step: 'scanEntry', draft: { ...state.draft, planCommitted: true } };
      return state;
    }

    case 'scanEntry': {
      if (event.type === 'BACK') return { ...state, step: 'plan' };
      if (event.type === 'SCAN_INPUT_METHOD_SELECTED') {
        return { ...state, draft: { ...state.draft, scanInput: { ...state.draft.scanInput, method: event.method, hasSelectedImage: false } } };
      }
      if (event.type === 'SCAN_IMAGE_SELECTED') {
        return { ...state, step: 'photoConfirm', scanError: null, draft: { ...state.draft, scanInput: { ...state.draft.scanInput, hasSelectedImage: true } } };
      }
      if (event.type === 'SCAN_IMAGE_CLEARED') {
        return { ...state, draft: { ...state.draft, scanInput: { ...state.draft.scanInput, hasSelectedImage: false } } };
      }
      if (event.type === 'SCAN_DESCRIPTION_CHANGED') {
        return { ...state, draft: { ...state.draft, scanInput: { ...state.draft.scanInput, description: event.value } } };
      }
      if (event.type === 'DESCRIPTION_SUBMITTED') return { ...state, step: 'analyzing', inFlightScan: event.inFlightScan, scanError: null };
      if (event.type === 'RESUME_SCAN' && state.inFlightScan) return { ...state, step: 'analyzing', scanError: null };
      if (event.type === 'IN_FLIGHT_CLEARED') return { ...state, inFlightScan: null, scanError: null };
      return state;
    }

    case 'photoConfirm':
      if (event.type === 'BACK') return { ...state, step: 'scanEntry', draft: { ...state.draft, scanInput: { ...state.draft.scanInput, hasSelectedImage: false } } };
      if (event.type === 'PHOTO_CONFIRMED') return { ...state, step: 'analyzing', inFlightScan: event.inFlightScan, scanError: null };
      return state;

    case 'analyzing':
      if (event.type === 'ANALYSIS_SUCCEEDED') return { ...state, analysisId: event.analysisId };
      if (event.type === 'RECIPE_READY') return { ...state, step: 'recipe', recipeId: event.recipeId, freeRecipeConsumed: true, inFlightScan: null, scanError: null };
      if (event.type === 'ANALYSIS_REJECTED' || event.type === 'ANALYSIS_FAILED' || event.type === 'RECIPE_FAILED') {
        return { ...state, step: 'scanEntry', analysisId: null, inFlightScan: null, scanError: event.message };
      }
      if (event.type === 'TRANSACTION_RECOVERABLE_FAILURE') return { ...state, step: 'scanEntry', analysisId: null, scanError: event.message };
      if (event.type === 'ANALYSIS_CANCELLED') return { ...state, step: 'scanEntry', analysisId: null, inFlightScan: null, scanError: null };
      return state;

    case 'recipe':
      if (event.type === 'PREMIUM_ACTION_PERSISTED') return { ...state, pendingPremiumAction: event.action, paywallError: null };
      if (event.type === 'PREMIUM_ACTION_EXECUTING') return { ...state, step: 'postPurchase', pendingPremiumAction: event.action, paywallError: null };
      if (event.type === 'PAYWALL_REQUIRED') return { ...state, step: 'paywall', pendingPremiumAction: event.action, paywallError: null };
      if (event.type === 'PAYWALL_ERROR') return { ...state, paywallError: event.message };
      if (event.type === 'PREMIUM_ACTION_FAILED') return { ...state, step: 'postPurchase', pendingPremiumAction: event.action, paywallError: event.message };
      if (event.type === 'PREMIUM_ACTION_RESUMED') return { ...state, step: event.action.type === 'cook' ? 'postPurchase' : 'recipe', pendingPremiumAction: event.action, paywallError: null };
      return state;

    case 'paywall':
      if (event.type === 'PAYWALL_ERROR') return { ...state, paywallError: event.message };
      if (event.type === 'PAYWALL_DISMISSED') return { ...state, step: 'recipe', pendingPremiumAction: event.action, paywallError: null };
      if (event.type === 'PREMIUM_ACTION_EXECUTING') return { ...state, step: 'postPurchase', pendingPremiumAction: event.action, paywallError: null };
      if (event.type === 'PREMIUM_ACTION_FAILED') return { ...state, step: 'postPurchase', pendingPremiumAction: event.action, paywallError: event.message };
      if (event.type === 'PREMIUM_ACTION_RESUMED') return { ...state, step: event.action.type === 'cook' ? 'postPurchase' : 'recipe', pendingPremiumAction: event.action, paywallError: null };
      return state;

    case 'postPurchase':
      if (event.type === 'RETURN_TO_RECIPE') return { ...state, step: 'recipe', pendingPremiumAction: event.action ?? state.pendingPremiumAction, paywallError: null };
      if (event.type === 'PAYWALL_ERROR') return { ...state, paywallError: event.message };
      if (event.type === 'PREMIUM_ACTION_EXECUTING') return { ...state, pendingPremiumAction: event.action, paywallError: null };
      if (event.type === 'PREMIUM_ACTION_FAILED') return { ...state, pendingPremiumAction: event.action, paywallError: event.message };
      if (event.type === 'PREMIUM_ACTION_RESUMED') return { ...state, step: event.action.type === 'cook' ? 'postPurchase' : 'recipe', pendingPremiumAction: event.action, paywallError: null };
      return state;

    default:
      return state;
  }
}

export function isBranchQ1Answered(draft: OnboardingV4Draft): boolean {
  if (draft.initialGoal === 'save_money') return draft.savingsAnswers.takeoutFrequency !== null;
  if (draft.initialGoal === 'eat_healthier') return draft.healthAnswers.healthierDefinition !== null;
  if (draft.initialGoal === 'hit_macros') return draft.macroAnswers.macroFocus !== null;
  if (draft.initialGoal === 'not_sure') return draft.notSureAnswers.universalNeed !== null;
  return false;
}

export function isBranchQ2Answered(draft: OnboardingV4Draft): boolean {
  if (draft.initialGoal === 'save_money') return draft.savingsAnswers.spendPerMealDollars !== null;
  if (draft.initialGoal === 'eat_healthier') return draft.healthAnswers.healthBarrier !== null;
  if (draft.initialGoal === 'hit_macros') return draft.macroAnswers.targetPath !== null;
  if (draft.initialGoal === 'not_sure') return draft.resolvedPrimaryGoal !== null;
  return false;
}

export function isMacroDetailsAnswered(draft: OnboardingV4Draft): boolean {
  if (draft.macroAnswers.targetPath === 'known') return Object.keys(draft.macroAnswers.knownTargets).length > 0;
  if (draft.macroAnswers.targetPath === 'estimate') {
    const inputs = draft.macroAnswers.calculatorInputs;
    return inputs.ageYears !== null && inputs.heightCm !== null && inputs.weightKg !== null && inputs.activityLevel !== null;
  }
  return true;
}

/**
 * Pure resume logic: derives the step to land on purely from the draft's
 * own completeness (the draft itself is the only persisted state — there is
 * no separately-stored "last step" to trust or fall out of sync with). A
 * brand-new install and a user who saw Promise but backed out before
 * picking a goal are indistinguishable from draft data alone (`initialGoal`
 * is null either way) — resuming to `'promise'` in that case is the safe
 * choice: it never skips a screen a fresh user hasn't seen, at the minor
 * cost of re-showing Promise to someone who'd already seen it once.
 */
export function resumeOnboardingV4Step(draft: OnboardingV4Draft): OnboardingV4Step {
  if (draft.initialGoal === null) return 'promise';
  if (!isBranchQ1Answered(draft)) return 'branchQ1';
  if (!isBranchQ2Answered(draft)) return 'branchQ2';
  if (requiresMacroDetails(draft) && !isMacroDetailsAnswered(draft)) return 'macroDetails';
  // Step 06 repair. `dietaryAnswers.completed` is checked before
  // `insightViewed` on purpose: a v3-schema draft (pre-repair) that had
  // already completed dietary safety migrates with insightViewed defaulted
  // to false (onboardingV4Draft.ts), and must still resume at 'plan' rather
  // than being bounced back to an insight it provably already passed.
  // Step 07: dietary completion now branches further instead of always
  // landing on 'plan' — planCommitted distinguishes "hasn't seen/finished
  // the plan yet" (resume at 'plan', whether never viewed or viewed but the
  // canonical commit didn't finish) from "plan committed, first-scan input
  // in progress" (resume at 'scanEntry' — Step 08 owns anything past that).
  if (draft.dietaryAnswers.completed) return draft.planCommitted ? 'scanEntry' : 'plan';
  if (!draft.insightViewed) return 'personalInsight';
  // Insight was viewed and dietary safety is not yet completed — covers both
  // "never entered dietarySafety" and "entered and partially edited it";
  // either way the user's valid selections (already persisted live on every
  // dispatch) are exactly where they left them.
  return 'dietarySafety';
}
