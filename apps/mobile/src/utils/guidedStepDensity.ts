import type { GuidedCookingStep } from './guidedCookingSteps';

export type GuidedStepDensity = 'short' | 'medium' | 'long';

/** Presentation-only density: no recipe data is changed. */
export function getGuidedStepDensity(step: Pick<GuidedCookingStep, 'instruction' | 'ingredientsUsed' | 'toolsUsed' | 'visualCue' | 'doneWhen' | 'commonMistake' | 'safetyNote' | 'chefTip' | 'cookingTerm' | 'tip'>): GuidedStepDensity {
  const sentences = step.instruction.split(/[.!?]+/).filter((part) => part.trim()).length;
  const words = step.instruction.trim().split(/\s+/).filter(Boolean).length;
  const helperCount = [step.visualCue, step.doneWhen, step.commonMistake, step.safetyNote, step.chefTip, step.cookingTerm, step.tip].filter(Boolean).length;
  const referenceCount = step.ingredientsUsed.length + step.toolsUsed.length;

  if (words <= 24 && sentences <= 1 && helperCount === 0 && step.ingredientsUsed.length <= 3 && step.toolsUsed.length <= 2) return 'short';
  if (words >= 58 || sentences >= 3 || helperCount >= 2 || referenceCount >= 7) return 'long';
  return 'medium';
}
