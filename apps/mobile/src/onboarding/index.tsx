import { OnboardingV3 } from '../onboarding-v3/OnboardingV3';

/**
 * The single navigator entry for the canonical onboarding foundation. Legacy
 * V3 remains the mounted implementation while adapters are introduced behind
 * it, preserving all user-facing behavior during standardization.
 */
export function CanonicalOnboarding(props: { appStartedAt: number; fontsLoaded: boolean }) {
  return <OnboardingV3 {...props} />;
}

export { canonicalBranchRegistry } from './canonical/branchRegistry';
export { canonicalOnboardingConfig } from './canonical/config';
export { canonicalOnboardingPersistence } from './canonical/persistence';
