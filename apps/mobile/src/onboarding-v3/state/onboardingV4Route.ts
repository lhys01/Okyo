import type { OnboardingActivationPhase } from '../controller/onboardingV3Machine';
import type { OnboardingV4Assignment } from './onboardingV4Experiment';

/**
 * The canonical V4 onboarding flow (see Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 02 and its "Canonical flow" diagram: Splash → Promise → Primary Goal →
 * Branch Q1 → Branch Q2 → Personal Insight → Dietary Safety → Compact Personal
 * Plan → First Scan → Photo Confirmation → Analysis → Full Free Recipe Reveal
 * → User-initiated premium action → Paywall → Purchase/Restore → Resume).
 * This is a parallel, inert type — nothing in the running app reads or
 * dispatches these step ids yet. `OnboardingV3Step` (onboardingV3Machine.ts)
 * remains the only step type any live screen or reducer consumes until Step 03
 * begins wiring V4 screens behind `ONBOARDING_V4_ENABLED`. This module does not
 * define a second reducer/state machine — `onboardingV3Reducer` is untouched.
 */
export type OnboardingV4Step =
  | 'splash'
  | 'promise'
  | 'primaryGoal'
  | 'branchQ1'
  | 'branchQ2'
  | 'macroDetails'
  | 'personalInsight'
  | 'dietarySafety'
  | 'plan'
  | 'scanEntry'
  | 'photoConfirm'
  | 'analyzing'
  | 'recipe'
  | 'paywall'
  | 'postPurchase'
  | 'complete';

/**
 * Order matches the canonical flow exactly. `recipe` (the free recipe reveal,
 * decision #2's activation moment) precedes `paywall` — the paywall never
 * opens until a user-initiated premium action after the recipe is visible
 * (decisions #4–#5); `ONBOARDING_V4_STEPS.indexOf('recipe') < indexOf('paywall')`
 * is asserted by a test so this ordering can't silently regress.
 */
export const ONBOARDING_V4_STEPS: readonly OnboardingV4Step[] = Object.freeze([
  'splash',
  'promise',
  'primaryGoal',
  'branchQ1',
  'branchQ2',
  'macroDetails',
  'personalInsight',
  'dietarySafety',
  'plan',
  'scanEntry',
  'photoConfirm',
  'analyzing',
  'recipe',
  'paywall',
  'postPurchase',
  'complete',
]);

const RECIPE_REVEALED_PHASE_STEPS: ReadonlySet<OnboardingV4Step> = new Set(['recipe']);
const ENTITLED_PHASE_STEPS: ReadonlySet<OnboardingV4Step> = new Set(['postPurchase']);
const FIRST_SCAN_PHASE_STEPS: ReadonlySet<OnboardingV4Step> = new Set([
  'scanEntry',
  'photoConfirm',
  'analyzing',
]);

/**
 * Categorizes a V4 step into the same `OnboardingActivationPhase` values the
 * V3 machine already exports (onboardingV3Machine.ts) — reused, not redefined,
 * per Step 02's scope. V4 is the first flow to actually reach `first_scan`:
 * decision #1 in the plan puts one full free scan before any paywall exposure,
 * so `scanEntry`/`photoConfirm`/`analyzing` map there instead of `entitled`.
 */
export function getOnboardingV4ActivationPhase(step: OnboardingV4Step): OnboardingActivationPhase {
  if (step === 'paywall') return 'paywall';
  if (step === 'complete') return 'complete';
  if (ENTITLED_PHASE_STEPS.has(step)) return 'entitled';
  if (RECIPE_REVEALED_PHASE_STEPS.has(step)) return 'recipe_revealed';
  if (FIRST_SCAN_PHASE_STEPS.has(step)) return 'first_scan';
  return 'questions';
}

/**
 * The Step 03 gate: V4 renders only when BOTH the master rollout kill-switch
 * (`ONBOARDING_V4_ENABLED`, devFlags.ts) is on AND this install's persisted
 * experiment assignment (onboardingV4Experiment.ts) is `'v4'`. A pure function
 * so tests can activate V4 deterministically by passing `assignment: 'v4'`
 * directly — no need to flip the global flag or touch AsyncStorage. V3 is the
 * safe default on every other combination (flag off, or assignment still
 * loading/`null`, or assignment `'v3'`).
 */
export function shouldUseOnboardingV4({
  enabled,
  assignment,
}: {
  enabled: boolean;
  assignment: OnboardingV4Assignment | null;
}): boolean {
  return enabled && assignment === 'v4';
}

/**
 * Step 05: stage labels replace a misleading global percentage (the branch
 * question count differs per branch — save_money/eat_healthier finish in 2
 * questions, hit_macros may add a 3rd macroDetails step — so a numeric "3 of
 * 5" would be inconsistent across branches). Ordered as an index so callers
 * can assert the label never regresses across the canonical forward order.
 */
export const ONBOARDING_V4_STAGE_LABELS = ['Your goal', 'Your starting point', 'Your preferences', 'Your plan'] as const;
export type OnboardingV4StageLabel = (typeof ONBOARDING_V4_STAGE_LABELS)[number];

const STAGE_LABEL_BY_STEP: Partial<Record<OnboardingV4Step, OnboardingV4StageLabel>> = {
  primaryGoal: 'Your goal',
  branchQ1: 'Your starting point',
  branchQ2: 'Your preferences',
  macroDetails: 'Your preferences',
  // Step 06: dietarySafety is explicitly "Your preferences" per the plan —
  // personalInsight is grouped at the same stage (not "Your plan") so the
  // label never regresses going personalInsight -> dietarySafety. "Your
  // plan" is reserved for the eventual Compact Personal Plan step.
  personalInsight: 'Your preferences',
  dietarySafety: 'Your preferences',
  plan: 'Your plan',
};

/** Null for steps before/after the branch-questions arc (splash/promise, or anything past personalInsight/dietarySafety/plan) — those don't show a stage label at all. */
export function getOnboardingV4StageLabel(step: OnboardingV4Step): OnboardingV4StageLabel | null {
  return STAGE_LABEL_BY_STEP[step] ?? null;
}
