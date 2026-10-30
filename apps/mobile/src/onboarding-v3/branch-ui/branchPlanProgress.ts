import { HEALTH_PROGRESS_QUESTION_STEPS } from '../state/healthBranch';
import { MACROS_PROGRESS_QUESTION_STEPS, MACROS_PROGRESS_TOTAL } from '../state/macrosBranch';
import { SAVE_MONEY_VISIBLE_STEPS } from '../state/saveMoneyBranch';
import { type CommitmentBranch } from '../state/branchCommitmentPersistence';
import { stepsSkippedForVariant, type OnboardingQuestionVariant } from '../state/onboardingQuestionExperiment';

/** Progress position for the shared plan route, derived from each branch's route metadata. */
export function getFinalBranchPlanProgress(branch: CommitmentBranch, variant: OnboardingQuestionVariant = 'A') {
  const skipped = new Set<string>(stepsSkippedForVariant(variant, branch));
  if (branch === 'save_money') {
    // Savings counts the intro in its visible-step denominator; the plan is
    // the completed `reveal` step, so use the route metadata's full length.
    const total = SAVE_MONEY_VISIBLE_STEPS.filter((step) => !skipped.has(step)).length;
    return { answered: total, total, displayedStep: total };
  }
  if (branch === 'eat_healthier') {
    const total = variant === 'A' ? 8 : HEALTH_PROGRESS_QUESTION_STEPS.filter((step) => !skipped.has(step)).length;
    return { answered: total, total, displayedStep: total };
  }
  const total = variant === 'A' ? MACROS_PROGRESS_TOTAL : MACROS_PROGRESS_QUESTION_STEPS.filter((step) => !skipped.has(step)).length;
  return { answered: total, total, displayedStep: total };
}
