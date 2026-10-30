import type { OnboardingV4Draft } from '../state/onboardingV4Draft';
import { buildHealthInsight } from './onboardingV4BranchCopy';

// Teaching example, not a generated result, target recommendation, or a
// nutritional analysis of the bundled photo. Keep this label beside the UI.
export const MACRO_TEACHING_EXAMPLE = {
  proteinGrams: 38, calories: 610, carbsGrams: 65, fatGrams: 22,
  disclaimer: 'Illustrative nutrition example, per serving. Your recipe will have its own estimates.',
} as const;

export function buildOnboardingReveal(draft: OnboardingV4Draft) {
  if (draft.initialGoal === 'save_money') {
    const cost = draft.savingsAnswers.spendPerMealDollars;
    return {
      kind: 'money' as const,
      title: 'Same craving.\nA clearer price.',
      summary: draft.savingsAnswers.cookingPriority ? MONEY_PRIORITY_SUMMARY[draft.savingsAnswers.cookingPriority] : 'See the estimated cost of making your dish before you decide to cook.',
      eatingOut: cost !== null ? `$${cost}` : 'Your comparison',
      home: "We'll calculate this from your recipe.",
      note: 'This is only a comparison. Actual savings are tracked after you cook.',
      replacementNote: draft.savingsAnswers.comparisonStatus === 'answered' && draft.savingsAnswers.replacementsPerWeek ? `${draft.savingsAnswers.replacementsPerWeek} meal${draft.savingsAnswers.replacementsPerWeek === 1 ? '' : 's'}/week to compare` : null,
    };
  }
  if (draft.initialGoal === 'eat_healthier') {
    const insight = buildHealthInsight(draft.healthAnswers);
    return {
      kind: 'health' as const,
      title: 'More balance.\nStill your kind of food.',
      summary: insight.barrierNote || 'Start with food you crave, then see what you can change.',
      suggestion: insight.exampleLine || 'Add a vegetable side to a meal you already like.',
      note: 'An example idea, not your finished recipe. Nutrition will be estimated.',
    };
  }
  if (draft.initialGoal === 'hit_macros') {
    const { macroFocus, targetPath, knownTargets } = draft.macroAnswers;
    const ownTargets = targetPath === 'known' ? [
      knownTargets.proteinGrams !== undefined ? `${knownTargets.proteinGrams}g protein/day` : null,
      knownTargets.calories !== undefined ? `${knownTargets.calories} calories/day` : null,
    ].filter((value): value is string => value !== null) : [];
    return {
      kind: 'macros' as const,
      title: 'Your numbers.\nYour kind of food.',
      summary: macroFocus === 'Protein' ? 'See protein first, with the rest there when you need it.' : macroFocus === 'Calories' ? 'See calories per serving without losing sight of the food.' : 'See protein, carbs, and fat together, with clear portion context.',
      metric: macroFocus === 'Protein' ? 'protein' as const : macroFocus === 'Calories' ? 'calories' as const : 'balanced' as const,
      ownTargets,
      note: MACRO_TEACHING_EXAMPLE.disclaimer,
    };
  }
  return { kind: 'neutral' as const, title: "Let's start with\na dish you love.", summary: 'You can choose what matters after you see what Okyo can do.' };
}

const MONEY_PRIORITY_SUMMARY = {
  'Quick & easy': "We'll prioritize quick prep and keep estimated cost visible.",
  'Lower ingredient cost': "We'll look for lower-cost ingredients that fit the dish.",
  'Keep the restaurant flavor': "We'll stay close to the craving, with estimated cost alongside it.",
  'Use what I already have': "We'll favor everyday ingredients. You can check what you already have.",
} as const;
