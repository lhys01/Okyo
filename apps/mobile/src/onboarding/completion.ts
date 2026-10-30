// When is onboarding actually finished?
// Pure so the rule is testable without a simulator.

export type CompletionState = {
  /** The user reached the existing Recipe Result for their first real scan. */
  resultSeen: boolean;
  /** A paywall is eligible for this run (post-value placement). */
  paywallEligible: boolean;
  /** The eligible paywall was purchased, restored or dismissed. */
  paywallResolved: boolean;
};

/**
 * Starting a scan is NOT completion. A cancelled, failed or interrupted scan
 * leaves onboarding incomplete so the user resumes at the scan entry.
 */
export function shouldCompleteOnboarding(state: CompletionState): boolean {
  if (!state.resultSeen) return false;
  if (state.paywallEligible) return state.paywallResolved;
  return true;
}

/** Post-value: only after a real result, and only once per install. */
export function isPaywallEligible(params: {
  paywallAlreadyShown: boolean;
  purchasesAvailable: boolean;
  resultSeen: boolean;
}): boolean {
  return params.resultSeen && params.purchasesAvailable && !params.paywallAlreadyShown;
}
