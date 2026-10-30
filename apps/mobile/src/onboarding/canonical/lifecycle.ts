import type { FoodPreferences } from '../../state/foodPreferences';
import type { AttributionSource } from '../../onboarding-v3/state/attribution';
import type { PersonalizedOnboardingProfile } from '../../onboarding-v3/state/personalizedOnboarding';
import type { CanonicalOnboardingSnapshot } from './types';

/** The V3 controller’s stable, non-screen lifecycle inputs. */
export type CanonicalHydrationInput = {
  snapshot: CanonicalOnboardingSnapshot;
  mascotName: string;
  attribution: AttributionSource | null;
  dietaryPreferences: FoodPreferences;
};

/** Data supplied to the existing V3 HYDRATE event. V3 still validates routes. */
export type CanonicalHydrationResult = {
  profile: PersonalizedOnboardingProfile;
  resumeStep: string | null;
  mascotName: string;
  attribution: AttributionSource | null;
};

export function createCanonicalHydrationResult({
  snapshot,
  mascotName,
  attribution,
  dietaryPreferences,
}: CanonicalHydrationInput): CanonicalHydrationResult {
  return {
    profile: { ...snapshot.profile, dietaryPreferences },
    resumeStep: snapshot.resumeStep,
    mascotName,
    attribution,
  };
}

export type CanonicalProfileSnapshotRequest = {
  profile: PersonalizedOnboardingProfile;
  currentRoute: string;
  resolveResumeRoute: (currentRoute: string) => string | null;
};

/**
 * Builds the canonical persistence payload without assigning meaning to a V3
 * route. The caller keeps that route policy in its reducer module.
 */
export function createCanonicalProfileSnapshotRequest({
  profile,
  currentRoute,
  resolveResumeRoute,
}: CanonicalProfileSnapshotRequest): Omit<CanonicalOnboardingSnapshot, 'schemaVersion'> {
  return { profile, resumeStep: resolveResumeRoute(currentRoute) };
}
