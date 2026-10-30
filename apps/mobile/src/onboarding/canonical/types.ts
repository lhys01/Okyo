import type { PersonalizedOnboardingProfile, PrimaryGoal } from '../../onboarding-v3/state/personalizedOnboarding';

/**
 * Stable identifiers for the eventual single onboarding registry. `not_sure`
 * is intentionally not rendered by Legacy V3 yet; it is reserved so a later
 * approved neutral branch does not need a migration-breaking rename.
 */
export const CANONICAL_ONBOARDING_GOALS = ['save_money', 'eat_healthier', 'hit_macros', 'not_sure'] as const;
export type CanonicalOnboardingGoal = (typeof CANONICAL_ONBOARDING_GOALS)[number];

export const CANONICAL_ONBOARDING_SCHEMA_VERSION = 1 as const;

export type CanonicalOnboardingSnapshot = {
  schemaVersion: typeof CANONICAL_ONBOARDING_SCHEMA_VERSION;
  profile: PersonalizedOnboardingProfile;
  resumeStep: string | null;
};

export function toCanonicalGoal(goal: PrimaryGoal | null): CanonicalOnboardingGoal | null {
  return goal;
}
