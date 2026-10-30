import type { PrimaryGoal } from '../../onboarding-v3/state/personalizedOnboarding';
import { canonicalOnboardingConfig } from './config';
import { CANONICAL_ONBOARDING_GOALS, type CanonicalOnboardingGoal } from './types';

export type CanonicalBranchDefinition = {
  id: CanonicalOnboardingGoal;
  /** The legacy route remains authoritative until that branch is migrated. */
  legacyEntryStep: 'branchIntro';
  previewEnabled: boolean;
};

export const canonicalBranchRegistry: readonly CanonicalBranchDefinition[] = Object.freeze([
  { id: 'save_money', legacyEntryStep: 'branchIntro', previewEnabled: canonicalOnboardingConfig.previews.save_money },
  { id: 'eat_healthier', legacyEntryStep: 'branchIntro', previewEnabled: canonicalOnboardingConfig.previews.eat_healthier },
  { id: 'hit_macros', legacyEntryStep: 'branchIntro', previewEnabled: canonicalOnboardingConfig.previews.hit_macros },
  { id: 'not_sure', legacyEntryStep: 'branchIntro', previewEnabled: false },
]);

export function getCanonicalBranch(goal: CanonicalOnboardingGoal) {
  return canonicalBranchRegistry.find((branch) => branch.id === goal) ?? null;
}

/**
 * Mirrors the restored V3 preview behavior exactly. In particular, the prior
 * Macros preview condition intentionally remains broader than the other two
 * previews until Macros ownership is reviewed in its own stage.
 */
export function resolveCanonicalPreviewBranch(
  step: string,
  goal: PrimaryGoal | null,
): Extract<CanonicalOnboardingGoal, 'save_money' | 'eat_healthier' | 'hit_macros'> | null {
  if (goal === 'save_money' && step === 'branchIntro' && isCanonicalPreviewEnabled('save_money')) return 'save_money';
  if (goal === 'eat_healthier' && step === 'branchIntro' && isCanonicalPreviewEnabled('eat_healthier')) return 'eat_healthier';
  if (goal === 'hit_macros' && step === 'branchIntro' && isCanonicalPreviewEnabled('hit_macros')) return 'hit_macros';
  return null;
}

/** The current V3 onboarding route uses one branch flow in every build. */
export function resolveActiveOnboardingBranch(
  step: string,
  goal: PrimaryGoal | null,
): Extract<CanonicalOnboardingGoal, 'save_money' | 'eat_healthier' | 'hit_macros'> | null {
  if (step !== 'branchIntro') return null;
  return goal === 'save_money' || goal === 'eat_healthier' || goal === 'hit_macros' ? goal : null;
}

function isCanonicalPreviewEnabled(goal: Extract<CanonicalOnboardingGoal, 'save_money' | 'eat_healthier' | 'hit_macros'>) {
  return getCanonicalBranch(goal)?.previewEnabled === true;
}

export function isCanonicalGoal(value: unknown): value is CanonicalOnboardingGoal {
  return typeof value === 'string' && CANONICAL_ONBOARDING_GOALS.includes(value as CanonicalOnboardingGoal);
}
