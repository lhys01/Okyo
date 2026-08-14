import {
  calculateEatingOutVsHomeComparison,
  resolveHealthTransformationGuidance,
  resolveMacroGuidance,
  resolveNotSurePrimaryGoal,
  type HealthBranchAnswers,
  type MacroBranchAnswers,
  type NotSureBranchAnswers,
  type PreferredTransformation,
  type SavingsBranchAnswers,
} from '../state/branchContracts';
import type { PrimaryGoal } from '../state/personalizedOnboarding';
import type { DietarySafetyAnswers } from '../state/dietaryContracts';

/**
 * Pure content module for Step 07's compact personal-plan screen. Same
 * pattern as onboardingV4BranchCopy.ts (Step 05): kept out of the .tsx file
 * so every card's text is directly unit-testable, and derived entirely from
 * real draft/calculation data — no fabricated "personalized plan ready"
 * placeholder copy, no default numbers.
 */
export type OnboardingV4PlanCard = { title: string; body: string };
export type OnboardingV4PlanContent = {
  headline: string;
  cards: readonly [OnboardingV4PlanCard, OnboardingV4PlanCard, OnboardingV4PlanCard];
  /** What the first-scan screen's priority echo line should say — reused verbatim by FirstScanEntryScreen.tsx so the two screens never drift. */
  firstScanPriorityEcho: string;
};

/** Adds the completed dietary choices to the existing first card without creating a fourth card. */
export function withDietarySummary(content: OnboardingV4PlanContent, answers: DietarySafetyAnswers): OnboardingV4PlanContent {
  const summary = answers.noneOfThese
    ? 'No allergies, restrictions, or dislikes selected.'
    : [
      answers.allergies.length > 0 ? `Allergies: ${answers.allergies.join(', ')}.` : null,
      answers.restrictions.length > 0 ? `Restrictions: ${answers.restrictions.join(', ')}.` : null,
      answers.dislikes.length > 0 ? `Dislikes: ${answers.dislikes.join(', ')}.` : null,
    ].filter((part): part is string => part !== null).join(' ');

  if (!summary) return content;
  const [whatYouToldUs, prioritizes, firstAction] = content.cards;
  return {
    ...content,
    cards: [{ ...whatYouToldUs, body: `${whatYouToldUs.body} ${summary}` }, prioritizes, firstAction],
  };
}

const PREFERRED_TRANSFORMATION_LABEL: Record<PreferredTransformation, string> = {
  cheaper: 'a lower-cost version',
  more_balanced: 'a more balanced version',
  more_protein: 'a higher-protein version',
};

export function buildSavingsPlanContent(answers: SavingsBranchAnswers): OnboardingV4PlanContent {
  const comparison = calculateEatingOutVsHomeComparison(answers);
  const toldUsBody = answers.takeoutFrequency === '0'
    ? "You're already cooking most of your own meals."
    : comparison
      ? `You told us you eat out about ${answers.takeoutFrequency} times a week, at roughly $${comparison.estimatedEatingOutCost} an order.`
      : "We'll fill this in once your eating-out habits are set.";

  return {
    headline: 'Your plan starts with saving on eating out.',
    cards: [
      { title: 'What you told us', body: toldUsBody },
      { title: 'What Okyo will prioritize', body: 'Accessible, lower-cost versions of the food you already order.' },
      {
        title: 'Your first action',
        body: comparison
          ? `Scan a dish and compare its estimated eating-out cost (about $${comparison.estimatedEatingOutCost}) with its estimated make-at-home cost (about $${comparison.estimatedMakeAtHomeCost.toFixed(2)}). Estimated savings: about $${comparison.projectedDifference.toFixed(2)} per meal.`
          : 'Scan a dish and compare its estimated eating-out cost with its estimated make-at-home cost.',
      },
    ],
    firstScanPriorityEcho: 'a lower-cost version',
  };
}

export function buildHealthPlanContent(answers: HealthBranchAnswers): OnboardingV4PlanContent {
  const guidance = answers.healthierDefinition ? resolveHealthTransformationGuidance(answers.healthierDefinition) : null;
  const focus = answers.healthierDefinition?.toLowerCase() ?? 'a healthier direction';
  return {
    headline: `Your plan starts with ${focus}.`,
    cards: [
      {
        title: 'What you told us',
        body: [
          answers.healthierDefinition ? `You want recipes that are ${focus}.` : null,
          answers.healthBarrier ? `${answers.healthBarrier} tends to get in the way.` : null,
        ].filter(Boolean).join(' ') || "We'll fill this in once your health goal is set.",
      },
      { title: 'What Okyo will prioritize', body: guidance?.exampleLine ?? "A recipe transformation tailored to what you're going for — no clinical claims, no guarantees." },
      { title: 'Your first action', body: `Scan a favorite dish and get a version adapted toward ${focus}.` },
    ],
    firstScanPriorityEcho: `a ${focus} version`,
  };
}

export function buildMacrosPlanContent(answers: MacroBranchAnswers, ageYears: number | null): OnboardingV4PlanContent {
  const guidance = resolveMacroGuidance(answers, ageYears);
  const focus = answers.macroFocus ? answers.macroFocus.toLowerCase() : 'your macros';

  let toldUsBody = "We'll fill this in once your targets are set.";
  let prioritizeBody = `Recipes weighted toward ${focus}.`;
  if (guidance.kind === 'minor_safe_redirect') {
    toldUsBody = 'You can enter your own targets, use balanced-fueling guidance, or set targets with a parent/guardian or clinician.';
    prioritizeBody = "Okyo does not calculate calorie or weight targets for users under 18 — balanced, age-appropriate guidance only.";
  } else if (guidance.kind === 'known_targets') {
    const parts = [
      guidance.targets.calories !== undefined ? `${guidance.targets.calories} cal` : null,
      guidance.targets.proteinGrams !== undefined ? `${guidance.targets.proteinGrams}g protein` : null,
      guidance.targets.carbsGrams !== undefined ? `${guidance.targets.carbsGrams}g carbs` : null,
      guidance.targets.fatGrams !== undefined ? `${guidance.targets.fatGrams}g fat` : null,
    ].filter((part): part is string => part !== null);
    toldUsBody = `You entered your own targets: ${parts.join(' · ')}.`;
  } else if (guidance.kind === 'calculated_range') {
    toldUsBody = `Based on what you shared, a safe estimated starting range is ${guidance.rangeLowCalories}–${guidance.rangeHighCalories} calories a day. This is a starting point, not a fixed rule or a weight-loss target.`;
  }

  return {
    headline: `Your plan starts with ${focus}.`,
    cards: [
      { title: 'What you told us', body: toldUsBody },
      { title: 'What Okyo will prioritize', body: prioritizeBody },
      { title: 'Your first action', body: `Scan a dish and see how it fits your configured target.` },
    ],
    firstScanPriorityEcho: `your ${focus} target`,
  };
}

export function buildNotSurePlanContent(answers: NotSureBranchAnswers, resolvedPrimaryGoal: PrimaryGoal | null): OnboardingV4PlanContent {
  const chip = answers.preferredTransformation;
  const chipLabel = chip ? PREFERRED_TRANSFORMATION_LABEL[chip] : 'the first recipe that fits';
  const resolved = resolvedPrimaryGoal ?? (chip ? resolveNotSurePrimaryGoal(chip) : null);
  const priorityBody = resolved === 'save_money'
    ? "We'll prioritize keeping your first recipe's cost down."
    : resolved === 'eat_healthier'
      ? "We'll prioritize a more balanced version of your first recipe."
      : resolved === 'hit_macros'
        ? "We'll prioritize extra protein in your first recipe."
        : "We'll pick this up on your first recipe.";

  return {
    headline: "You weren't sure — here's where we'll start.",
    cards: [
      { title: 'What you told us', body: `You picked ${chipLabel} for your first recipe.` },
      { title: 'What Okyo will prioritize', body: priorityBody },
      { title: 'Your first action', body: `Scan a dish and Okyo will aim for ${chipLabel}.` },
    ],
    firstScanPriorityEcho: chipLabel,
  };
}
