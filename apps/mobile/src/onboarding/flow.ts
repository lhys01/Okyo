// Direction C onboarding step machine. Pure, RN-free, fully testable.

import type { OnboardingAnswers } from './types';

export type OnboardingStep =
  | 'intro'
  | 'overview'
  | 'problem'
  | 'followUp'
  | 'guidance'
  | 'diet'
  | 'setup'
  | 'example'
  | 'scanEntry'
  | 'analyzing'
  | 'result'
  | 'paywall';

/** Linear spine. `followUp` is always present: every problem has a branch. */
const ORDER: OnboardingStep[] = [
  'intro', 'overview', 'problem', 'followUp', 'guidance',
  'diet', 'setup', 'example', 'scanEntry', 'analyzing', 'result', 'paywall',
];

/** Progress readout per screen, matching the approved Direction C designs. */
const PERCENT: Record<OnboardingStep, number> = {
  intro: 12, overview: 25, problem: 37, followUp: 50, guidance: 62,
  diet: 75, setup: 87, example: 100, scanEntry: 100,
  analyzing: 100, result: 100, paywall: 100,
};

/** Steps that must never be restored from disk — they own a live, temporary session. */
const TRANSIENT: OnboardingStep[] = ['analyzing', 'result', 'paywall'];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (ORDER as string[]).includes(value);
}

export function stepPercent(step: OnboardingStep): number {
  return PERCENT[step];
}

export function isTransientStep(step: OnboardingStep): boolean {
  return TRANSIENT.includes(step);
}

/** Progress bar is shown on the question spine only. */
export function showsProgress(step: OnboardingStep): boolean {
  return step !== 'analyzing' && step !== 'result' && step !== 'paywall';
}

export function canGoBack(step: OnboardingStep): boolean {
  return step !== 'intro' && !isTransientStep(step);
}

export function nextStep(step: OnboardingStep): OnboardingStep {
  const i = ORDER.indexOf(step);
  if (i < 0 || i === ORDER.length - 1) return step;
  return ORDER[i + 1];
}

export function previousStep(step: OnboardingStep): OnboardingStep {
  const i = ORDER.indexOf(step);
  if (i <= 0) return 'intro';
  if (isTransientStep(step)) return 'scanEntry';
  return ORDER[i - 1];
}

/**
 * Where a relaunch should land. Transient steps rewind to the scan entry so we
 * never resume into a dead camera session or an in-flight network request.
 */
export function resumeStep(step: OnboardingStep | null | undefined): OnboardingStep {
  if (!step || !isOnboardingStep(step)) return 'intro';
  if (isTransientStep(step)) return 'scanEntry';
  return step;
}

/** A step is only reachable if every question before it has an answer. */
export function isStepReachable(step: OnboardingStep, answers: OnboardingAnswers): boolean {
  const i = ORDER.indexOf(step);
  if (i < 0) return false;
  if (i > ORDER.indexOf('problem') && !answers.problem) return false;
  if (i > ORDER.indexOf('followUp') && !answers.followUp) return false;
  if (i > ORDER.indexOf('guidance') && !answers.guidance) return false;
  return true;
}

/** Clamp a restored step back to the furthest point the answers actually support. */
export function clampStepToAnswers(step: OnboardingStep, answers: OnboardingAnswers): OnboardingStep {
  let candidate = resumeStep(step);
  while (candidate !== 'intro' && !isStepReachable(candidate, answers)) {
    candidate = previousStep(candidate);
  }
  return candidate;
}
