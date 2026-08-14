import AsyncStorage from '@react-native-async-storage/async-storage';

import { PERSONALIZED_PROFILE_STORAGE_KEY, PERSONALIZED_PROGRESS_STORAGE_KEY } from './onboardingV3Persistence';
import { ONBOARDING_V4_DRAFT_STORAGE_KEY } from './onboardingV4Draft';
import {
  onboardingV4ExperimentAssignment,
  type OnboardingV4Assignment,
} from './onboardingV4Experiment';
import {
  ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY,
  ONBOARDING_V4_IN_FLIGHT_SCAN_KEY,
} from './onboardingV4ScanPersistence';
import { ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY } from './onboardingV4PremiumAction';

export type OnboardingActivationEvidence = {
  assignment: OnboardingV4Assignment | null;
  hasV3Progress: boolean;
  hasV3Profile: boolean;
  hasV4Draft: boolean;
  hasV4InFlightScan: boolean;
  hasV4FreeRecipe: boolean;
  hasV4PremiumAction: boolean;
};

export type OnboardingActivationDecision = {
  assignment: OnboardingV4Assignment;
  engine: 'v3' | 'v4';
  reason: 'sticky_assignment' | 'existing_v4_state' | 'existing_v3_state' | 'new_install';
};

export function decideOnboardingActivation(evidence: OnboardingActivationEvidence): OnboardingActivationDecision {
  if (evidence.assignment) return { assignment: evidence.assignment, engine: evidence.assignment, reason: 'sticky_assignment' };
  if (evidence.hasV4Draft || evidence.hasV4InFlightScan || evidence.hasV4FreeRecipe || evidence.hasV4PremiumAction) {
    return { assignment: 'v4', engine: 'v4', reason: 'existing_v4_state' };
  }
  if (evidence.hasV3Progress || evidence.hasV3Profile) {
    return { assignment: 'v3', engine: 'v3', reason: 'existing_v3_state' };
  }
  return { assignment: 'v4', engine: 'v4', reason: 'new_install' };
}

type ActivationStorage = Pick<typeof AsyncStorage, 'getItem'>;

export function createOnboardingActivationResolver(
  storage: ActivationStorage,
  assignmentPersistence = onboardingV4ExperimentAssignment,
) {
  return async function resolveOnboardingActivation(): Promise<OnboardingActivationDecision> {
    let assignment: OnboardingV4Assignment | null;
    try {
      assignment = await assignmentPersistence.readAssignment();
    } catch {
      // A temporarily unavailable assignment store must not start both engines.
      return { assignment: 'v3', engine: 'v3', reason: 'existing_v3_state' };
    }
    const keys = [
      PERSONALIZED_PROGRESS_STORAGE_KEY,
      PERSONALIZED_PROFILE_STORAGE_KEY,
      ONBOARDING_V4_DRAFT_STORAGE_KEY,
      ONBOARDING_V4_IN_FLIGHT_SCAN_KEY,
      ONBOARDING_V4_FREE_RECIPE_CONSUMED_KEY,
      ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY,
    ] as const;
    let values: Array<string | null>;
    try {
      values = await Promise.all(keys.map((key) => storage.getItem(key)));
    } catch {
      return { assignment: 'v3', engine: 'v3', reason: 'existing_v3_state' };
    }
    const decision = decideOnboardingActivation({
      assignment,
      hasV3Progress: values[0] !== null,
      hasV3Profile: values[1] !== null,
      hasV4Draft: values[2] !== null,
      hasV4InFlightScan: values[3] !== null,
      hasV4FreeRecipe: values[4] === 'true',
      hasV4PremiumAction: values[5] !== null,
    });
    if (!assignment) {
      try { await assignmentPersistence.writeAssignment(decision.assignment); } catch { /* best-effort sticky write */ }
    }
    return decision;
  };
}

export const resolveOnboardingActivation = createOnboardingActivationResolver(AsyncStorage);
