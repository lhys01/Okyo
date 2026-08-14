import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sticky current-vs-V4 experiment assignment (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 02, correction #4). Distinct from `ONBOARDING_V4_ENABLED` in devFlags.ts:
 * that constant is the master rollout kill-switch (must stay `false` and code
 * must not read it outside devFlags.ts/its test per Step 02's acceptance
 * criteria); this module is the durable per-install record of which flow an
 * install is in, once a later step turns the rollout on — so a user is never
 * silently reassigned between app opens. Follows the same injectable-storage
 * factory pattern as `createOnboardingV3Persistence` (onboardingV3Persistence.ts).
 * Per Step 02's scope, nothing reads this yet — not wired into any live
 * routing decision.
 */
export type OnboardingV4Assignment = 'v3' | 'v4';

export const ONBOARDING_V4_EXPERIMENT_STORAGE_KEY = 'okyo:onboarding-v4-experiment:v1';

const DEFAULT_ASSIGNMENT: OnboardingV4Assignment = 'v3';

function isOnboardingV4Assignment(value: unknown): value is OnboardingV4Assignment {
  return value === 'v3' || value === 'v4';
}

type OnboardingV4ExperimentStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export function createOnboardingV4ExperimentAssignment(
  storage: OnboardingV4ExperimentStorage,
  deterministicOverride?: OnboardingV4Assignment,
) {
  return {
    async readAssignment(): Promise<OnboardingV4Assignment | null> {
      if (deterministicOverride) return deterministicOverride;
      const raw = await storage.getItem(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY);
      return isOnboardingV4Assignment(raw) ? raw : null;
    },
    async writeAssignment(assignment: OnboardingV4Assignment): Promise<void> {
      if (deterministicOverride) return;
      await storage.setItem(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY, assignment);
    },
    /**
     * Missing, malformed, or unknown stored values all fall back to the safe
     * default (`v3`, the current flow) and persist that fallback immediately,
     * so a corrupted value is corrected once rather than re-evaluated (and
     * potentially flipping) on every call. A legitimately stored assignment —
     * `'v3'` or `'v4'` — is always honored as-is and never overwritten.
     */
    async getAssignment(): Promise<OnboardingV4Assignment> {
      if (deterministicOverride) return deterministicOverride;

      let raw: string | null = null;
      try {
        raw = await storage.getItem(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY);
      } catch {
        return DEFAULT_ASSIGNMENT;
      }

      if (isOnboardingV4Assignment(raw)) return raw;

      try {
        await storage.setItem(ONBOARDING_V4_EXPERIMENT_STORAGE_KEY, DEFAULT_ASSIGNMENT);
      } catch {
        // Persisting the fallback is best-effort; the safe default still applies this call.
      }
      return DEFAULT_ASSIGNMENT;
    },
  };
}

export const onboardingV4ExperimentAssignment = createOnboardingV4ExperimentAssignment(AsyncStorage);
