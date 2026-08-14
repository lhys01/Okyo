import {
  calculateSavingsBranchEstimate,
  HEALTHIER_DEFINITIONS,
  HEALTH_BARRIERS,
  MACRO_FOCUSES,
  resolveHealthTransformationGuidance,
  resolveMacroGuidance,
  TAKEOUT_FREQUENCY_BUCKETS,
  UNIVERSAL_NEEDS,
  type HealthBranchAnswers,
  type MacroBranchAnswers,
  type MacroGuidanceResult,
  type MacroTargetPath,
  type PreferredTransformation,
  type SavingsBranchAnswers,
} from '../state/branchContracts';
import type { FuturePrimaryGoal, PrimaryGoal } from '../state/personalizedOnboarding';

/**
 * Pure copy/content module for Step 05's branch question and insight
 * screens (Okyo_Onboarding_V4_Implementation_Plan.md). Kept separate from
 * the .tsx screen files so every piece of question/insight logic is directly
 * unit-testable under `node:test` without rendering React Native (see
 * `analytics/onboardingV4Events.ts`'s header comment for why that matters in
 * this repo). No screen here collects any field outside branchContracts.ts's
 * contract — no names, secondary goals, mascot names, or dietary data.
 */

export const BRANCH_Q1_TITLE: Record<FuturePrimaryGoal, string> = {
  save_money: 'How often do you order takeout or eat out in a typical week?',
  eat_healthier: 'What does healthier mean for you?',
  hit_macros: 'What are you optimizing for?',
  not_sure: 'What sounds most useful?',
};

export const BRANCH_Q2_TITLE: Record<FuturePrimaryGoal, string> = {
  save_money: 'About how much does one order cost?',
  eat_healthier: 'What gets in the way most?',
  hit_macros: 'Do you already know your daily targets?',
  not_sure: 'What would help most on your first recipe?',
};

export const SAVINGS_Q2_HELPER = 'A rough estimate is perfect.';

// Savings Q2 money-stepper range — same bounds already validated for this
// exact question shape in the existing V3 'money' question kind
// (PersonalizedOnboardingScreen.tsx) — a genuinely "easy" range, not a new
// invention.
export const SAVINGS_SPEND_MIN = 10;
export const SAVINGS_SPEND_MAX = 50;
export const SAVINGS_SPEND_STEP = 5;
export const SAVINGS_SPEND_DEFAULT = 20;

export { TAKEOUT_FREQUENCY_BUCKETS as SAVINGS_Q1_OPTIONS };
export { HEALTHIER_DEFINITIONS as HEALTH_Q1_OPTIONS };
export { HEALTH_BARRIERS as HEALTH_Q2_OPTIONS };
export { MACRO_FOCUSES as MACRO_Q1_OPTIONS };
export { UNIVERSAL_NEEDS as NOT_SURE_Q1_OPTIONS };

export const MACRO_Q2_OPTIONS: readonly { label: string; value: MacroTargetPath }[] = [
  { label: 'Enter mine', value: 'known' },
  { label: 'Help me estimate', value: 'estimate' },
  { label: 'Not sure yet', value: 'not_sure' },
];

export const NOT_SURE_Q2_OPTIONS: readonly { label: string; value: PreferredTransformation }[] = [
  { label: 'Make it cheaper', value: 'cheaper' },
  { label: 'Make it more balanced', value: 'more_balanced' },
  { label: 'Add more protein', value: 'more_protein' },
];

// --- Insight content -----------------------------------------------------

export type SavingsInsightContent = {
  headline: string;
  weeklyLine: string;
  monthlyLine: string;
  yearlyLine: string;
  formulaNote: string;
  isZeroFrequency: boolean;
};

export function buildSavingsInsight(answers: SavingsBranchAnswers): SavingsInsightContent {
  if (answers.takeoutFrequency === '0') {
    return {
      headline: "You're already cooking most of your own meals.",
      weeklyLine: '', monthlyLine: '', yearlyLine: '',
      formulaNote: "Okyo will focus on making the meals you already cook easier and more exciting — not on a spend comparison you don't need.",
      isZeroFrequency: true,
    };
  }

  const estimate = calculateSavingsBranchEstimate(answers);
  if (!estimate) {
    return {
      headline: "We'll estimate this once you've answered both questions.",
      weeklyLine: '', monthlyLine: '', yearlyLine: '',
      formulaNote: '',
      isZeroFrequency: false,
    };
  }

  const range = (low: number, high: number) => (estimate.hasRange ? `$${low}–$${high}` : `$${low}`);
  return {
    headline: 'Here\'s roughly what cooking instead could avoid spending.',
    weeklyLine: `${range(estimate.weeklyLow, estimate.weeklyHigh)} a week`,
    monthlyLine: `${range(estimate.monthlyLow, estimate.monthlyHigh)} a month`,
    yearlyLine: `${range(estimate.annualLow, estimate.annualHigh)} a year`,
    formulaNote: 'Estimated from your typical order frequency and cost, compared to a cautious home-cooking cost — not confirmed actual savings, and not a promise.',
    isZeroFrequency: false,
  };
}

export type HealthInsightContent = {
  headline: string;
  exampleLine: string;
  barrierNote: string;
};

const HEALTH_BARRIER_NOTES: Record<HealthBranchAnswers['healthBarrier'] & string, string> = {
  Time: "We'll prioritize recipes that fit the time you actually have.",
  Cravings: "We'll work with what you're craving, not against it.",
  'Boring recipes': "We'll keep things varied so it doesn't get repetitive.",
  'Confusion about what\'s healthy': "We'll keep the nutrition info simple and clear.",
  'Giving up favorites': "You won't have to give up the foods you already like.",
};

export function buildHealthInsight(answers: HealthBranchAnswers): HealthInsightContent {
  const guidance = answers.healthierDefinition ? resolveHealthTransformationGuidance(answers.healthierDefinition) : null;
  return {
    headline: guidance ? `Your plan starts with ${answers.healthierDefinition!.toLowerCase()} — without banning the food you like.` : "We'll build this once you've answered both questions.",
    exampleLine: guidance?.exampleLine ?? '',
    barrierNote: answers.healthBarrier ? HEALTH_BARRIER_NOTES[answers.healthBarrier] : '',
  };
}

export type MacroInsightContent = {
  headline: string;
  rangeOrTargetLine: string;
  focusNote: string;
  disclaimer: string;
  minorMessage: string | null;
};

export function buildMacroInsight(answers: MacroBranchAnswers, ageYears: number | null): MacroInsightContent {
  const result: MacroGuidanceResult = resolveMacroGuidance(answers, ageYears);
  const focusNote = answers.macroFocus ? `Focused on: ${answers.macroFocus.toLowerCase()}.` : '';

  if (result.kind === 'minor_safe_redirect') {
    return { headline: 'Your starting point', rangeOrTargetLine: '', focusNote, disclaimer: '', minorMessage: result.message };
  }
  if (result.kind === 'calculated_range') {
    return {
      headline: 'Your starting range is ready.',
      rangeOrTargetLine: `${result.rangeLowCalories}–${result.rangeHighCalories} calories a day`,
      focusNote,
      disclaimer: 'A starting point, not a fixed rule — you can edit this anytime.',
      minorMessage: null,
    };
  }
  if (result.kind === 'known_targets') {
    const parts = [
      result.targets.calories !== undefined ? `${result.targets.calories} cal` : null,
      result.targets.proteinGrams !== undefined ? `${result.targets.proteinGrams}g protein` : null,
      result.targets.carbsGrams !== undefined ? `${result.targets.carbsGrams}g carbs` : null,
      result.targets.fatGrams !== undefined ? `${result.targets.fatGrams}g fat` : null,
    ].filter((part): part is string => part !== null);
    return {
      headline: "You're set — using your own targets.",
      rangeOrTargetLine: parts.join(' · '),
      focusNote,
      disclaimer: 'You can update these anytime.',
      minorMessage: null,
    };
  }
  return {
    headline: "We'll finish this once your details are in.",
    rangeOrTargetLine: '',
    focusNote,
    disclaimer: '',
    minorMessage: null,
  };
}

const NOT_SURE_INSIGHT_BY_GOAL: Record<PrimaryGoal, string> = {
  save_money: "We'll prioritize recipes that keep your first meal cheaper.",
  eat_healthier: "We'll prioritize a more balanced version of your first recipe.",
  hit_macros: "We'll prioritize extra protein in your first recipe.",
};

export function buildNotSureInsight(resolvedPrimaryGoal: PrimaryGoal | null): string {
  return resolvedPrimaryGoal ? NOT_SURE_INSIGHT_BY_GOAL[resolvedPrimaryGoal] : "We'll pick this up on your first recipe.";
}
